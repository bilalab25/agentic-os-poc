"""AI generation services: outreach email and ad creative.

Both go through the same path: build a prompt -> call the active LLM provider ->
record the call in the audit trail (prompt, model, output, actor, timestamp).
That audit write is not optional and not a side-channel; it is the point.
"""
from __future__ import annotations

import json
import re

from sqlalchemy.orm import Session

from . import audit, llm
from .models import Creative, Lead

EMAIL_SYSTEM = (
    "You are an outreach assistant for a boutique Lisbon real estate "
    "consultancy. Write a short (max ~120 words), warm, professional outreach "
    "email in English to a qualified lead. Personalise it with the lead's "
    "data. Include one clear call to action to book a consultation. Do not "
    "invent facts not provided. Be GDPR-respectful: no pressure tactics, and "
    "note they can unsubscribe at any time."
)

CREATIVE_SYSTEM = (
    "You are a marketing creative assistant for a boutique Lisbon real estate "
    "consultancy. Generate exactly one ad creative. Return ONLY valid JSON "
    'with keys: "headline" (<=40 chars), "primary_text" (<=125 chars), '
    '"image_prompt" (a vivid prompt for an image model). Tone: trustworthy, '
    "premium, never pushy."
)


def _lead_brief(lead: Lead) -> str:
    return (
        f"Name: {lead.full_name}\n"
        f"Budget (EUR): {lead.budget_eur}\n"
        f"Financing pre-approved: {lead.financing_preapproved}\n"
        f"Desired location: {lead.desired_location or 'n/a'}\n"
        f"Property type: {lead.property_type or 'n/a'}\n"
        f"Timeline: {lead.timeline}\n"
        f"Source: {lead.source}\n"
        f"Notes: {lead.notes or 'n/a'}"
    )


def generate_email(db: Session, lead: Lead, actor: str) -> llm.LLMResult:
    prompt = f"Write an outreach email to this lead:\n\n{_lead_brief(lead)}"
    result = llm.get_provider().generate(prompt, system=EMAIL_SYSTEM)

    audit.record(
        db,
        actor=actor,
        action="AI_EMAIL_GENERATED",
        category="ai",
        resource_type="lead",
        resource_id=lead.id,
        prompt=prompt,
        model=result.model,
        output=result.text,
        metadata={"is_mock": result.is_mock, "system": EMAIL_SYSTEM},
    )
    lead.outreach_email = result.text
    db.add(lead)
    return result


def _parse_creative(text: str) -> dict:
    """Best-effort JSON extraction with a safe fallback."""
    candidate = text.strip()
    match = re.search(r"\{.*\}", candidate, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            return {
                "headline": str(data.get("headline", ""))[:300] or "Find your next home in Lisbon",
                "primary_text": str(data.get("primary_text", ""))[:1000] or candidate[:200],
                "image_prompt": str(data.get("image_prompt", ""))[:1000],
            }
        except json.JSONDecodeError:
            pass
    return {
        "headline": "Find your next home in Lisbon",
        "primary_text": candidate[:200],
        "image_prompt": "",
    }


def generate_creative(
    db: Session, *, audience: str, lead: Lead | None, actor: str
) -> Creative:
    audience = audience or (
        f"Prospective buyers similar to {lead.full_name} "
        f"({lead.property_type or 'property'} in {lead.desired_location or 'Lisbon'})"
        if lead
        else "Prospective property buyers in Lisbon"
    )
    prompt = f"Audience: {audience}\nGenerate one ad creative as JSON."
    result = llm.get_provider().generate(prompt, system=CREATIVE_SYSTEM)
    parsed = _parse_creative(result.text)

    creative = Creative(
        lead_id=lead.id if lead else None,
        audience=audience,
        headline=parsed["headline"],
        primary_text=parsed["primary_text"],
        image_prompt=parsed["image_prompt"],
        model=result.model,
        is_mock=result.is_mock,
        status="pending_approval",
    )
    db.add(creative)
    db.flush()

    audit.record(
        db,
        actor=actor,
        action="AI_CREATIVE_GENERATED",
        category="ai",
        resource_type="creative",
        resource_id=creative.id,
        prompt=prompt,
        model=result.model,
        output=result.text,
        metadata={"is_mock": result.is_mock, "system": CREATIVE_SYSTEM},
    )
    return creative
