"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "./lib/api";

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    qualified: "green",
    approved: "green",
    launched: "green",
    pending_approval: "amber",
    created_paused: "amber",
    not_qualified: "red",
    rejected: "red",
  };
  return <span className={`badge ${map[status] || "muted"}`}>{status}</span>;
}

export default function Page() {
  const [health, setHealth] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [emailView, setEmailView] = useState<any>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [form, setForm] = useState<any>({
    full_name: "",
    email: "",
    budget_eur: 300000,
    financing_preapproved: true,
    desired_location: "Lisbon",
    property_type: "apartment",
    timeline: "immediate",
  });

  async function refresh() {
    const [h, l, c, cm, a, v] = await Promise.all([
      api.health(),
      api.leads(),
      api.creatives(),
      api.campaigns(),
      api.audit(),
      api.verify(),
    ]);
    setHealth(h);
    setLeads(l);
    setCreatives(c);
    setCampaigns(cm);
    setAudit(a);
    setVerify(v);
  }

  async function run(name: string, fn: () => Promise<any>, after?: (r: any) => void) {
    setError("");
    setBusy(name);
    try {
      const r = await fn();
      if (after) after(r);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  const approvedCreatives = creatives.filter((c) => c.status === "approved");

  return (
    <div className="wrap grid" style={{ gap: 18 }}>
      <header className="hero">
        <h1>Agentic OS — Commercial Layer</h1>
        <p>
          Lead qualification → AI outreach email → AI ad creative (human-approved) →
          Meta Ads via MCP. Every AI and ad-account action is written to an
          append-only, hash-chained audit trail.
        </p>
      </header>

      {error && <div className="error">⚠ {error}</div>}

      {/* GOVERNANCE — front and centre */}
      <div className="card governance">
        <h2>🛡 Governance — Audit Trail</h2>
        <div className="status spread">
          <div className="row">
            {verify && (
              <span className={`badge ${verify.valid ? "green" : "red"}`}>
                {verify.valid ? "CHAIN INTACT" : "TAMPER DETECTED"}
              </span>
            )}
            <span className="muted">{verify?.detail}</span>
          </div>
          <div className="row">
            {health && (
              <span className="muted mono">
                db={health.database} · llm={health.llm_provider} · mcp=
                {String(health.mcp_enabled)} · meta={health.meta_mode}
              </span>
            )}
            <button
              className="secondary"
              disabled={busy !== ""}
              onClick={() => run("verify", api.verify, (r) => setVerify(r))}
            >
              Verify chain
            </button>
          </div>
        </div>
      </div>

      {/* STEP 1 — LEADS */}
      <div className="card">
        <h2>
          <span className="step">1</span> Lead capture &amp; qualification
        </h2>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <span className="muted">
            Configurable rule engine scores each lead; ≥ threshold = qualified.
          </span>
          <button disabled={busy !== ""} onClick={() => run("seed", api.seedLeads)}>
            {busy === "seed" ? "Seeding…" : "Seed sample leads"}
          </button>
        </div>

        <div className="card" style={{ background: "var(--panel-2)", marginBottom: 14 }}>
          <div className="form-grid">
            <div>
              <label>Full name</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label>Budget (EUR)</label>
              <input
                type="number"
                value={form.budget_eur}
                onChange={(e) =>
                  setForm({ ...form, budget_eur: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label>Timeline</label>
              <select
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
              >
                <option value="immediate">immediate</option>
                <option value="3_months">3_months</option>
                <option value="6_months">6_months</option>
                <option value="exploring">exploring</option>
              </select>
            </div>
            <div>
              <label>Financing pre-approved</label>
              <select
                value={String(form.financing_preapproved)}
                onChange={(e) =>
                  setForm({ ...form, financing_preapproved: e.target.value === "true" })
                }
              >
                <option value="true">yes</option>
                <option value="false">no</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                disabled={busy !== "" || !form.full_name || !form.email}
                onClick={() => run("addlead", () => api.createLead(form))}
              >
                Add lead
              </button>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Score</th>
              <th>Outreach email</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>
                  {l.full_name}
                  <div className="muted mono">{l.email}</div>
                </td>
                <td>€{l.budget_eur.toLocaleString()}</td>
                <td>
                  <Badge status={l.qualification_status} />
                </td>
                <td>{l.qualification_score}</td>
                <td>
                  {l.qualification_status === "qualified" ? (
                    <button
                      className="secondary"
                      disabled={busy !== ""}
                      onClick={() =>
                        run("email" + l.id, () => api.generateEmail(l.id), (r) =>
                          setEmailView(r),
                        )
                      }
                    >
                      {l.outreach_email ? "Regenerate email" : "Generate email"}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No leads yet — seed or add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {emailView && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 4 }}>
              Step 2 — AI outreach email (model: {emailView.model}
              {emailView.is_mock ? " · MOCK" : ""}):
            </div>
            <div className="pre">{emailView.email}</div>
          </div>
        )}
      </div>

      {/* STEP 3 — CREATIVES */}
      <div className="card">
        <h2>
          <span className="step">3</span> AI ad creative + human approval
        </h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="muted">Generate for a lead, then a human approves before use:</span>
          {leads
            .filter((l) => l.qualification_status === "qualified")
            .slice(0, 4)
            .map((l) => (
              <button
                key={l.id}
                className="secondary"
                disabled={busy !== ""}
                onClick={() =>
                  run("creative" + l.id, () => api.createCreative({ lead_id: l.id }))
                }
              >
                + for {l.full_name.split(" ")[0]}
              </button>
            ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Headline</th>
              <th>Primary text</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {creatives.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>
                  {c.headline}
                  {c.is_mock && <span className="badge muted"> mock</span>}
                </td>
                <td className="muted">{c.primary_text}</td>
                <td>
                  <Badge status={c.status} />
                </td>
                <td>
                  {c.status === "pending_approval" ? (
                    <button
                      disabled={busy !== ""}
                      onClick={() => run("approve" + c.id, () => api.approveCreative(c.id))}
                    >
                      Approve
                    </button>
                  ) : (
                    <span className="muted">{c.approved_by || "—"}</span>
                  )}
                </td>
              </tr>
            ))}
            {creatives.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No creatives yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* STEP 4 — CAMPAIGNS */}
      <div className="card">
        <h2>
          <span className="step">4</span> Meta Ads via MCP
        </h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="muted">
            Create from an approved creative (campaign starts PAUSED), then a human
            launches it — the approval before spend:
          </span>
          {approvedCreatives.slice(0, 4).map((c) => (
            <button
              key={c.id}
              className="secondary"
              disabled={busy !== ""}
              onClick={() =>
                run("camp" + c.id, () =>
                  api.createCampaign({
                    creative_id: c.id,
                    name: `Lisbon — creative #${c.id}`,
                    daily_budget_eur: 15,
                  }),
                )
              }
            >
              + campaign from creative #{c.id}
            </button>
          ))}
          {approvedCreatives.length === 0 && (
            <span className="muted">approve a creative first</span>
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Meta ID</th>
              <th>via MCP</th>
              <th>Insights</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>
                  <Badge status={c.status} />
                </td>
                <td className="mono hashcell">{c.external_campaign_id}</td>
                <td>
                  <span className={`badge ${c.via_mcp ? "green" : "amber"}`}>
                    {c.via_mcp ? "MCP" : "direct"}
                  </span>{" "}
                  <span className="muted">{c.mode}</span>
                </td>
                <td className="muted mono">
                  {c.insights
                    ? `${c.insights.impressions} imp · ${c.insights.clicks} clk`
                    : "—"}
                </td>
                <td>
                  <div className="row">
                    {c.status === "created_paused" && (
                      <button
                        disabled={busy !== ""}
                        onClick={() => run("launch" + c.id, () => api.launchCampaign(c.id))}
                      >
                        Launch (approve spend)
                      </button>
                    )}
                    <button
                      className="secondary"
                      disabled={busy !== ""}
                      onClick={() => run("ins" + c.id, () => api.fetchInsights(c.id))}
                    >
                      Insights
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AUDIT LOG */}
      <div className="card">
        <h2>📜 Audit log (append-only, newest first)</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
          Click any row to see the full immutable record — prompt, model, output,
          timestamp, actor — plus the hash link to the previous event.
        </p>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Time (UTC)</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Category</th>
              <th>Model</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((e) => (
              <Fragment key={e.id}>
                <tr
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <td>
                    {expanded === e.id ? "▾" : "▸"} {e.id}
                  </td>
                  <td className="muted mono">{(e.ts || "").replace("T", " ").slice(0, 19)}</td>
                  <td className="mono">{e.actor}</td>
                  <td>{e.action}</td>
                  <td>
                    <span className="badge muted">{e.category}</span>
                  </td>
                  <td className="muted mono">{e.model || "—"}</td>
                  <td className="mono hashcell" title={e.hash}>
                    {e.hash.slice(0, 12)}…
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr>
                    <td colSpan={7} style={{ background: "var(--panel-2)" }}>
                      <div className="grid" style={{ gap: 8, fontSize: 12 }}>
                        <div>
                          <span className="muted">timestamp:</span>{" "}
                          <span className="mono">{e.ts}</span> ·{" "}
                          <span className="muted">resource:</span>{" "}
                          <span className="mono">
                            {e.resource_type || "—"}#{e.resource_id || "—"}
                          </span>
                        </div>
                        {e.prompt && (
                          <div>
                            <div className="muted">prompt:</div>
                            <div className="pre">{e.prompt}</div>
                          </div>
                        )}
                        {e.output && (
                          <div>
                            <div className="muted">output:</div>
                            <div className="pre">{e.output}</div>
                          </div>
                        )}
                        {e.event_metadata && Object.keys(e.event_metadata).length > 0 && (
                          <div>
                            <div className="muted">metadata (incl. intended API call for ad actions):</div>
                            <div className="pre">
                              {JSON.stringify(e.event_metadata, null, 2)}
                            </div>
                          </div>
                        )}
                        <div className="mono" style={{ wordBreak: "break-all" }}>
                          <span className="muted">prev_hash:</span> {e.prev_hash}
                          <br />
                          <span className="muted">hash:</span> {e.hash}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {audit.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
