"""Standalone proof that the Meta Ads MCP server works over stdio.

Run from the backend directory:  python scripts/mcp_demo.py

It launches the MCP server as a subprocess, lists the exposed tools, calls
create_campaign -> activate_campaign -> get_insights, and prints each result.
Handy for the video walkthrough to show the MCP layer independently of the API.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from mcp import ClientSession, StdioServerParameters  # noqa: E402
from mcp.client.stdio import stdio_client  # noqa: E402

SERVER = BACKEND_ROOT / "mcp_server" / "meta_ads_server.py"


async def main() -> None:
    params = StdioServerParameters(
        command=sys.executable, args=[str(SERVER)], cwd=str(BACKEND_ROOT), env=os.environ.copy()
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("MCP tools exposed:", [t.name for t in tools.tools])

            created = json.loads(
                (await session.call_tool("create_campaign", {"name": "Demo — Lisbon Q3"})).content[0].text
            )
            print("\ncreate_campaign ->")
            print(json.dumps(created, indent=2))

            cid = created["external_campaign_id"]
            activated = json.loads(
                (await session.call_tool("activate_campaign", {"external_campaign_id": cid})).content[0].text
            )
            print("\nactivate_campaign ->")
            print(json.dumps(activated, indent=2))

            insights = json.loads(
                (await session.call_tool("get_insights", {"external_campaign_id": cid})).content[0].text
            )
            print("\nget_insights ->")
            print(json.dumps(insights, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
