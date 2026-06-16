"""Capability 4: Meta Ads via MCP — create, launch (human gate), pull insights.

Every ad-account action is recorded in the audit trail, including the exact
Graph API request, the mode (sandbox/live) and whether it went through MCP.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..database import get_db
from ..deps import get_actor
from ..mcp_client import call_meta_tool
from ..models import Campaign, Creative
from ..schemas import CampaignCreate, CampaignOut

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignOut)
async def create_campaign(
    payload: CampaignCreate, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    creative = db.get(Creative, payload.creative_id)
    if not creative:
        raise HTTPException(404, "Creative not found")
    # Human-in-the-loop gate: only an approved creative can become a campaign.
    if creative.status != "approved":
        raise HTTPException(
            409, "Creative must be approved before a campaign can be created"
        )

    result = await call_meta_tool(
        "create_campaign",
        {
            "name": payload.name,
            "objective": payload.objective,
            "daily_budget_eur": payload.daily_budget_eur,
        },
    )

    campaign = Campaign(
        creative_id=creative.id,
        name=payload.name,
        objective=payload.objective,
        daily_budget_eur=payload.daily_budget_eur,
        status="created_paused",
        external_campaign_id=result.get("external_campaign_id", ""),
        mode=result.get("mode", "sandbox"),
        via_mcp=result.get("_via_mcp", False),
    )
    db.add(campaign)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="ADS_CAMPAIGN_CREATED",
        category="ad_account",
        resource_type="campaign",
        resource_id=campaign.id,
        output=f"campaign {campaign.external_campaign_id} created PAUSED",
        metadata={
            "mode": campaign.mode,
            "via_mcp": campaign.via_mcp,
            "intended_request": result.get("intended_request"),
            "mcp_error": result.get("_mcp_error"),
        },
    )
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/launch", response_model=CampaignOut)
async def launch_campaign(
    campaign_id: int, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    """The human approval before spend: activates a PAUSED campaign."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status == "launched":
        raise HTTPException(409, "Campaign already launched")

    result = await call_meta_tool(
        "activate_campaign", {"external_campaign_id": campaign.external_campaign_id}
    )
    campaign.status = "launched"
    campaign.launched_by = actor
    campaign.launched_at = datetime.now(timezone.utc)
    campaign.via_mcp = result.get("_via_mcp", campaign.via_mcp)
    db.add(campaign)
    audit.record(
        db,
        actor=actor,
        action="ADS_CAMPAIGN_LAUNCHED",
        category="ad_account",
        resource_type="campaign",
        resource_id=campaign.id,
        output=f"campaign {campaign.external_campaign_id} activated (spend enabled)",
        metadata={
            "human_in_the_loop": True,
            "mode": result.get("mode"),
            "via_mcp": result.get("_via_mcp"),
            "intended_request": result.get("intended_request"),
            "mcp_error": result.get("_mcp_error"),
        },
    )
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/insights", response_model=CampaignOut)
async def fetch_insights(
    campaign_id: int, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    result = await call_meta_tool(
        "get_insights", {"external_campaign_id": campaign.external_campaign_id}
    )
    campaign.insights = result.get("metrics")
    db.add(campaign)
    audit.record(
        db,
        actor=actor,
        action="ADS_INSIGHTS_FETCHED",
        category="ad_account",
        resource_type="campaign",
        resource_id=campaign.id,
        output=str(result.get("metrics")),
        metadata={
            "mode": result.get("mode"),
            "via_mcp": result.get("_via_mcp"),
            "intended_request": result.get("intended_request"),
            "mcp_error": result.get("_mcp_error"),
        },
    )
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    return db.execute(select(Campaign).order_by(Campaign.id.desc())).scalars().all()
