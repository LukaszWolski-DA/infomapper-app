import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e runs its own dev server next to `npm run dev`; it needs its own build folder (playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
