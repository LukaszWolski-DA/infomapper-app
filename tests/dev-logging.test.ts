// fix/dev-action-logging: the development server must not log server actions' arguments. Next.js logs every Server
// Function call with its arguments by default in development (`logging.serverFunctions`, default true); slice 31's
// acceptance found a sign-in's e-mail and password printed in the terminal. The config is loaded as Next.js loads it
// (its defaults merged), and Next's own rule is checked (`dist/server/base-server.js`, `logServerFunctions`).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type Logging = false | { serverFunctions?: boolean; incomingRequests?: unknown };

async function devLogging(): Promise<Logging | undefined> {
  const loadConfig = require("next/dist/server/config").default as (phase: string, dir: string) => Promise<{ logging?: Logging }>;
  const { PHASE_DEVELOPMENT_SERVER } = require("next/constants") as { PHASE_DEVELOPMENT_SERVER: string };
  return (await loadConfig(PHASE_DEVELOPMENT_SERVER, process.cwd())).logging;
}

describe("the development server's logging", () => {
  it("does not log server actions' arguments", { timeout: 60_000 }, async () => {
    const logging = await devLogging();
    expect(typeof logging === "object" && logging !== null && Boolean(logging.serverFunctions)).toBe(false);
  });

  it("keeps the request lines that server.log is read for", { timeout: 60_000 }, async () => {
    const logging = await devLogging();
    expect(typeof logging).toBe("object");
    expect(logging && logging.incomingRequests).not.toBe(false);
  });
});
