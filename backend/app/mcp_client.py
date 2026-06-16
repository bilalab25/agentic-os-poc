"""MCP client for the Meta Ads server.

The backend talks to the Meta Ads tools through a real MCP server over stdio
(the same transport Claude Desktop and other MCP hosts use). For environments
where spawning the subprocess is undesirable, MCP_ENABLED=false runs the
identical tool logic in-process. Either way the result carries `_via_mcp` so
the audit trail records exactly how the call was made — a stub is never
disguised as the real path.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from . import meta_ads_core
from .config import settings

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SERVER_SCRIPT = BACKEND_ROOT / "mcp_server" / "meta_ads_server.py"

_DIRECT = {
    "create_campaign": meta_ads_core.create_campaign,
    "activate_campaign": meta_ads_core.activate_campaign,
    "get_insights": meta_ads_core.get_insights,
}


async def _call_via_mcp(tool: str, args: dict[str, Any]) -> dict:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
        cwd=str(BACKEND_ROOT),
        env=os.environ.copy(),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool, args)
            text = "".join(
                block.text for block in result.content if getattr(block, "type", "") == "text"
            )
            return json.loads(text)


async def call_meta_tool(tool: str, args: dict[str, Any]) -> dict:
    """Invoke a Meta Ads tool, preferring MCP with a transparent fallback."""
    if settings.mcp_enabled:
        try:
            data = await _call_via_mcp(tool, args)
            data["_via_mcp"] = True
            return data
        except Exception as exc:  # never break the demo; record what happened
            data = _DIRECT[tool](**args)
            data["_via_mcp"] = False
            data["_mcp_error"] = f"{type(exc).__name__}: {exc}"
            return data

    data = _DIRECT[tool](**args)
    data["_via_mcp"] = False
    return data
