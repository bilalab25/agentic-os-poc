"""Audit trail read + chain verification endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..database import get_db
from ..models import AuditEvent
from ..schemas import AuditOut, VerifyOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut])
def list_audit(limit: int = 200, db: Session = Depends(get_db)):
    return (
        db.execute(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit))
        .scalars()
        .all()
    )


@router.get("/verify", response_model=VerifyOut)
def verify_audit(db: Session = Depends(get_db)):
    """Recompute the hash chain and report whether it is intact."""
    return audit.verify_chain(db)
