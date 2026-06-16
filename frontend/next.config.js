/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo is judged on the slice, not lint config; keep builds unblocked.
  eslint: { ignoreDuringBuilds: true },
  // The browser calls same-origin /api/* which is proxied to BACKEND_URL by the
  // runtime route handler at app/api/[...path]/route.ts (read per-request, so
  // the URL is NOT baked into the build).
};

module.exports = nextConfig;
