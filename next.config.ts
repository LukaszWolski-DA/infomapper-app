import type { NextConfig } from "next";

// e2e runs its own dev servers next to `npm run dev`, each in its own build folder (NEXT_DIST_DIR, playwright.config.ts
// and S0-10). They run without Turbopack's file-system cache: the tests stop those servers by force, and a cache cut off
// mid-write made the next server answer 404 for whole routes (S0-10 and full e2e runs, slice 1a step 6).
const e2eServer = !!process.env.NEXT_DIST_DIR;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Slice 25 (F28): Paged.js 0.4.3's own bundled ES module, not its source, whose CommonJS dependencies (es5-ext through
  // event-emitter) break under Turbopack ("contains.call is not a function"). The document page loads it in the browser.
  turbopack: { resolveAlias: { pagedjs: "./node_modules/pagedjs/dist/paged.esm.js" } },
  // Slice 29 (F6): the Postgres pool reads Supabase's root certificate at run time (`src/data/postgres/config.ts`), a path
  // the build's file tracing cannot see; every server route may open a connection, so every one carries the file (on
  // Vercel a function holds only its traced files).
  outputFileTracingIncludes: { "/**": ["./src/data/postgres/supabase-ca.crt"] },
  // fix/dev-action-logging: the development server logs every Server Function call with its arguments by default (a
  // sign-in's password included, slice 31's acceptance). Not `logging: false`: the request lines and the browser's
  // warnings stay, and a failing e2e run's server.log is read for them (tests/dev-logging.test.ts).
  logging: { serverFunctions: false },
  experimental: {
    turbopackFileSystemCacheForDev: !e2eServer,
    // The proxy (src/proxy.ts) buffers request bodies up to this size; an import's upload may be up to 25 MB (slice 7a,
    // src/app/_lib/import-sources.ts). Above it the body would arrive cut off.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
