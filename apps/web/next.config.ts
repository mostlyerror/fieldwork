import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PostHog proxy: ad blockers drop direct requests to us.i.posthog.com.
  // Proxying through /ingest preserves analytics from blocked clients.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/tournaments/:id",
        destination: "/houston/tournaments/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
