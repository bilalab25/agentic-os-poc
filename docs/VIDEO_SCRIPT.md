# 5-Minute Video Walkthrough — Script & Shot List

The brief: max 5 minutes, screen recording, (a) demo the slice end to end,
(b) show the audit log capturing AI + ad-account actions, (c) explain the single
most important architectural decision. **Concision is scored — rehearse once and
keep moving.** Suggested timings total ~4:40 to leave margin.

> Before recording: backend running (`uvicorn app.main:app --port 8000`),
> frontend running (`npm run dev`), browser at `http://localhost:3000`, and a
> terminal ready in `backend/`. Optionally set `ANTHROPIC_API_KEY` for real
> output (mention if you do).

---

### 0:00–0:30 — Frame it
> "This is a vertical slice of the Agentic OS commercial layer. It connects the
> four capabilities — lead qualification, AI outreach email, AI ad creative with
> human approval, and Meta Ads through MCP — and the thing holding it together is
> an append-only, hash-chained audit trail. I built the least amount of the right
> thing, with governance first."

Show the dashboard top: the **Governance** banner reading `CHAIN INTACT`, and the
status line (`db / llm / mcp / meta` mode).

### 0:30–1:30 — Capabilities 1 & 2 (leads + email)
- Click **Seed sample leads**. Point out scores and `qualified` vs `not_qualified`
  from the **configurable rule engine**.
- On a qualified lead click **Generate email** → read one line of the result.
- "That email was produced by an LLM call — and it's already in the audit trail
  with the prompt, model and actor. If no key is set it falls back to a mock,
  flagged as mock — never disguised."

### 1:30–2:30 — Capability 3 (creative + human gate)
- Click **+ creative** for a lead → a creative appears as `pending_approval`.
- "Nothing AI-generated goes live automatically. A human approves." Click
  **Approve** → status flips to `approved`, with the approver recorded.

### 2:30–3:30 — Capability 4 (Meta Ads via MCP)
- Click **+ campaign from creative** → campaign appears `created_paused`, with a
  `MCP` badge and `sandbox` mode and a Meta id.
- "Created paused — no spend possible. The backend called a **real MCP server**
  over stdio; the badge shows it went via MCP."
- Click **Launch (approve spend)** → `launched`. "That's the human
  approval-before-spend gate." Click **Insights** → metrics pull back in.
- *(Optional flourish)* In the terminal: `python scripts/mcp_demo.py` to show the
  MCP server's tools listed and called independently.

### 3:30–4:20 — The governance payoff (show the audit log)
- Scroll to the **Audit log**: point at `AI_EMAIL_GENERATED`,
  `AI_CREATIVE_GENERATED`, `CREATIVE_APPROVED`, `ADS_CAMPAIGN_CREATED`,
  `ADS_CAMPAIGN_LAUNCHED`, `ADS_INSIGHTS_FETCHED` — every AI and ad-account action.
- Click **Verify chain** → `CHAIN INTACT`.
- *(Strong close)* In the terminal run the tamper test:
  `pytest -q tests/test_audit_chain.py::test_tampering_breaks_the_hash_chain`
  "Even if someone drops the database trigger and edits a past row, the hash chain
  catches it — verify reports the exact event that was tampered with."

### 4:20–4:40 — The one decision that matters
> "The most important decision: make the audit trail the spine, not a feature.
> Every AI and ad-account action is written through one append-only, hash-chained
> service that's enforced in the database and independently verifiable. That's
> what makes EU AI Act and ISO 9001 achievable by construction — and everything
> else (LLM providers, MCP tools, the CRM) extends behind interfaces without
> touching that core."

---

**If you go long, cut:** the optional `mcp_demo.py` flourish (2:30–3:30) and the
optional pytest tamper run (keep just the in-UI **Verify chain**). The four-step
demo + audit log + the closing decision are the must-haves.
