"use client";

import Link from "next/link";
import { useData } from "./lib/store";
import { AzulejoTiles, Badge, ErrorBanner, SectionLabel, Stat, fmtTs } from "./components/ui";

export default function Overview() {
  const { health, leads, creatives, campaigns, audit, verify } = useData();

  const qualified = leads.filter((l) => l.qualification_status === "qualified").length;
  const qualRate = leads.length ? Math.round((qualified / leads.length) * 100) : 0;
  const emails = leads.filter((l) => l.outreach_email).length;
  const approved = creatives.filter((c) => c.status === "approved").length;
  const launched = campaigns.filter((c) => c.status === "launched").length;

  const stages = [
    { label: "Leads captured", value: leads.length, color: "var(--azulejo)" },
    { label: "Qualified", value: qualified, color: "var(--sage)" },
    { label: "Outreach emails", value: emails, color: "var(--terracotta)" },
    { label: "Ad creatives", value: creatives.length, color: "var(--gold)" },
    { label: "Campaigns", value: campaigns.length, color: "var(--azulejo)" },
    { label: "Launched (spend OK)", value: launched, color: "var(--terracotta)" },
  ];
  const fmax = Math.max(1, ...stages.map((s) => s.value));

  const capabilities = [
    { n: "01", t: "Lead automation & qualification", d: "Capture from multiple sources, score with configurable rules, status auditable per lead." },
    { n: "02", t: "AI outreach email", d: "Personalised LLM email for qualified leads — logged with prompt, model & output." },
    { n: "03", t: "AI creative + human approval", d: "On-brand ad copy & art direction, gated by an explicit human approval." },
    { n: "04", t: "Meta Ads via MCP", d: "Programmatic campaigns through an MCP server; launch gated before spend; performance pulled back." },
  ];

  return (
    <>
      <ErrorBanner />

      <section className="hero reveal">
        <AzulejoTiles />
        <div className="eyebrow">Agentic OS · Operations Console</div>
        <h1>
          Boutique operations, <em>governed</em> end to end.
        </h1>
        <p>
          One AI-first platform from first lead to launched campaign — enforcing the firm&rsquo;s
          methodology and writing every AI and ad-account action to a tamper-evident audit trail.
        </p>
        <div className="status-strip">
          <Badge tone="green">Store · {health?.database ?? "…"}</Badge>
          <Badge tone="blue">LLM · {health?.llm_provider ?? "…"}</Badge>
          <Badge tone="blue">MCP · {health?.mcp_enabled ? "on" : "…"}</Badge>
          <Badge tone="amber">Meta · {health?.meta_mode ?? "…"}</Badge>
          <Badge tone={verify?.valid === false ? "red" : "green"}>
            Audit · {verify ? (verify.valid ? "chain intact" : "tamper detected") : "…"}
          </Badge>
        </div>
      </section>

      <div className="stat-grid reveal">
        <Stat k="Leads" v={leads.length} sub={`${emails} contacted by AI`} tone="azulejo" />
        <Stat k="Qualified rate" v={<>{qualRate}<small>%</small></>} sub={`${qualified} of ${leads.length} leads`} tone="sage" />
        <Stat k="Creatives" v={creatives.length} sub={`${approved} approved`} />
        <Stat k="Campaigns" v={campaigns.length} sub={`${launched} launched`} tone="azulejo" />
        <Stat k="Audit events" v={verify?.count ?? audit.length} sub="append-only ledger" />
      </div>

      <div className="grid-2" style={{ marginTop: 26 }}>
        <div className="card reveal">
          <div className="card-head">
            <h2>Commercial pipeline</h2>
            <span className="hint">Lead → Email → Creative → Campaign → Spend</span>
          </div>
          <div className="card-pad">
            <div className="funnel">
              {stages.map((s) => (
                <div className="funnel-row" key={s.label}>
                  <div className="fl">
                    <span className="dot" style={{ background: s.color }} />
                    {s.label}
                  </div>
                  <div className="funnel-bar">
                    <div
                      className="funnel-fill"
                      style={{ width: `${Math.max(4, (s.value / fmax) * 100)}%`, background: s.color }}
                    />
                  </div>
                  <div className="fv">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card reveal">
          <div className="card-head">
            <h2>Capability coverage</h2>
            <span className="hint">the four commercial pillars</span>
          </div>
          <div className="card-pad stack" style={{ gap: 14 }}>
            {capabilities.map((c) => (
              <div key={c.n} className="row" style={{ alignItems: "flex-start", gap: 12, flexWrap: "nowrap" }}>
                <span className="mono" style={{ color: "var(--terracotta)", fontSize: 12, paddingTop: 2 }}>{c.n}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {c.t} <span className="badge green" style={{ marginLeft: 4 }}>live</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel n="·">Recent activity</SectionLabel>
      <div className="card reveal">
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>#</th>
                <th>Time (UTC)</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 6).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.id}</td>
                  <td className="t-sub">{fmtTs(e.ts)}</td>
                  <td className="mono">{e.actor}</td>
                  <td style={{ fontWeight: 600 }}>{e.action}</td>
                  <td><Badge tone={e.category === "ai" ? "blue" : e.category === "ad_account" ? "amber" : e.category === "governance" ? "green" : "plain"}>{e.category}</Badge></td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={5} className="empty">No activity yet — head to Leads and seed the sample data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-pad" style={{ borderTop: "1px solid var(--line)" }}>
          <Link href="/governance" className="btn btn-ghost btn-sm">View full audit ledger →</Link>
        </div>
      </div>
    </>
  );
}
