"""Shared FastAPI dependencies."""
from fastapi import Header

from .config import settings


def get_actor(x_actor: str | None = Header(default=None)) -> str:
    """Identify the actor for the audit trail.

    A real deployment derives this from the authenticated SSO/JWT session
    (Layer A in the brief). For the slice we accept an optional X-Actor header
    and fall back to a configured default, so every audited action still has a
    named actor.
    """
    return x_actor or settings.default_actor
