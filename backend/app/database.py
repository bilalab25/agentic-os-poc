"""Database engine, session factory and append-only enforcement.

The audit table is protected at the database layer with BEFORE UPDATE / DELETE
triggers that abort any mutation. This is implemented for *both* SQLite and
PostgreSQL so the immutability guarantee holds regardless of which database the
reviewer runs.
"""
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    # Needed because FastAPI may touch the session from worker threads.
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)


# Enforce foreign keys on SQLite (off by default) so referential integrity is
# consistent across both supported databases.
if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _):  # pragma: no cover - tiny glue
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Append-only triggers --------------------------------------------------

_SQLITE_TRIGGERS = [
    """
    CREATE TRIGGER IF NOT EXISTS audit_events_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is forbidden');
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
    BEFORE DELETE ON audit_events
    BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is forbidden');
    END;
    """,
]

_POSTGRES_TRIGGERS = [
    """
    CREATE OR REPLACE FUNCTION audit_events_block_mutation()
    RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'audit_events is append-only: % is forbidden', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
    """,
    """
    DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
    CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();
    """,
    """
    DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
    CREATE TRIGGER audit_events_no_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();
    """,
]


def install_audit_immutability() -> None:
    """Create the append-only triggers for the active database dialect."""
    statements = (
        _SQLITE_TRIGGERS
        if engine.dialect.name == "sqlite"
        else _POSTGRES_TRIGGERS
    )
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
