# Agentic OS — Commercial Layer (Technical Test)

A runnable **vertical slice** that connects the four capabilities of the initial
commercial scope, with **governance built in from the first commit**:

1. **Lead capture & qualification** — ingest a lead, store it, score it with a
   configurable rule engine (qualified / not qualified).
2. **AI outreach email** — generate a short, personalised email for a qualified
   lead via an LLM.
3. **AI ad creative** — generate ad copy (+ image prompt) via an LLM, with a
   **human approval gate** before it can be used.
4. **Meta Ads via MCP** — create a campaign from an approved creative through a
   **real MCP server**, launch it behind a **human approval-before-spend** gate,
   and pull performance back into the platform.

Every **AI call** and every **ad-account action** is written to an
**append-only, hash-chained audit trail** that is enforced at the database layer
and independently verifiable. *This is the part that matters most, so it is the
backbone of the design, not a bolt-on.*

> **Stack:** Python / FastAPI · Next.js / React · SQLAlchemy · PostgreSQL
> (SQLite by default for a zero-setup run) · MCP (Model Context Protocol).

---

## TL;DR — run it in two terminals (no Docker, no API key required)

The app runs **fully offline** out of the box: SQLite database, a deterministic
**mock LLM**, and **sandbox** Meta Ads. Add an Anthropic key for real LLM output.

### 1. Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate     macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend is now at `http://localhost:8000` (interactive docs at `/docs`).

### 2. Frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** and click through:
**Seed sample leads → Generate email → Generate creative → Approve →
Create campaign → Launch → Insights → Verify chain.**

### Want real LLM output?

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

Restart the backend. The audit trail records the real model and prompt; mock
output is always flagged `is_mock=true` and never disguised as real.

### Or with Docker (PostgreSQL + backend + frontend)

```bash
docker compose up --build
# frontend http://localhost:3000 · backend http://localhost:8000
```

### Deploy a live demo (Render)

A one-click-ish **`render.yaml`** blueprint deploys Postgres + backend + frontend.
Push to GitHub → Render → **New + → Blueprint** → pick the repo → set
`ANTHROPIC_API_KEY`. Full click-by-click in **[`DEPLOY.md`](./DEPLOY.md)**.

---

## Prove it works without the UI

```bash
cd backend

# 1. Automated tests (10 tests: qualification, append-only enforcement,
#    tamper detection, full four-capability flow)
pytest -q

# 2. The MCP server over stdio, standalone (create → activate → insights)
python scripts/mcp_demo.py

# 3. End-to-end smoke test against a running server (real MCP path)
#    (start uvicorn first, then:)
python scripts/smoke_test.py
```

---

## How governance is implemented (the 25%)

| Requirement | Where / how |
|---|---|
| Every AI call logged (prompt, model, output, timestamp, actor) | `app/generation.py` → `app/audit.py` |
| Every ad-account action logged (incl. the exact Graph API request) | `app/routers/campaigns.py` → `app/audit.py` |
| Append-only — no UPDATE / DELETE | DB triggers in `app/database.py` (SQLite **and** Postgres) |
| Tamper-evident | SHA-256 **hash chain**: each event hashes its content + the previous hash (`app/audit.py`) |
| Independently verifiable | `GET /audit/verify` recomputes the whole chain and reports the first break |
| Human-in-the-loop | Creative approval gate + campaign launch (spend) gate |

Try it: in the UI click **Verify chain** (shows `CHAIN INTACT`). The test
`tests/test_audit_chain.py::test_tampering_breaks_the_hash_chain` drops the guard
trigger, edits a historical row, and shows `verify` then reports
`TAMPER DETECTED` at the exact event.

---

## What is real vs stubbed (honesty)

| Component | Status |
|---|---|
| FastAPI backend, CRM/lead data model, rule engine, audit trail | **Real** |
| Next.js dashboard | **Real** |
| Append-only DB enforcement + hash chain + verifier | **Real** |
| LLM | **Real** when `ANTHROPIC_API_KEY` is set; otherwise a clearly-flagged **deterministic mock** so the slice runs offline |
| MCP server + client (stdio) | **Real** — the backend genuinely talks to an MCP server process |
| Meta Graph API call | **Sandbox by default**: builds and logs the *exact* request it would send and returns a simulated id. Set `META_LIVE=true` + credentials to make real calls. Campaigns are always created **PAUSED**; nothing can spend without an explicit human launch. |

Nothing fake is presented as real; the audit trail records `mode`
(sandbox/live) and `via_mcp` on every ad-account action.

---

## API summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/leads` · `/leads/seed` | Create / seed leads (auto-qualified) |
| POST | `/leads/{id}/email` | Generate outreach email (qualified only) |
| POST | `/creatives` | Generate ad creative (pending approval) |
| POST | `/creatives/{id}/approve` | **Human gate** |
| POST | `/campaigns` | Create Meta campaign (approved creative only, PAUSED) |
| POST | `/campaigns/{id}/launch` | **Human gate — approve spend** |
| POST | `/campaigns/{id}/insights` | Pull performance back |
| GET | `/audit` · `/audit/verify` | Read trail · verify chain integrity |

---

## Project layout

```
backend/
  app/
    main.py            FastAPI app + lifespan (schema + audit triggers)
    config.py          env-driven settings (nothing hardcoded)
    database.py        engine + append-only triggers (sqlite & postgres)
    models.py          Lead, Creative, Campaign, AuditEvent
    audit.py           append-only, hash-chained audit service + verifier
    qualification.py   configurable rule engine
    llm.py             provider abstraction (Anthropic | Mock)
    generation.py      email + creative generation (-> audit)
    meta_ads_core.py   Meta Ads logic (sandbox/live)
    mcp_client.py      MCP client (stdio) with transparent fallback
    routers/           leads, creatives, campaigns, audit_log
  mcp_server/
    meta_ads_server.py MCP server exposing the Meta Ads tools
  scripts/             mcp_demo.py, smoke_test.py
  tests/               qualification, audit chain/tamper, full flow
frontend/
  app/                 Next.js dashboard (single governed control panel)
docs/
  ADR.md               architecture decisions & trade-offs
  VIDEO_SCRIPT.md      5-minute walkthrough script
```

See **`docs/ADR.md`** for the architectural reasoning and how this scales from
proof-of-concept to the real initial scope.

### Assumptions
- **SQLite by default** for a zero-friction clean-clone run (the brief permits
  this if stated). The code is database-agnostic; `docker compose` runs Postgres,
  and the append-only guarantee is implemented for both.
- LLM provider defaults to Anthropic; any provider can be added behind the same
  `LLMProvider` interface.
