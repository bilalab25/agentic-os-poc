"""Application configuration, loaded from environment variables / .env.

Everything that varies between environments (DB, LLM provider, Meta Ads
credentials, governance actor) is centralised here so nothing is hardcoded.
"""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Database -----------------------------------------------------------
    # Default is SQLite for a zero-setup clean-clone run (documented in README
    # as an explicit assumption). Point DATABASE_URL at Postgres for the
    # production-shaped path, e.g.
    #   postgresql+psycopg2://agentic:agentic@localhost:5432/agentic_os
    database_url: str = "sqlite:///./agentic_os.db"

    # --- LLM ---------------------------------------------------------------
    # "auto"  -> use Anthropic if a key is present, otherwise the offline mock
    # "anthropic" -> force Anthropic (errors surfaced if no key)
    # "mock"  -> force the deterministic offline provider
    llm_provider: str = "auto"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"
    llm_max_tokens: int = 600

    # --- Lead qualification ------------------------------------------------
    qualification_min_score: int = 60

    # --- Meta Ads / MCP ----------------------------------------------------
    # The Meta Ads tools are exposed through a real MCP server (stdio). The
    # backend acts as an MCP client. Set MCP_ENABLED=false to call the same
    # tool logic in-process (useful for CI / constrained environments).
    mcp_enabled: bool = True
    # When META_LIVE is false (default) the integration runs in sandbox mode:
    # it builds and logs the exact Graph API request it *would* send and
    # returns a simulated campaign id. No real ad spend is ever possible.
    meta_live: bool = False
    meta_access_token: str = ""
    meta_ad_account_id: str = ""
    meta_api_version: str = "v21.0"

    # --- Governance --------------------------------------------------------
    # Default actor recorded in the audit trail when no X-Actor header is sent.
    default_actor: str = "demo@dezy.local"

    # --- CORS --------------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Managed providers (e.g. Render) hand out `postgres://` URLs, but
        # SQLAlchemy 2.x needs an explicit driver. Normalise to psycopg2.
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg2://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
