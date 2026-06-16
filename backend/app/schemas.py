"""Pydantic request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Leads -----------------------------------------------------------------

class LeadCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    source: str = "website_form"
    budget_eur: int = 0
    financing_preapproved: bool = False
    desired_location: str = ""
    property_type: str = ""
    timeline: str = "exploring"
    notes: str = ""


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    full_name: str
    email: str
    phone: str
    source: str
    budget_eur: int
    financing_preapproved: bool
    desired_location: str
    property_type: str
    timeline: str
    notes: str
    qualification_status: str
    qualification_score: int
    qualification_reasons: list
    outreach_email: str


class EmailOut(BaseModel):
    lead_id: int
    email: str
    model: str
    is_mock: bool


# --- Creatives -------------------------------------------------------------

class CreativeCreate(BaseModel):
    lead_id: int | None = None
    audience: str = Field(
        default="",
        description="Target audience description; defaults to the lead profile.",
    )


class CreativeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    lead_id: int | None
    audience: str
    headline: str
    primary_text: str
    image_prompt: str
    model: str
    is_mock: bool
    status: str
    approved_by: str
    approved_at: datetime | None


# --- Campaigns -------------------------------------------------------------

class CampaignCreate(BaseModel):
    creative_id: int
    name: str
    objective: str = "OUTCOME_TRAFFIC"
    daily_budget_eur: int = 10


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    creative_id: int
    name: str
    objective: str
    daily_budget_eur: int
    status: str
    external_campaign_id: str
    mode: str
    via_mcp: bool
    launched_by: str
    launched_at: datetime | None
    insights: dict | None


# --- Audit -----------------------------------------------------------------

class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ts: datetime
    actor: str
    action: str
    category: str
    resource_type: str
    resource_id: str
    prompt: str | None
    model: str | None
    output: str | None
    event_metadata: dict
    prev_hash: str
    hash: str


class VerifyOut(BaseModel):
    valid: bool
    count: int
    broken_at: int | None = None
    detail: str
