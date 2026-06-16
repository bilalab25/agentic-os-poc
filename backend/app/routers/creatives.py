"""Capability 3: AI ad-creative generation with a human-approval gate."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..database import get_db
from ..deps import get_actor
from ..generation import generate_creative
from ..models import Creative, Lead
from ..schemas import CreativeCreate, CreativeOut

router = APIRouter(prefix="/creatives", tags=["creatives"])


@router.post("", response_model=CreativeOut)
def create_creative(
    payload: CreativeCreate, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    lead = None
    if payload.lead_id is not None:
        lead = db.get(Lead, payload.lead_id)
        if not lead:
            raise HTTPException(404, "Lead not found")
    creative = generate_creative(db, audience=payload.audience, lead=lead, actor=actor)
    db.commit()
    db.refresh(creative)
    return creative


@router.get("", response_model=list[CreativeOut])
def list_creatives(db: Session = Depends(get_db)):
    return db.execute(select(Creative).order_by(Creative.id.desc())).scalars().all()


@router.post("/{creative_id}/approve", response_model=CreativeOut)
def approve_creative(
    creative_id: int, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    creative = db.get(Creative, creative_id)
    if not creative:
        raise HTTPException(404, "Creative not found")
    if creative.status != "pending_approval":
        raise HTTPException(409, f"Creative is already '{creative.status}'")
    creative.status = "approved"
    creative.approved_by = actor
    creative.approved_at = datetime.now(timezone.utc)
    db.add(creative)
    audit.record(
        db,
        actor=actor,
        action="CREATIVE_APPROVED",
        category="governance",
        resource_type="creative",
        resource_id=creative.id,
        metadata={"human_in_the_loop": True},
    )
    db.commit()
    db.refresh(creative)
    return creative


@router.post("/{creative_id}/reject", response_model=CreativeOut)
def reject_creative(
    creative_id: int, db: Session = Depends(get_db), actor: str = Depends(get_actor)
):
    creative = db.get(Creative, creative_id)
    if not creative:
        raise HTTPException(404, "Creative not found")
    if creative.status != "pending_approval":
        raise HTTPException(409, f"Creative is already '{creative.status}'")
    creative.status = "rejected"
    db.add(creative)
    audit.record(
        db,
        actor=actor,
        action="CREATIVE_REJECTED",
        category="governance",
        resource_type="creative",
        resource_id=creative.id,
        metadata={"human_in_the_loop": True},
    )
    db.commit()
    db.refresh(creative)
    return creative
