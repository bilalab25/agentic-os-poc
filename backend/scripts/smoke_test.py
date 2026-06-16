"""End-to-end smoke test against a running server (real MCP path).

Start the API first (uvicorn app.main:app), then run:
    python scripts/smoke_test.py
Optionally set API_BASE (default http://localhost:8000).
"""
import os
import sys

import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8000")


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=60) as c:
        health = c.get("/health").json()
        print("health:", health)

        leads = c.post("/leads/seed").json()
        qualified = [l for l in leads if l["qualification_status"] == "qualified"]
        print(f"seeded {len(leads)} leads, {len(qualified)} qualified")
        lead = qualified[0]

        email = c.post(f"/leads/{lead['id']}/email").json()
        print(f"email generated (model={email['model']}, mock={email['is_mock']})")

        creative = c.post("/creatives", json={"lead_id": lead["id"]}).json()
        print(f"creative #{creative['id']} status={creative['status']}")
        approved = c.post(f"/creatives/{creative['id']}/approve").json()
        print(f"creative #{approved['id']} status={approved['status']} by {approved['approved_by']}")

        camp = c.post(
            "/campaigns",
            json={"creative_id": creative["id"], "name": "Smoke — Lisbon", "daily_budget_eur": 12},
        ).json()
        print(
            f"campaign #{camp['id']} status={camp['status']} mode={camp['mode']} "
            f"via_mcp={camp['via_mcp']} id={camp['external_campaign_id']}"
        )
        launched = c.post(f"/campaigns/{camp['id']}/launch").json()
        print(f"campaign #{launched['id']} status={launched['status']} via_mcp={launched['via_mcp']}")
        insights = c.post(f"/campaigns/{camp['id']}/insights").json()
        print(f"insights: {insights['insights']}")

        verify = c.get("/audit/verify").json()
        events = c.get("/audit").json()
        print(f"audit: {verify['detail']} (valid={verify['valid']})")
        print(f"audit events recorded: {len(events)}")

        ok = (
            verify["valid"]
            and camp["via_mcp"] is True
            and camp["status"] == "created_paused"
            and launched["status"] == "launched"
            and insights["insights"]
        )
        print("\nSMOKE TEST:", "PASS" if ok else "FAIL")
        return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
