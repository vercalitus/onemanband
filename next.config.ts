import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/dashboard",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ]
  },
  /** Old /news URL is preserved as a permanent redirect so saved links keep working
   *  after the page was renamed to /clinical-feed. */
  async redirects() {
    return [
      { source: "/news", destination: "/clinical-feed", permanent: true },
    ]
  },
  /** Stale webpack filesystem cache is a common cause of "Cannot find module './611.js'" in dev on Windows. */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
