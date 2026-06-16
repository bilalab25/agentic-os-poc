"""Pytest fixtures.

Environment is configured for deterministic, offline tests *before* the app is
imported: SQLite, the mock LLM provider, and in-process Meta Ads tools (MCP
transport disabled so tests don't spawn subprocesses).
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_agentic_os.db")
os.environ["LLM_PROVIDER"] = "mock"
os.environ["MCP_ENABLED"] = "false"
os.environ["META_LIVE"] = "false"
os.environ["QUALIFICATION_MIN_SCORE"] = "60"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def client():
    # Fresh schema per test (DROP is DDL, so the append-only triggers don't
    # block it; row-level DELETE/UPDATE still would).
    from app.database import engine, install_audit_immutability
    from app.main import app
    from app.models import Base

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    install_audit_immutability()

    with TestClient(app) as c:
        yield c
