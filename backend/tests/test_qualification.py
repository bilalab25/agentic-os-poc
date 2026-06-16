"""Unit tests for the qualification rule engine."""
from app.qualification import qualify


def test_strong_lead_qualifies():
    result = qualify(
        {
            "budget_eur": 450_000,
            "financing_preapproved": True,
            "timeline": "immediate",
            "desired_location": "Lisbon",
            "property_type": "apartment",
        }
    )
    assert result["status"] == "qualified"
    assert result["score"] == 100


def test_weak_lead_not_qualified():
    result = qualify(
        {
            "budget_eur": 95_000,
            "financing_preapproved": False,
            "timeline": "exploring",
            "desired_location": "",
            "property_type": "",
        }
    )
    assert result["status"] == "not_qualified"
    assert result["score"] < 60


def test_reasons_cover_every_rule():
    result = qualify({"budget_eur": 0})
    keys = {r["rule"] for r in result["reasons"]}
    assert {
        "budget_strong",
        "budget_moderate",
        "financing_preapproved",
        "timeline_hot",
        "location_known",
        "property_type_known",
    } <= keys
