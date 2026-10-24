import type { NextConfig } from "next";

// e2e runs its own dev servers next to `npm run dev`, each in its own build folder (NEXT_DIST_DIR, playwright.config.ts
// and S0-10). They run without Turbopack's file-system cache: the tests stop those servers by force, and a cache cut off
// mid-write made the next server answer 404 for whole routes (S0-10 and full e2e runs, slice 1a step 6).
const e2eServer = !!process.env.NEXT_DIST_DIR;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    turbopackFileSystemCacheForDev: !e2eServer,
    // The proxy (src/proxy.ts) buffers request bodies up to this size; an import's upload may be up to 25 MB (slice 7a,
    // src/app/_lib/import-sources.ts). Above it the body would arrive cut off.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
