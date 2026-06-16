"""Append-only, hash-chained audit service — the governance backbone.

Every AI invocation and every ad-account action is recorded here. The chain is
tamper-evident: each event hashes its own content together with the previous
event's hash. `verify_chain` recomputes the whole chain and reports the first
break, so even a mutation that bypassed the database triggers would be caught.
"""
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditEvent

GENESIS_HASH = "0" * 64


def _ts_key(ts: datetime) -> str:
    """Stable UTC timestamp string for hashing.

    We always persist UTC. SQLite returns naive datetimes (tz dropped) while
    Postgres returns tz-aware ones, so we normalise both to naive-UTC with
    fixed microsecond precision. This makes the hash identical whether computed
    at write time or recomputed from a DB read on either backend.
    """
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
    return ts.isoformat(timespec="microseconds")


def _canonical_payload(
    *,
    ts: datetime,
    actor: str,
    action: str,
    category: str,
    resource_type: str,
    resource_id: str,
    prompt: str | None,
    model: str | None,
    output: str | None,
    metadata: dict,
    prev_hash: str,
) -> str:
    """Deterministic JSON serialisation used as the hash pre-image."""
    payload = {
        "ts": _ts_key(ts),
        "actor": actor,
        "action": action,
        "category": category,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "prompt": prompt,
        "model": model,
        "output": output,
        "metadata": metadata or {},
        "prev_hash": prev_hash,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _hash(pre_image: str) -> str:
    return hashlib.sha256(pre_image.encode("utf-8")).hexdigest()


def record(
    db: Session,
    *,
    actor: str,
    action: str,
    category: str,
    resource_type: str = "",
    resource_id: str | int = "",
    prompt: str | None = None,
    model: str | None = None,
    output: str | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    """Append one event to the chain.

    Shares the caller's session so the business write and its audit record
    commit atomically. The previous-hash lookup assumes a single writer per
    chain tip (acceptable for this PoC; see ADR for the production approach).
    """
    last = db.execute(
        select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1)
    ).scalar_one_or_none()
    prev_hash = last.hash if last else GENESIS_HASH

    ts = datetime.now(timezone.utc)
    metadata = metadata or {}
    pre_image = _canonical_payload(
        ts=ts,
        actor=actor,
        action=action,
        category=category,
        resource_type=resource_type,
        resource_id=str(resource_id),
        prompt=prompt,
        model=model,
        output=output,
        metadata=metadata,
        prev_hash=prev_hash,
    )
    event = AuditEvent(
        ts=ts,
        actor=actor,
        action=action,
        category=category,
        resource_type=resource_type,
        resource_id=str(resource_id),
        prompt=prompt,
        model=model,
        output=output,
        event_metadata=metadata,
        prev_hash=prev_hash,
        hash=_hash(pre_image),
    )
    db.add(event)
    db.flush()
    return event


def verify_chain(db: Session) -> dict:
    """Recompute the entire chain and report integrity."""
    events = db.execute(select(AuditEvent).order_by(AuditEvent.id.asc())).scalars().all()
    expected_prev = GENESIS_HASH
    for ev in events:
        if ev.prev_hash != expected_prev:
            return {
                "valid": False,
                "count": len(events),
                "broken_at": ev.id,
                "detail": f"event {ev.id}: prev_hash link broken",
            }
        recomputed = _hash(
            _canonical_payload(
                ts=ev.ts,
                actor=ev.actor,
                action=ev.action,
                category=ev.category,
                resource_type=ev.resource_type,
                resource_id=ev.resource_id,
                prompt=ev.prompt,
                model=ev.model,
                output=ev.output,
                metadata=ev.event_metadata,
                prev_hash=ev.prev_hash,
            )
        )
        if recomputed != ev.hash:
            return {
                "valid": False,
                "count": len(events),
                "broken_at": ev.id,
                "detail": f"event {ev.id}: content hash mismatch (tampering detected)",
            }
        expected_prev = ev.hash
    return {
        "valid": True,
        "count": len(events),
        "broken_at": None,
        "detail": f"chain intact across {len(events)} events",
    }
