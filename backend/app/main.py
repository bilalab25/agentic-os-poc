"""FastAPI application entrypoint for the Agentic OS commercial-layer slice."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, install_audit_immutability
from .models import Base
from .routers import audit_log, campaigns, creatives, leads


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create schema and lock the audit table as append-only at the DB layer.
    Base.metadata.create_all(bind=engine)
    install_audit_immutability()
    yield


app = FastAPI(
    title="Agentic OS — Commercial Layer (Technical Test)",
    version="1.0.0",
    description=(
        "Vertical slice connecting lead qualification, AI outreach email, AI "
        "ad-creative generation with a human-approval gate, and Meta Ads via "
        "MCP — all governed by an append-only, hash-chained audit trail."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads.router)
app.include_router(creatives.router)
app.include_router(campaigns.router)
app.include_router(audit_log.router)


@app.get("/health", tags=["meta"])
def health():
    provider = "anthropic" if settings.anthropic_api_key and settings.llm_provider in {"auto", "anthropic"} else "mock"
    return {
        "status": "ok",
        "database": engine.dialect.name,
        "llm_provider": provider,
        "mcp_enabled": settings.mcp_enabled,
        "meta_mode": "live" if settings.meta_live else "sandbox",
    }


@app.get("/", tags=["meta"])
def root():
    return {"service": "agentic-os-poc", "docs": "/docs", "health": "/health"}
