import path from "node:path";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_DB = path.resolve(".data", "e2e-db.json");

/**
 * MEASURE_BUILD=production: the tests run against the measurement-only production build (AD-31, `npm run
 * measure:build` first), which listens on 127.0.0.1 only. Otherwise against a dev server, as always.
 */
export const E2E_PRODUCTION = process.env.MEASURE_BUILD === "production";
export const E2E_BASE = `http://${E2E_PRODUCTION ? "127.0.0.1" : "localhost"}:${E2E_PORT}`;
