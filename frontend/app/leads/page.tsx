"use client";

import { Fragment, useState } from "react";
import { useData } from "../lib/store";
import { api } from "../lib/api";
import { Badge, ErrorBanner, PageHead, StatusBadge, fmtTs } from "../components/ui";

const SOURCE_TONE: Record<string, string> = {
  meta_lead_ad: "blue",
  website_form: "plain",
  idealista: "amber",
  referral: "green",
};

export default function LeadsPage() {
  const { leads, busy, run } = useData();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [email, setEmail] = useState<any>(null);
  const [form, setForm] = useState<any>({
    full_name: "",
    email: "",
    budget_eur: 300000,
    timeline: "immediate",
    financing_preapproved: true,
    desired_location: "Lisbon",
    property_type: "apartment",
  });

  const addLead = () =>
    run("add", () => api.createLead(form)).then(() =>
      setForm({ ...form, full_name: "", email: "" }),
    );

  return (
    <>
      <ErrorBanner />
      <PageHead
        eyebrow="01 · Marketing automation"
        title={<>The <em>lead</em> pipeline.</>}
        lede="Leads arrive from multiple sources, are scored by a configurable rule engine, and every qualification is written to the audit trail. Click a lead to see exactly why it scored as it did."
      />

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Capture a lead</h2>
          <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => run("seed", api.seedLeads)}>
            {busy === "seed" ? "Seeding…" : "Seed sample leads"}
          </button>
        </div>
        <div className="card-pad">
          <div className="form-grid">
            <label className="field">
              <div className="field-label">Full name</div>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Maria Silva" />
            </label>
            <label className="field">
              <div className="field-label">Email</div>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maria@example.pt" />
            </label>
            <label className="field">
              <div className="field-label">Budget (EUR)</div>
              <input type="number" value={form.budget_eur} onChange={(e) => setForm({ ...form, budget_eur: Number(e.target.value) })} />
            </label>
            <label className="field">
              <div className="field-label">Timeline</div>
              <select value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
                <option value="immediate">immediate</option>
                <option value="3_months">3 months</option>
                <option value="6_months">6 months</option>
                <option value="exploring">exploring</option>
              </select>
            </label>
            <label className="field">
              <div className="field-label">Financing</div>
              <select value={String(form.financing_preapproved)} onChange={(e) => setForm({ ...form, financing_preapproved: e.target.value === "true" })}>
                <option value="true">pre-approved</option>
                <option value="false">not yet</option>
              </select>
            </label>
            <button disabled={!!busy || !form.full_name || !form.email} onClick={addLead}>
              {busy === "add" ? "Adding…" : "Add & qualify"}
            </button>
          </div>
        </div>
      </div>

      {email && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-head">
            <h2>AI outreach email</h2>
            <span className="row">
              <Badge tone="blue">{email.model}</Badge>
              <Badge tone={email.is_mock ? "amber" : "green"}>{email.is_mock ? "mock" : "live LLM"}</Badge>
              <button className="btn-ghost btn-sm" onClick={() => setEmail(null)}>Close</button>
            </span>
          </div>
          <div className="card-pad">
            <div className="detail"><div className="pre" style={{ maxHeight: 320 }}>{email.email}</div></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Leads</h2>
          <span className="hint">click a row for the qualification breakdown</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Lead</th><th>Source</th><th>Budget</th><th>Status</th><th>Score</th><th>Outreach</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <Fragment key={l.id}>
                  <tr className="clickable" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                    <td className="mono">{expanded === l.id ? "▾" : "▸"} {l.id}</td>
                    <td><div className="t-name">{l.full_name}</div><div className="t-sub">{l.email}</div></td>
                    <td><Badge tone={SOURCE_TONE[l.source] || "plain"}>{l.source.replace(/_/g, " ")}</Badge></td>
                    <td className="mono">€{Number(l.budget_eur).toLocaleString()}</td>
                    <td><StatusBadge status={l.qualification_status} /></td>
                    <td>
                      <span className="score-bar"><span className="score-fill" style={{ width: `${l.qualification_score}%`, background: l.qualification_status === "qualified" ? "var(--sage)" : "var(--ink-soft)" }} /></span>
                      <span className="mono" style={{ marginLeft: 8 }}>{l.qualification_score}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {l.qualification_status === "qualified" ? (
                        <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => run("email" + l.id, () => api.generateEmail(l.id)).then((r) => r && setEmail(r))}>
                          {busy === "email" + l.id ? "Writing…" : l.outreach_email ? "Regenerate" : "Generate email"}
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr className="detail">
                      <td colSpan={7}>
                        <div className="kv" style={{ marginBottom: 10 }}>
                          Timeline <b>{l.timeline.replace(/_/g, " ")}</b> · Financing <b>{l.financing_preapproved ? "pre-approved" : "not yet"}</b> · Location <b>{l.desired_location || "—"}</b> · Type <b>{l.property_type || "—"}</b>
                        </div>
                        <div className="field-label" style={{ marginBottom: 8 }}>Qualification rules (configurable)</div>
                        <div className="stack" style={{ gap: 6 }}>
                          {(l.qualification_reasons || []).map((r: any) => (
                            <div key={r.rule} className="row spread" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                              <span className="row" style={{ gap: 8 }}>
                                <span style={{ color: r.passed ? "var(--sage)" : "var(--ink-soft)" }}>{r.passed ? "✓" : "○"}</span>
                                <span style={{ fontWeight: r.passed ? 600 : 400 }}>{r.explain}</span>
                              </span>
                              <span className="mono muted">+{r.points}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="empty">No leads yet — add one above or seed the sample data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
