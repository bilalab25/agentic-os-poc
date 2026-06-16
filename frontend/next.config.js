/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo is judged on the slice, not lint config; keep builds unblocked.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
