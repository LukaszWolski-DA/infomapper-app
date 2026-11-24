// Slice 35 (step 1's Q3, the design of 11 November 2026): a baseline keeps its rows in the shape they had when it was
// taken, so a later change to the stored shape of a table it holds needs a step in the upgrade chain. This test records
// the columns of every table flagged "in" at `SNAPSHOT_SCHEMA` (read from the domain's row types, which the schema check
// holds equal to the migrations) and fails when they change without the schema going up.
//
// When it fails: add the step to `src/domain/baseline/upgrade.ts` (old rows in the new shape, deterministically), raise
// `SNAPSHOT_SCHEMA`, add a fixture of the older schema to `tests/baseline-upgrade.test.ts`, and record the new columns in
// `src/domain/baseline/__fixtures__/columns.json` (with the new schema number).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_FLAGS } from "@/compose/tables";
import { SNAPSHOT_SCHEMA } from "@/domain/baseline/upgrade";
import { domainTables } from "./schema/domain-tables";

const RECORDED = JSON.parse(readFileSync(path.resolve(__dirname, "../src/domain/baseline/__fixtures__/columns.json"), "utf8")) as {
  schema: number;
  tables: Record<string, string[]>;
};

describe("the stored shape of a baseline's tables", () => {
  it("is recorded at the current snapshot schema", () => {
    expect(RECORDED.schema).toBe(SNAPSHOT_SCHEMA);
  });

  it("has not changed since (a migration on a table flagged \"in\" needs a step in the chain)", () => {
    const now: Record<string, string[]> = {};
    for (const t of domainTables()) if (BASELINE_FLAGS[t.table] === "in") now[t.table] = t.columns.map((c) => c.name).sort();
    expect(now).toEqual(RECORDED.tables);
  }, 60_000);
});
