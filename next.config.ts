import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Stale webpack filesystem cache is a common cause of "Cannot find module './611.js'" in dev on Windows. */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
