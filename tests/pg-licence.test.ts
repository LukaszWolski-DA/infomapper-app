// npm run pg:licence (slice 39, C8): its arguments, and the target refused before any connection (as pg:kb).

import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { LICENCE_USAGE, licenceArgs } from "../scripts/lib/licence-grant";

describe("pg:licence's arguments", () => {
  it("takes grant, an organization's name and a known module", () => {
    expect(licenceArgs(["grant", "InfoMate", "infocatalog"])).toEqual({ name: "InfoMate", module: "infocatalog" });
    expect(licenceArgs(["grant", "Retail Co", "infodoc"])).toEqual({ name: "Retail Co", module: "infodoc" });
  });

  it("refuses anything else: another verb, no name, an unknown module, more arguments", () => {
    expect(licenceArgs(["revoke", "InfoMate", "infocatalog"])).toEqual({ refusal: LICENCE_USAGE });
    expect(licenceArgs(["grant", " ", "infocatalog"])).toEqual({ refusal: LICENCE_USAGE });
    expect(licenceArgs(["grant", "InfoMate"])).toEqual({ refusal: LICENCE_USAGE });
    expect(licenceArgs(["grant", "InfoMate", "infocatalog", "extra"])).toEqual({ refusal: LICENCE_USAGE });
    expect(licenceArgs(["grant", "InfoMate", "infoworld"])).toEqual({ refusal: expect.stringContaining('Unknown module "infoworld"') });
  });
});

describe("pg:licence's target", () => {
  it("refuses a database that is not infomapper-dev before it connects", () => {
    const run = spawnSync(process.execPath, ["--import", "tsx", "scripts/pg-licence.ts", "grant", "InfoMate", "infocatalog"], {
      encoding: "utf8",
      // a port nothing listens on: a connection would fail with another message
      env: { ...process.env, INFOMAPPER_MIGRATION_URL: "postgres://someone@127.0.0.1:1/postgres", SUPABASE_URL: "https://example.supabase.co", INFOMAPPER_SERVER_NAME: "dev" },
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("The target is not infomapper-dev");
    expect(run.stdout).not.toContain("Target:");
  }, 60_000);
});
