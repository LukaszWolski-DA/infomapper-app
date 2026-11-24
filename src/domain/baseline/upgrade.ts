// A baseline's content in its current shape (slice 35, step 1's Q3; the design of 11 November 2026): a short chain of
// pure steps from the schema it was taken at to `SNAPSHOT_SCHEMA`, run when a baseline is read and never written back
// (the stored `snapshot_schema` stays as taken). The store then runs every module table's own row rules (its defaults
// and its upgrade, `src/data/rows.ts`) on the module rows, so a module's later shape needs no step here.
//
// A step is deterministic: it takes the content only, no `CommandContext`, so it has no clock and no new ids; a value it
// must make comes from what the content holds (a default, a copy, an id derived from existing ids by a fixed rule).
//
// **A later slice that changes the stored shape of a table flagged "in"** (`tables.ts`) adds its step here, raises
// `SNAPSHOT_SCHEMA`, records the new columns in `src/domain/baseline/__fixtures__/columns.json` and adds a fixture test:
// `tests/baseline-shape.test.ts` fails until it does.

/** The content's format at slice 35. */
export const SNAPSHOT_SCHEMA = 1;

/** One step: content of schema n to schema n + 1, pure and idempotent. */
export type SnapshotStep = (content: Record<string, unknown>) => Record<string, unknown>;

/** `STEPS[n]` turns schema n into n + 1. None yet: schema 1 is the first. */
export const SNAPSHOT_STEPS: Readonly<Record<number, SnapshotStep>> = {};

export const newerSnapshotMessage = (schema: number): string =>
  `This baseline was taken by a newer version of InfoMapper (format ${schema}), so it cannot be read here.`;

/** The content in the current schema; a copy when a step ran, the same object otherwise. Throws on a newer schema. */
export function upgradeBaselineContent<T>(content: T, schema: number, steps: Readonly<Record<number, SnapshotStep>> = SNAPSHOT_STEPS, current = SNAPSHOT_SCHEMA): T {
  if (!Number.isInteger(schema) || schema < 1) throw new Error(`Not a baseline format: ${String(schema)}.`);
  if (schema > current) throw new Error(newerSnapshotMessage(schema));
  let out = content as unknown as Record<string, unknown>;
  for (let n = schema; n < current; n++) {
    const step = steps[n];
    if (!step) throw new Error(`No step from baseline format ${n} to ${n + 1}.`);
    out = step(structuredClone(out));
  }
  return out as unknown as T;
}
