"""SQLAlchemy ORM models.

Four business tables (Lead, Creative, Campaign) plus the append-only
AuditEvent. The audit table is never updated or deleted in application code,
and the database enforces that too (see database.install_audit_immutability).
"""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(50), default="")
    source: Mapped[str] = mapped_column(String(80), default="website_form")
    budget_eur: Mapped[int] = mapped_column(Integer, default=0)
    financing_preapproved: Mapped[bool] = mapped_column(Boolean, default=False)
    desired_location: Mapped[str] = mapped_column(String(120), default="")
    property_type: Mapped[str] = mapped_column(String(60), default="")
    timeline: Mapped[str] = mapped_column(String(40), default="exploring")
    notes: Mapped[str] = mapped_column(Text, default="")

    qualification_status: Mapped[str] = mapped_column(String(20), default="pending")
    qualification_score: Mapped[int] = mapped_column(Integer, default=0)
    qualification_reasons: Mapped[list] = mapped_column(JSON, default=list)
    outreach_email: Mapped[str] = mapped_column(Text, default="")


class Creative(Base):
    __tablename__ = "creatives"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True)
    audience: Mapped[str] = mapped_column(String(300), default="")
    headline: Mapped[str] = mapped_column(String(300), default="")
    primary_text: Mapped[str] = mapped_column(Text, default="")
    image_prompt: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(80), default="")
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)

    # Human-in-the-loop gate: pending_approval -> approved | rejected
    status: Mapped[str] = mapped_column(String(20), default="pending_approval")
    approved_by: Mapped[str] = mapped_column(String(120), default="")
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    creative_id: Mapped[int] = mapped_column(ForeignKey("creatives.id"))
    name: Mapped[str] = mapped_column(String(200))
    objective: Mapped[str] = mapped_column(String(60), default="OUTCOME_TRAFFIC")
    daily_budget_eur: Mapped[int] = mapped_column(Integer, default=10)

    # created_paused -> launched (the human gate before spend) | failed
    status: Mapped[str] = mapped_column(String(20), default="created_paused")
    external_campaign_id: Mapped[str] = mapped_column(String(120), default="")
    mode: Mapped[str] = mapped_column(String(20), default="sandbox")  # sandbox | live
    via_mcp: Mapped[bool] = mapped_column(Boolean, default=True)
    launched_by: Mapped[str] = mapped_column(String(120), default="")
    launched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    insights: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class AuditEvent(Base):
    """Append-only, hash-chained audit record.

    Each row stores the hash of the previous row (prev_hash) and its own hash
    over its content + prev_hash, forming a tamper-evident chain. Any edit to a
    historical row breaks every subsequent hash, which /audit/verify detects.
    """

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40))  # ai | ad_account | data | governance
    resource_type: Mapped[str] = mapped_column(String(60), default="")
    resource_id: Mapped[str] = mapped_column(String(60), default="")

    # Populated for AI calls (EU AI Act requirement): prompt, model, output.
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    output: Mapped[str | None] = mapped_column(Text, nullable=True)

    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))
