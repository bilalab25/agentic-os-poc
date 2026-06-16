"use client";

import { Fragment, useState } from "react";
import { useData } from "../lib/store";
import { api } from "../lib/api";
import { Badge, ErrorBanner, PageHead, SectionLabel, Stat, fmtTs } from "../components/ui";

const CAT_TONE: Record<string, string> = { ai: "blue", ad_account: "amber", governance: "green", data: "plain" };

export default function GovernancePage() {
  const { audit, verify, busy, run } = useData();
  const [expanded, setExpanded] = useState<number | null>(null);

  const aiCount = audit.filter((e) => e.category === "ai").length;
  const adCount = audit.filter((e) => e.category === "ad_account").length;

  return (
    <>
      <ErrorBanner />
      <PageHead
        eyebrow="04 · Governance & audit"
        title={<>An <em>immutable</em> record of every decision.</>}
        lede="Every AI call and every ad-account action is written to an append-only, hash-chained ledger — the load-bearing foundation that makes EU AI Act, RGPD and ISO 9001 achievable by construction rather than retrofit."
      />

      <div
        className="card reveal"
        style={{
          marginBottom: 22,
          background: verify?.valid === false ? "#f6e4e1" : "linear-gradient(135deg,#fffdf9,#ecefe6)",
          borderColor: verify?.valid === false ? "#e3b7b1" : "var(--line)",
        }}
      >
        <div className="card-pad row spread">
          <div className="row" style={{ gap: 14 }}>
            <span
              style={{
                width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center",
                background: verify?.valid === false ? "var(--claret)" : "var(--sage)", color: "#fff", fontSize: 22,
              }}
            >
              {verify?.valid === false ? "⚠" : "✓"}
            </span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 21 }}>
                {verify ? (verify.valid ? "Chain intact" : "Tamper detected") : "Verifying…"}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{verify?.detail || "Recompute the SHA-256 hash chain across all events."}</div>
            </div>
          </div>
          <button className="btn-ink" disabled={!!busy} onClick={() => run("verify", api.verify)}>
            {busy === "verify" ? "Verifying…" : "Verify chain"}
          </button>
        </div>
      </div>

      <div className="stat-grid reveal">
        <Stat k="Total events" v={verify?.count ?? audit.length} sub="append-only" />
        <Stat k="AI calls logged" v={aiCount} sub="prompt · model · output" tone="azulejo" />
        <Stat k="Ad-account actions" v={adCount} sub="incl. intended API call" />
        <Stat k="Integrity" v={verify ? (verify.valid ? "✓" : "✗") : "…"} sub="hash-chained" tone="sage" />
      </div>

      <SectionLabel n="·">Compliance by construction</SectionLabel>
      <div className="comp-grid">
        <div className="comp">
          <div className="tag">EU AI Act</div>
          <h3>Logged &amp; gated</h3>
          <p>Every model invocation records prompt, model version, output, actor and timestamp. AI output passes a human-review gate before it is used.</p>
        </div>
        <div className="comp">
          <div className="tag">RGPD / GDPR</div>
          <h3>Privacy by design</h3>
          <p>Lead capture is data-minimised, outreach carries an unsubscribe notice, and retention / right-to-erasure are designed into the data architecture.</p>
        </div>
        <div className="comp">
          <div className="tag">ISO 9001</div>
          <h3>Auditable process</h3>
          <p>Auditable, versioned logs for every output; ADRs for significant decisions; runbooks per module; documentation built progressively, not at the end.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad">
          <div className="field-label" style={{ marginBottom: 10 }}>How the ledger stays trustworthy</div>
          <div className="comp-grid">
            <div><b>Append-only at the database.</b><p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>BEFORE UPDATE / DELETE triggers abort any mutation — enforced on both SQLite and PostgreSQL.</p></div>
            <div><b>Tamper-evident hash chain.</b><p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>Each event hashes its content + the previous event&rsquo;s hash. Editing any past row breaks every later hash.</p></div>
            <div><b>Independently verifiable.</b><p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>“Verify chain” recomputes the whole chain server-side and reports the first break, if any.</p></div>
          </div>
        </div>
      </div>

      <SectionLabel n="·">Audit ledger — newest first</SectionLabel>
      <div className="card">
        <div className="card-head">
          <h2>Append-only ledger</h2>
          <span className="hint">click any row to inspect the full immutable record</span>
        </div>
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr><th>#</th><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Category</th><th>Model</th><th>Hash</th></tr>
            </thead>
            <tbody>
              {audit.map((e) => (
                <Fragment key={e.id}>
                  <tr className="clickable" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="mono">{expanded === e.id ? "▾" : "▸"} {e.id}</td>
                    <td className="t-sub">{fmtTs(e.ts)}</td>
                    <td className="mono">{e.actor}</td>
                    <td style={{ fontWeight: 600 }}>{e.action}</td>
                    <td><Badge tone={CAT_TONE[e.category] || "plain"}>{e.category}</Badge></td>
                    <td className="t-sub">{e.model || "—"}</td>
                    <td className="hash" title={e.hash}>{e.hash.slice(0, 12)}…</td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="detail">
                      <td colSpan={7}>
                        <div className="stack" style={{ gap: 10 }}>
                          <div className="kv">timestamp <b className="mono">{e.ts}</b> · resource <b className="mono">{e.resource_type || "—"}#{e.resource_id || "—"}</b></div>
                          {e.prompt && (<div><div className="field-label">prompt</div><div className="pre">{e.prompt}</div></div>)}
                          {e.output && (<div><div className="field-label">output</div><div className="pre">{e.output}</div></div>)}
                          {e.event_metadata && Object.keys(e.event_metadata).length > 0 && (
                            <div><div className="field-label">metadata — incl. intended Graph API call for ad actions</div><div className="pre">{JSON.stringify(e.event_metadata, null, 2)}</div></div>
                          )}
                          <div className="kv mono" style={{ wordBreak: "break-all" }}>
                            <div><span className="muted">prev_hash:</span> {e.prev_hash}</div>
                            <div><span className="muted">hash:</span> {e.hash}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {audit.length === 0 && (<tr><td colSpan={7} className="empty">No events yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
