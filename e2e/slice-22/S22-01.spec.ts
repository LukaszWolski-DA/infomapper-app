// S22-01 (data): every seeded dimension has its unknown member on and no stored value, a fact has none; the adapter
// refuses a fact with one (the CHECK); a file written before slice 22 loads with every dimension on, in the store and in
// the panel, and the first write stores the column.

import { buildWriteSet, type Write } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { expect, test } from "./fixtures";
import {
  cubeEntities,
  cubeStore,
  hydrated,
  openEntity,
  openStar,
  rawValues,
  RETAIL,
  SEED_IDS,
  signInAs,
  unknownFlag,
  unknownItems,
  unknownOnOf,
  writeBeforeSlice22,
} from "./helpers";

test("S22-01: the seeded star: every dimension on, no stored value, a fact none; the CHECK", async () => {
  const rows = await cubeEntities();
  expect(rows.filter((c) => c.role === "dimension").map((c) => c.has_unknown_member)).toEqual([true, true, true, true, true]);
  expect(rows.filter((c) => c.role === "fact").map((c) => c.has_unknown_member)).toEqual([null, null]);
  expect(await rawValues()).toEqual([]);

  const fact = rows.find((c) => c.role === "fact")!;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const forced = await cubeStore().apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "cube_entity", before: fact, row: { ...fact, version: fact.version + 1, has_unknown_member: true } }] as Write[]));
  expect(!forced.ok && forced.error.message).toMatch(/cube_entity_shape_ck/);
});

test("S22-01: a file written before slice 22 loads with the unknown member on, and a write stores the column", async ({ page }) => {
  await writeBeforeSlice22();
  expect((await cubeEntities()).filter((c) => c.role === "dimension").every((c) => c.has_unknown_member === true)).toBe(true);
  expect((await cubeEntities()).filter((c) => c.role === "fact").every((c) => c.has_unknown_member === null)).toBe(true);

  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Dim Customer");
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true");
  await expect(unknownItems(page)).toHaveCount(5);

  // the first write to the table (turning Dim Customer's off) passes with the older rows beside it
  await unknownFlag(page).click();
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => unknownOnOf("cust")).toBe(false);
  expect(await unknownOnOf("prod")).toBe(true);
});
