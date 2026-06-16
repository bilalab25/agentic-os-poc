"""Capability 1: lead capture + qualification, and outreach email generation."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..database import get_db
from ..deps import get_actor
from ..generation import generate_email
from ..models import Lead
from ..qualification import qualify
from ..schemas import EmailOut, LeadCreate, LeadOut
from ..seed import SAMPLE_LEADS

router = APIRouter(prefix="/leads", tags=["leads"])


def _create_lead(db: Session, payload: dict, actor: str) -> Lead:
    result = qualify(payload)
    lead = Lead(
        full_name=payload["full_name"],
        email=payload["email"],
        phone=payload.get("phone", ""),
        source=payload.get("source", "website_form"),
        budget_eur=payload.get("budget_eur", 0),
        financing_preapproved=payload.get("financing_preapproved", False),
        desired_location=payload.get("desired_location", ""),
        property_type=payload.get("property_type", ""),
        timeline=payload.get("timeline", "exploring"),
        notes=payload.get("notes", ""),
        qualification_status=result["status"],
        qualification_score=result["score"],
        qualification_reasons=result["reasons"],
    )
    db.add(lead)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="LEAD_CREATED",
        category="data",
        resource_type="lead",
        resource_id=lead.id,
        metadata={"source": lead.source},
    )
    audit.record(
        db,
        actor=actor,
        action="LEAD_QUALIFIED",
        category="data",
        resource_type="lead",
        resource_id=lead.id,
        output=f"{result['status']} (score {result['score']}/{result['threshold']})",
        metadata={"score": result["score"], "reasons": result["reasons"]},
    )
    return lead


@router.post("", response_model=LeadOut)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db), actor: str = Depends(get_actor)):
    lead = _create_lead(db, payload.model_dump(), actor)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/seed", response_model=list[LeadOut])
def seed_leads(db: Session = Depends(get_db), actor: str = Depends(get_actor)):
    created = [_create_lead(db, data, actor) for data in SAMPLE_LEADS]
    db.commit()
    for lead in created:
        db.refresh(lead)
    return created


@router.get("", response_model=list[LeadOut])
def list_leads(db: Session = Depends(get_db)):
    return db.execute(select(Lead).order_by(Lead.id.desc())).scalars().all()


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.post("/{lead_id}/email", response_model=EmailOut)
def create_outreach_email(
    lead_id: int, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.qualification_status != "qualified":
        raise HTTPException(409, "Email generation is only allowed for qualified leads")
    result = generate_email(db, lead, actor)
    db.commit()
    return EmailOut(lead_id=lead.id, email=result.text, model=result.model, is_mock=result.is_mock)
