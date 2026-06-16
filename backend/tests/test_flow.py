"""End-to-end test of the four-capability vertical slice."""


def _qualified_lead(client) -> dict:
    leads = client.get("/leads").json()
    return next(l for l in leads if l["qualification_status"] == "qualified")


def _unqualified_lead(client) -> dict:
    leads = client.get("/leads").json()
    return next(l for l in leads if l["qualification_status"] == "not_qualified")


def test_full_slice(client):
    # 1. Lead capture + qualification
    seeded = client.post("/leads/seed").json()
    assert len(seeded) == 4
    qualified = _qualified_lead(client)

    # 2. AI outreach email for a qualified lead
    email = client.post(f"/leads/{qualified['id']}/email").json()
    assert email["lead_id"] == qualified["id"]
    assert email["email"]
    assert email["is_mock"] is True  # mock provider in tests

    # 3. AI creative + human approval gate
    creative = client.post("/creatives", json={"lead_id": qualified["id"]}).json()
    assert creative["status"] == "pending_approval"

    approved = client.post(f"/creatives/{creative['id']}/approve").json()
    assert approved["status"] == "approved"
    assert approved["approved_by"]

    # 4. Meta Ads via MCP: create (paused) -> launch (human gate) -> insights
    campaign = client.post(
        "/campaigns",
        json={"creative_id": creative["id"], "name": "Lisbon Q3", "daily_budget_eur": 15},
    ).json()
    assert campaign["status"] == "created_paused"
    assert campaign["external_campaign_id"]
    assert campaign["mode"] == "sandbox"

    launched = client.post(f"/campaigns/{campaign['id']}/launch").json()
    assert launched["status"] == "launched"
    assert launched["launched_by"]

    insights = client.post(f"/campaigns/{campaign['id']}/insights").json()
    assert insights["insights"]["impressions"] > 0

    # Governance: every AI + ad-account action is in the chain, which verifies.
    actions = {e["action"] for e in client.get("/audit").json()}
    assert {
        "LEAD_CREATED",
        "LEAD_QUALIFIED",
        "AI_EMAIL_GENERATED",
        "AI_CREATIVE_GENERATED",
        "CREATIVE_APPROVED",
        "ADS_CAMPAIGN_CREATED",
        "ADS_CAMPAIGN_LAUNCHED",
        "ADS_INSIGHTS_FETCHED",
    } <= actions

    assert client.get("/audit/verify").json()["valid"] is True


def test_email_blocked_for_unqualified_lead(client):
    client.post("/leads/seed")
    lead = _unqualified_lead(client)
    resp = client.post(f"/leads/{lead['id']}/email")
    assert resp.status_code == 409


def test_campaign_blocked_until_creative_approved(client):
    client.post("/leads/seed")
    lead = _qualified_lead(client)
    creative = client.post("/creatives", json={"lead_id": lead["id"]}).json()
    # Not approved yet -> campaign creation must be refused.
    resp = client.post(
        "/campaigns", json={"creative_id": creative["id"], "name": "Should fail"}
    )
    assert resp.status_code == 409
