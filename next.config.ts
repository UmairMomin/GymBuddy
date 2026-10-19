import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e suite builds into its own directory so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  // Lets a phone on the same Wi-Fi load the dev server via the laptop's LAN IP (dev only).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // The service worker must never be served stale, and may only run its own code.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
