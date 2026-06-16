"""Meta (Facebook) Ads tool logic — the integration's core.

This module is provider/transport agnostic: it is imported by the MCP server
(`mcp_server/meta_ads_server.py`) which exposes these functions as MCP tools,
and it can also be called in-process when MCP is disabled. The behaviour is
identical either way — MCP is the transport, this is the logic.

Two modes:
* sandbox (default): builds the *exact* Graph API request that would be sent,
  logs/returns it, and yields a simulated id. No spend is possible.
* live (META_LIVE=true + credentials): performs the real Graph API call.

Safety: campaigns are always created PAUSED. Activation ("launch") is a
separate, explicit step that maps to the human-approval-before-spend gate.
"""
from __future__ import annotations

import uuid
from typing import Any

import httpx

from .config import settings

GRAPH_BASE = "https://graph.facebook.com"


def _is_live() -> bool:
    return bool(settings.meta_live and settings.meta_access_token and settings.meta_ad_account_id)


def _account_path() -> str:
    acct = settings.meta_ad_account_id or "act_SANDBOX"
    if not acct.startswith("act_"):
        acct = f"act_{acct}"
    return acct


def create_campaign(
    *, name: str, objective: str = "OUTCOME_TRAFFIC", daily_budget_eur: int = 10
) -> dict[str, Any]:
    """Create a PAUSED campaign. Returns the result and the intended request."""
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{_account_path()}/campaigns"
    params = {
        "name": name,
        "objective": objective,
        "status": "PAUSED",  # never auto-spend
        "special_ad_categories": "[]",
        # Budget in minor units (cents), Meta convention.
        "daily_budget": str(int(daily_budget_eur) * 100),
    }
    intended_request = {"method": "POST", "url": url, "params": {**params, "access_token": "***"}}

    if _is_live():
        resp = httpx.post(
            url, data={**params, "access_token": settings.meta_access_token}, timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "mode": "live",
            "external_campaign_id": data.get("id", ""),
            "status": "PAUSED",
            "intended_request": intended_request,
            "response": data,
        }

    return {
        "mode": "sandbox",
        "external_campaign_id": f"sandbox_camp_{uuid.uuid4().hex[:12]}",
        "status": "PAUSED",
        "intended_request": intended_request,
        "response": {"note": "sandbox — no request was sent to Meta"},
    }


def activate_campaign(*, external_campaign_id: str) -> dict[str, Any]:
    """Flip a campaign to ACTIVE. This is the spend-enabling step."""
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{external_campaign_id}"
    params = {"status": "ACTIVE"}
    intended_request = {"method": "POST", "url": url, "params": {**params, "access_token": "***"}}

    if _is_live():
        resp = httpx.post(
            url, data={**params, "access_token": settings.meta_access_token}, timeout=30
        )
        resp.raise_for_status()
        return {"mode": "live", "status": "ACTIVE", "intended_request": intended_request, "response": resp.json()}

    return {
        "mode": "sandbox",
        "status": "ACTIVE",
        "intended_request": intended_request,
        "response": {"note": "sandbox — campaign marked ACTIVE locally only"},
    }


def get_insights(*, external_campaign_id: str) -> dict[str, Any]:
    """Pull campaign performance back into the platform for reporting."""
    url = f"{GRAPH_BASE}/{settings.meta_api_version}/{external_campaign_id}/insights"
    params = {"fields": "impressions,clicks,spend,cpc,ctr,reach"}
    intended_request = {"method": "GET", "url": url, "params": {**params, "access_token": "***"}}

    if _is_live():
        resp = httpx.get(
            url, params={**params, "access_token": settings.meta_access_token}, timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        metrics = (data.get("data") or [{}])[0]
        return {"mode": "live", "metrics": metrics, "intended_request": intended_request}

    # Deterministic-ish sandbox metrics derived from the id so the demo shows
    # plausible numbers without pretending they are real.
    seed = sum(ord(c) for c in external_campaign_id)
    metrics = {
        "impressions": 1000 + seed % 9000,
        "clicks": 20 + seed % 180,
        "spend": round((daily := 5 + seed % 45) * 1.0, 2),
        "cpc": round(daily / max(1, (20 + seed % 180)), 2),
        "ctr": round((20 + seed % 180) / (1000 + seed % 9000) * 100, 2),
        "reach": 800 + seed % 7000,
    }
    return {"mode": "sandbox", "metrics": metrics, "intended_request": intended_request}
