"""Audit-trail governance tests: append-only enforcement + tamper detection."""
import pytest


def test_chain_valid_after_activity(client):
    client.post("/leads/seed")
    verify = client.get("/audit/verify").json()
    assert verify["valid"] is True
    assert verify["count"] > 0
    assert verify["broken_at"] is None


def test_update_is_blocked_by_database(client):
    """The DB trigger must reject any UPDATE on audit_events."""
    from sqlalchemy import text

    from app.database import engine

    client.post("/leads/seed")
    with pytest.raises(Exception) as exc:
        with engine.begin() as conn:
            conn.execute(text("UPDATE audit_events SET actor='hacker' WHERE id=1"))
    assert "append-only" in str(exc.value).lower()


def test_delete_is_blocked_by_database(client):
    from sqlalchemy import text

    from app.database import engine

    client.post("/leads/seed")
    with pytest.raises(Exception) as exc:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM audit_events WHERE id=1"))
    assert "append-only" in str(exc.value).lower()


def test_tampering_breaks_the_hash_chain(client):
    """If a row is mutated by bypassing the trigger, verify must catch it."""
    from sqlalchemy import text

    from app.database import engine

    client.post("/leads/seed")
    assert client.get("/audit/verify").json()["valid"] is True

    # Simulate an attacker who drops the guard trigger and edits history.
    with engine.begin() as conn:
        conn.execute(text("DROP TRIGGER IF EXISTS audit_events_no_update"))
        conn.execute(text("UPDATE audit_events SET output='forged' WHERE id=2"))

    verify = client.get("/audit/verify").json()
    assert verify["valid"] is False
    assert verify["broken_at"] == 2
