// Thin typed-ish client for the Agentic OS backend.
// Default to the same-origin "/api" proxy (see next.config.js rewrites); set
// NEXT_PUBLIC_API_BASE to call a backend URL directly instead.
const BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

// Demo actor; a real deployment would derive this from the SSO/JWT session.
const ACTOR = "agent@dezy.local";

const COLD =
  "The backend is waking up (free-tier cold start). This takes ~30–60s — it will retry automatically.";

async function req(path: string, opts: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json", "X-Actor": ACTOR },
      ...opts,
    });
  } catch {
    throw new Error(COLD);
  }

  if (!res.ok) {
    // Gateway / rate-limit responses during a cold start: keep the message
    // clean (never surface the provider's raw HTML error page).
    if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(COLD);
    if (res.status === 429) throw new Error("Service is warming up (too many requests) — retrying shortly.");

    const ct = res.headers.get("content-type") || "";
    let detail = "";
    if (ct.includes("application/json")) {
      try {
        detail = (await res.json())?.detail ?? "";
      } catch {
        /* ignore */
      }
    } else {
      detail = res.statusText;
    }
    throw new Error(`${res.status}${detail ? " — " + detail : ""}`);
  }

  const data = await res.json().catch(() => null);
  // The proxy returns HTTP 200 with {__waking:true} during a cold start so the
  // browser never logs a red network error. Treat it as "not ready yet."
  if (data && data.__waking) throw new Error(COLD);
  return data;
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
  rejectCreative: (id: number) => req(`/creatives/${id}/reject`, { method: "POST" }),
  campaigns: () => req("/campaigns"),
  createCampaign: (body: any) =>
    req("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  launchCampaign: (id: number) => req(`/campaigns/${id}/launch`, { method: "POST" }),
  fetchInsights: (id: number) => req(`/campaigns/${id}/insights`, { method: "POST" }),
  audit: () => req("/audit"),
  verify: () => req("/audit/verify"),
};
