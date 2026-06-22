// Runtime reverse-proxy: forwards /api/* to the backend, reading BACKEND_URL
// at REQUEST time (not build time). This is why it's a route handler and not a
// next.config rewrite — rewrites are baked into the build, route handlers run
// on every request, so the same image works against any backend URL.
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string {
  const raw = process.env.BACKEND_URL || "http://localhost:8000";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const search = req.nextUrl.search || "";
  const target = `${backendBase()}/${path.join("/")}${search}`;

  const bodyText =
    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;
  const init: RequestInit = {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      // Forward the actor for the audit trail (SSO/JWT would supply this in prod).
      "x-actor": req.headers.get("x-actor") || "web@dezy.local",
    },
    ...(bodyText !== undefined ? { body: bodyText } : {}),
  };

  // Gentle single retry on a gateway error (cold backend). We deliberately do
  // NOT retry hard here — the client uses a single-request wake-up gate, so the
  // proxy must not multiply requests (that previously caused 429 rate-limiting).
  // 429 is passed straight through so the client can back off.
  let res: Response | null = await fetch(target, init).catch(() => null);
  if (res && [502, 503, 504].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await fetch(target, init).catch(() => null);
  }
  if (!res) {
    return new Response(JSON.stringify({ detail: "backend unreachable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, params.path);
}
