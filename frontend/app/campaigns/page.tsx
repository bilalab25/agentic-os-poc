"use client";

import { useData } from "../lib/store";
import { api } from "../lib/api";
import { Badge, ErrorBanner, PageHead, StatusBadge } from "../components/ui";

function Spark({ seed }: { seed: string }) {
  const base = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars = Array.from({ length: 9 }, (_, i) => 30 + ((base * (i + 3)) % 70));
  return (
    <div className="spark">
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export default function CampaignsPage() {
  const { creatives, campaigns, busy, run } = useData();
  const approved = creatives.filter((c) => c.status === "approved");

  return (
    <>
      <ErrorBanner />
      <PageHead
        eyebrow="03 · Meta Ads via MCP"
        title={<>Campaigns, <em>governed</em> by a spend gate.</>}
        lede="Campaigns are created through a real MCP server and start PAUSED — no budget moves until a human launches them. Every ad-account action, including the exact Graph API request, is recorded on the audit trail."
      />

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Create a campaign</h2>
          <span className="hint">only an approved creative can become a campaign</span>
        </div>
        <div className="card-pad">
          {approved.length === 0 ? (
            <div className="pill-note">Approve a creative first (Creative Studio). The human-approval gate is enforced server-side.</div>
          ) : (
            <div className="chip-row">
              {approved.map((c) => (
                <button
                  key={c.id}
                  className="btn-ghost btn-sm"
                  disabled={!!busy}
                  onClick={() =>
                    run("camp" + c.id, () =>
                      api.createCampaign({ creative_id: c.id, name: `Lisbon — creative #${c.id}`, daily_budget_eur: 15 }),
                    )
                  }
                >
                  {busy === "camp" + c.id ? "Creating…" : `+ from creative #${c.id}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {campaigns.map((c) => (
          <div key={c.id} className="card">
            <div className="card-head">
              <h2 style={{ fontSize: 19 }}>{c.name}</h2>
              <div className="row">
                <StatusBadge status={c.status} />
                <Badge tone={c.via_mcp ? "blue" : "amber"}>{c.via_mcp ? "via MCP" : "direct"}</Badge>
                <Badge tone="amber">{c.mode}</Badge>
              </div>
            </div>
            <div className="card-pad">
              <div className="row spread" style={{ alignItems: "flex-start" }}>
                <div className="kv">
                  <div>Meta campaign ID</div>
                  <div className="mono" style={{ color: "var(--azulejo)", fontSize: 13 }}>{c.external_campaign_id}</div>
                  <div style={{ marginTop: 8 }}>Daily budget <b>€{c.daily_budget_eur}</b> · Objective <b className="mono">{c.objective}</b></div>
                </div>
                <div className="row">
                  {c.status === "created_paused" && (
                    <button disabled={!!busy} onClick={() => run("l" + c.id, () => api.launchCampaign(c.id))}>
                      {busy === "l" + c.id ? "Launching…" : "Launch (approve spend)"}
                    </button>
                  )}
                  <button className="btn-ghost" disabled={!!busy} onClick={() => run("i" + c.id, () => api.fetchInsights(c.id))}>
                    {busy === "i" + c.id ? "Fetching…" : "Fetch insights"}
                  </button>
                </div>
              </div>

              {c.insights && (
                <div style={{ marginTop: 18 }}>
                  <div className="row spread" style={{ alignItems: "flex-end" }}>
                    <div className="field-label">Performance (pulled back from Meta)</div>
                    <Spark seed={c.external_campaign_id} />
                  </div>
                  <div className="metrics" style={{ marginTop: 10 }}>
                    <div className="metric"><div className="mk">Impressions</div><div className="mv">{Number(c.insights.impressions).toLocaleString()}</div></div>
                    <div className="metric"><div className="mk">Clicks</div><div className="mv">{c.insights.clicks}</div></div>
                    <div className="metric"><div className="mk">CTR</div><div className="mv">{c.insights.ctr}%</div></div>
                    <div className="metric"><div className="mk">Spend</div><div className="mv">€{c.insights.spend}</div></div>
                    <div className="metric"><div className="mk">CPC</div><div className="mv">€{c.insights.cpc}</div></div>
                    <div className="metric"><div className="mk">Reach</div><div className="mv">{Number(c.insights.reach).toLocaleString()}</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="card card-pad empty">No campaigns yet — create one from an approved creative.</div>
        )}
      </div>
    </>
  );
}
