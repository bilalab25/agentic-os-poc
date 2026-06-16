// Thin typed-ish client for the Agentic OS backend.
// Default to the same-origin "/api" proxy (see next.config.js rewrites); set
// NEXT_PUBLIC_API_BASE to call a backend URL directly instead.
const BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

// Demo actor; a real deployment would derive this from the SSO/JWT session.
const ACTOR = "agent@dezy.local";

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", "X-Actor": ACTOR },
    ...opts,
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).detail ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new Error(`${res.status} — ${detail}`);
  }
  return res.json();
}

export const api = {
  health: () => req("/health"),
  leads: () => req("/leads"),
  seedLeads: () => req("/leads/seed", { method: "POST" }),
  createLead: (body: any) => req("/leads", { method: "POST", body: JSON.stringify(body) }),
  generateEmail: (id: number) => req(`/leads/${id}/email`, { method: "POST" }),
  creatives: () => req("/creatives"),
  createCreative: (body: any) =>
    req("/creatives", { method: "POST", body: JSON.stringify(body) }),
  approveCreative: (id: number) => req(`/creatives/${id}/approve`, { method: "POST" }),
  campaigns: () => req("/campaigns"),
  createCampaign: (body: any) =>
    req("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  launchCampaign: (id: number) => req(`/campaigns/${id}/launch`, { method: "POST" }),
  fetchInsights: (id: number) => req(`/campaigns/${id}/insights`, { method: "POST" }),
  audit: () => req("/audit"),
  verify: () => req("/audit/verify"),
};
