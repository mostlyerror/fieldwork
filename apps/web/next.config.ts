import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
