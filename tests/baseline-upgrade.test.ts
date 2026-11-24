// Slice 35 (step 1's Q3): a baseline's content read in its current shape. The domain's chain from the schema it was
// taken at, then each module table's own row rules; deterministic, the stored content never changed. The fixture is a
// small cut of the demo's content at schema 1 (`src/domain/baseline/__fixtures__/content-schema-1.json`): a later step
// keeps reading it.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose/tables";
import { shapedBaselineContent } from "@/data/baselines";
import { compareBaselines } from "@/domain/baseline/compare";
import type { BaselineContent } from "@/domain/baseline/content";
import { newerSnapshotMessage, SNAPSHOT_SCHEMA, upgradeBaselineContent, type SnapshotStep } from "@/domain/baseline/upgrade";

const FIXTURE = path.resolve(__dirname, "../src/domain/baseline/__fixtures__/content-schema-1.json");
const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as BaselineContent;

describe("the upgrade chain", () => {
  it("reads the schema 1 fixture as the current schema, the same twice, the stored content untouched", () => {
    const stored = fixture();
    const before = JSON.stringify(stored);
    const once = shapedBaselineContent(stored, 1, STORE_SCHEMA);
    const twice = shapedBaselineContent(stored, 1, STORE_SCHEMA);
    expect(twice).toEqual(once);
    expect(JSON.stringify(stored)).toBe(before);
    expect(compareBaselines(stored, once)).toEqual([]);
    expect(once.modules.cube_entity!.length).toBe(1);
  });

  it("runs the steps in order from the schema taken, on a copy, and refuses a newer schema or a missing step", () => {
    const steps: Record<number, SnapshotStep> = {
      1: (c) => ({ ...c, settings: { ...(c.settings as object), extra: 1 } }),
      2: (c) => ({ ...c, settings: { ...(c.settings as object), extra: 2 } }),
    };
    const stored = fixture();
    const up = upgradeBaselineContent(stored, 1, steps, 3) as unknown as { settings: { extra: number } };
    expect(up.settings.extra).toBe(2);
    expect((stored.settings as unknown as { extra?: number }).extra).toBeUndefined();
    expect(upgradeBaselineContent(stored, 2, steps, 3)).toEqual(up);
    expect(upgradeBaselineContent(stored, 3, steps, 3)).toBe(stored);
    expect(() => upgradeBaselineContent(stored, 4, steps, 3)).toThrow(newerSnapshotMessage(4));
    expect(() => upgradeBaselineContent(stored, 1, {}, 2)).toThrow(/No step from baseline format 1 to 2/);
    expect(() => upgradeBaselineContent(stored, SNAPSHOT_SCHEMA + 1)).toThrow(newerSnapshotMessage(SNAPSHOT_SCHEMA + 1));
  });

  it("gives a module's rows its defaults and its row upgrade, as a live read does", () => {
    const stored = fixture() as unknown as { modules: Record<string, Record<string, unknown>[]> };
    // InfoCube's slice 19 shape: `scd_type` instead of `history`, no unknown member
    const row = stored.modules.cube_entity![0]!;
    const older = Object.fromEntries(Object.entries(row).filter(([k]) => k !== "history" && k !== "has_unknown_member"));
    stored.modules.cube_entity = [{ ...older, scd_type: 2 }];
    const read = shapedBaselineContent(stored, 1, STORE_SCHEMA);
    expect(read.modules.cube_entity![0]).toMatchObject({ history: expect.anything() });
    expect(read.modules.cube_entity![0]).not.toHaveProperty("scd_type");
  });
});
