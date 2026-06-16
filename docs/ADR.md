# ADR — Agentic OS Commercial-Layer Slice

**Status:** Accepted (proof-of-concept) · **Date:** 2026-06 · **Author:** Dezy Solutions

This records the key decisions for the technical-test vertical slice and how the
approach scales to the real initial scope. It is deliberately short.

---

## Context

Connect four capabilities — lead qualification, AI outreach email, AI ad
creative (human-approved), and Meta Ads via MCP — in a runnable slice where
**governance is load-bearing**, not a feature. Governance and audit are weighted
highest and are an automatic fail if absent, so they drove the architecture.

## Decisions

**1. The audit trail is the spine, written through one service.**
Every AI call and ad-account action goes through `audit.record()`. The table is
**append-only at the database layer** (BEFORE UPDATE/DELETE triggers that abort —
implemented for *both* SQLite and Postgres) and **tamper-evident** via a SHA-256
**hash chain** (each row hashes its content + the previous row's hash).
`GET /audit/verify` recomputes the chain, so tampering is detectable even if an
attacker removes the triggers. This directly satisfies the EU AI Act logging /
reproducibility requirement and the ISO 9001 "auditable logs" posture in the brief.

**2. Layer the integrations behind interfaces.**
- *LLM* — a single `LLMProvider.generate()` with `Anthropic` and `Mock`
  implementations. The mock makes the slice run offline with **zero config**; it
  is always flagged `is_mock` so a stub is never disguised as real. Swapping or
  adding a provider (OpenAI, etc.) touches one file.
- *Meta Ads* — the tool logic lives in `meta_ads_core` and is exposed through a
  **real MCP server** (stdio). The backend is a real MCP client. This is the
  honest reading of "via MCP": a separate, governed tool surface any MCP host can
  drive — not a function renamed "MCP".

**3. Safety gates model the real money risk.**
Campaigns are always created **PAUSED**; a campaign can only be created from an
**approved** creative; "launch" is a **separate human action** that is the
approval-before-spend gate. In sandbox mode the system builds and logs the exact
Graph API request and returns a simulated id — no spend is possible.

**4. SQLite by default, Postgres-ready.**
Default to SQLite so the slice runs from a clean clone with no services. The code
is database-agnostic (SQLAlchemy); `docker compose` runs Postgres; the
append-only guarantee holds on both. The brief explicitly allows this if stated.

**5. Config over hardcoding.** Everything environmental (DB, provider, keys,
Meta creds, actor) comes from settings/env. No secrets in the repo.

## Trade-offs accepted (given the 8–10h box)

- **No auth/SSO yet.** Actor comes from an `X-Actor` header with a default. The
  audit schema already carries `actor` on every event, so real JWT/SSO (Layer A)
  drops in without schema change.
- **Single-writer hash chain.** `record()` reads the current tip then appends.
  Correct for the demo's sequential flow; concurrent writers could race (see below).
- **MCP client spawns the server per call** over stdio. Simple and robust across
  OSes; not the lowest-latency option. A transparent in-process fallback
  (`MCP_ENABLED=false`) keeps CI deterministic and records `via_mcp` honestly.
- **Image generation is a prompt, not pixels** (the brief makes the image
  optional). The creative includes an `image_prompt` ready for an image model.
- **Qualification rules are code-declared** (one module), not yet an admin UI.

## What I'd do with more time

- Serialize the chain tip with a Postgres advisory lock (or a single-writer
  append worker) and add a periodic Merkle checkpoint / external anchoring.
- Real JWT/OAuth2 + RBAC; derive `actor` from the session; scope every endpoint.
- Persist a long-lived MCP session with health checks and retries/back-off;
  expand tools (audiences, ad sets, creatives upload, spend caps).
- Move qualification rules to the DB with an admin editor and versioning.
- Outbox pattern for external calls (exactly-once, replayable), plus Alembic
  migrations instead of `create_all`.
- Frontend hardening: optimistic UI, error toasts, pagination on the audit view.

## How this scales to the real initial scope

The slice *is* a thin Layer B sitting on a (lightweight) Layer A:

- **Governance core → unchanged.** The append-only, hash-chained audit + the AI
  Governance Registry pattern (prompt/model/version/output per call) is exactly
  what Sprints 1–3 require; production adds RBAC, retention/erasure (RGPD) and
  explainability views on top of the same trail.
- **Provider & tool interfaces → extend, don't rebuild.** More LLM tasks and
  more MCP tools (full mass-email infra, additional ad platforms) are new
  implementations behind the existing abstractions.
- **Data model → grow.** `Lead/Creative/Campaign` become the commercial subset
  of the custom CRM; the same audit hooks extend to every new module.
- **Human-in-the-loop → generalise.** The approval-gate pattern becomes the
  reusable "human review before a formal/AI action" control the EU AI Act
  requires across the platform.
