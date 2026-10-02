import path from "node:path";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_DB = path.resolve(".data", "e2e-db.json");
