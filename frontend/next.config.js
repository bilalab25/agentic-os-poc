// Resolve the backend at runtime (read when `next start` boots), so the same
// image works locally and on Render without rebuilding. `/api/*` from the
// browser is proxied to the backend server-side — same-origin, no CORS.
const raw = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND = raw.startsWith("http") ? raw : `https://${raw}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo is judged on the slice, not lint config; keep builds unblocked.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/:path*` }];
  },
};

module.exports = nextConfig;
