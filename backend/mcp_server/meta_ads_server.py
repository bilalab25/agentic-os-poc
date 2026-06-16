"""Meta Ads MCP server (stdio).

Exposes the Meta Ads operations as MCP tools so any MCP host — this platform's
backend, Claude Desktop, or another agent — can drive ad-account actions
through a governed interface. The tool logic lives in app.meta_ads_core; this
file is the MCP surface over it.

Run standalone:  python mcp_server/meta_ads_server.py
"""
import json
import os
import sys

# Make the sibling `app` package importable regardless of how we are launched.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from app import meta_ads_core  # noqa: E402

mcp = FastMCP("meta-ads")


@mcp.tool()
def create_campaign(
    name: str, objective: str = "OUTCOME_TRAFFIC", daily_budget_eur: int = 10
) -> str:
    """Create a PAUSED Meta Ads campaign. Returns a JSON result including the
    exact Graph API request that was (or would be) sent."""
    return json.dumps(
        meta_ads_core.create_campaign(
            name=name, objective=objective, daily_budget_eur=daily_budget_eur
        )
    )


@mcp.tool()
def activate_campaign(external_campaign_id: str) -> str:
    """Activate (launch) a previously created campaign. This is the
    spend-enabling step and must follow a human approval in the platform."""
    return json.dumps(meta_ads_core.activate_campaign(external_campaign_id=external_campaign_id))


@mcp.tool()
def get_insights(external_campaign_id: str) -> str:
    """Fetch campaign performance metrics for reporting inside the platform."""
    return json.dumps(meta_ads_core.get_insights(external_campaign_id=external_campaign_id))


if __name__ == "__main__":
    mcp.run()
