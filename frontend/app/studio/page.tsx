"use client";

import { useData } from "../lib/store";
import { api } from "../lib/api";
import { Badge, ErrorBanner, PageHead, StatusBadge, fmtTs } from "../components/ui";

export default function StudioPage() {
  const { leads, creatives, busy, run } = useData();
  const qualified = leads.filter((l) => l.qualification_status === "qualified");

  return (
    <>
      <ErrorBanner />
      <PageHead
        eyebrow="02 · AI creative generation"
        title={<>The <em>creative</em> studio.</>}
        lede="Generate on-brand ad copy and art direction with the LLM. Nothing goes live on its own — each creative waits behind an explicit human-approval gate, and every generation is logged with its prompt, model and output."
      />

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Generate a creative</h2>
          <span className="hint">pick a qualified lead to tailor the audience</span>
        </div>
        <div className="card-pad">
          {qualified.length === 0 ? (
            <div className="pill-note">Qualify a lead first (Leads → seed or add). Creatives are tailored to a qualified audience.</div>
          ) : (
            <div className="chip-row">
              {qualified.map((l) => (
                <button
                  key={l.id}
                  className="btn-ghost btn-sm"
                  disabled={!!busy}
                  onClick={() => run("c" + l.id, () => api.createCreative({ lead_id: l.id }))}
                >
                  {busy === "c" + l.id ? "Generating…" : `+ for ${l.full_name.split(" ")[0]}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {creatives.map((c) => (
          <div key={c.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* art-direction frame */}
            <div
              style={{
                aspectRatio: "16/9",
                background:
                  "repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 14px, #f1e7d6 14px, #f1e7d6 28px)",
                borderBottom: "1px solid var(--line)",
                padding: 16,
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <span className="badge blue plain" style={{ position: "absolute", top: 12, left: 12 }}>art direction</span>
              <p className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", margin: 0, background: "rgba(255,253,249,0.85)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)" }}>
                {c.image_prompt || "—"}
              </p>
            </div>
            <div className="card-pad" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <h3 style={{ fontSize: 19, lineHeight: 1.15 }}>{c.headline}</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", flex: 1 }}>{c.primary_text}</p>
              <div className="row spread" style={{ marginTop: 6 }}>
                <span className="row" style={{ gap: 6 }}>
                  <StatusBadge status={c.status} />
                  {c.is_mock && <Badge tone="amber">mock</Badge>}
                </span>
                <span className="t-sub">#{c.id}</span>
              </div>
              {c.status === "pending_approval" ? (
                <div className="row" style={{ marginTop: 8 }}>
                  <button disabled={!!busy} onClick={() => run("ap" + c.id, () => api.approveCreative(c.id))}>Approve</button>
                  <button className="btn-ghost" disabled={!!busy} onClick={() => run("rj" + c.id, () => api.rejectCreative(c.id))}>Reject</button>
                </div>
              ) : (
                <div className="kv" style={{ marginTop: 8 }}>
                  {c.status === "approved" ? `Approved by ${c.approved_by}` : "Rejected"} · {fmtTs(c.approved_at || c.created_at)}
                </div>
              )}
            </div>
          </div>
        ))}
        {creatives.length === 0 && (
          <div className="card card-pad empty" style={{ gridColumn: "1 / -1" }}>No creatives yet — generate one above.</div>
        )}
      </div>
    </>
  );
}
