"""Configurable lead-qualification rule engine.

Rules are declarative and live in one place so they can be tuned without
touching endpoint code (in production these would move to the database / admin
UI). Each rule contributes points; a lead at or above the threshold is
qualified, with a human-readable reason recorded for every rule for audit and
explainability.
"""
from dataclasses import dataclass
from typing import Callable

from .config import settings


@dataclass
class Rule:
    key: str
    points: int
    test: Callable[[dict], bool]
    explain: str


# Declarative rule set. Total available points = 100.
RULES: list[Rule] = [
    Rule(
        key="budget_strong",
        points=35,
        test=lambda l: l.get("budget_eur", 0) >= 300_000,
        explain="Budget >= EUR 300k",
    ),
    Rule(
        key="budget_moderate",
        points=20,
        test=lambda l: 150_000 <= l.get("budget_eur", 0) < 300_000,
        explain="Budget EUR 150k-300k",
    ),
    Rule(
        key="financing_preapproved",
        points=25,
        test=lambda l: bool(l.get("financing_preapproved")),
        explain="Financing pre-approved",
    ),
    Rule(
        key="timeline_hot",
        points=20,
        test=lambda l: l.get("timeline") in {"immediate", "3_months"},
        explain="Ready to act within 3 months",
    ),
    Rule(
        key="location_known",
        points=10,
        test=lambda l: bool(l.get("desired_location")),
        explain="Target location specified",
    ),
    Rule(
        key="property_type_known",
        points=10,
        test=lambda l: bool(l.get("property_type")),
        explain="Property type specified",
    ),
]


def qualify(lead: dict) -> dict:
    """Score a lead dict and return status, score and per-rule reasons."""
    score = 0
    reasons: list[dict] = []
    for rule in RULES:
        passed = bool(rule.test(lead))
        if passed:
            score += rule.points
        reasons.append(
            {
                "rule": rule.key,
                "passed": passed,
                "points": rule.points if passed else 0,
                "explain": rule.explain,
            }
        )
    threshold = settings.qualification_min_score
    status = "qualified" if score >= threshold else "not_qualified"
    return {
        "status": status,
        "score": score,
        "threshold": threshold,
        "reasons": reasons,
    }
