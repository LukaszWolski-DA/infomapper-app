// Slice 22's helpers: the unknown member's section in a dimension's panel, its stored values in the e2e data file, and
// test data written through the domain.

import type { Locator, Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { setUnknownValue, updateCubeEntity } from "../../src/modules/infocube/domain/commands";
import type { CubeAttribute } from "../../src/modules/infocube/domain/types";
import { E2E_DB } from "../config";
import { asCube, attrId, cubeRow, cubeStore, RETAIL, SEED_IDS, typeEntity } from "../slice-20/helpers";

export * from "../slice-20/helpers";
export { holdUntil, conflictLine } from "../slice-13/helpers";
export { archive } from "../slice-07a/helpers";

type DimKey = Parameters<typeof typeEntity>[0];

// ---- the panel ----
export const unknownField = (page: Page): Locator => page.getByTestId("field-cube-unknown");
export const unknownFlag = (page: Page): Locator => page.getByTestId("flag-cube-unknown").getByRole("button", { name: "Unknown member" });
export const unknownSentence = (page: Page): Locator => page.getByTestId("text-cube-unknown");
export const unknownItems = (page: Page): Locator => page.getByTestId("item-cube-unknown");
/** An attribute's line in the section, by "{star key}.{attribute}" ("cust.segment_code"). */
export const unknownItem = (page: Page, key: string): Locator => page.locator(`[data-testid="item-cube-unknown"][data-attribute="${attrId(key)}"]`);
export const unknownInput = (page: Page, key: string): Locator => unknownItem(page, key).getByTestId("input-cube-unknown");
export const unknownBad = (page: Page, key: string): Locator => unknownItem(page, key).getByTestId("text-cube-unknown-bad");

export const ON_SENTENCE =
  "A row for fact rows whose key is empty or has no match, so they are not lost (Kimball's −1 row; in Data Vault, usually from the ghost record). Its values; an empty field takes the default shown.";
export const OFF_SENTENCE = "No unknown member: a fact row whose key is empty or has no match finds no row here. Turn it on to give it one.";

/** Types a value into an attribute's field and leaves it (the save). */
export async function typeValue(page: Page, key: string, text: string): Promise<void> {
  const input = unknownInput(page, key);
  await input.fill(text);
  await input.press("Tab");
}

// ---- the stored values ----
/** The attribute's live stored value, or null. */
export async function storedValue(key: string): Promise<string | null> {
  return (await cubeStore().modules.list(RETAIL, "cube_attribute")).find((v) => v.attribute_id === attrId(key))?.unknown_value ?? null;
}
/** Every `cube_attribute` row in the file, deleted or not. */
export async function rawValues(): Promise<CubeAttribute[]> {
  return ((await readDb(E2E_DB)) as unknown as { cube_attribute?: CubeAttribute[] }).cube_attribute ?? [];
}
export const unknownOnOf = async (dimension: DimKey): Promise<boolean | null | undefined> => (await cubeRow(typeEntity(dimension)))?.has_unknown_member;

// ---- test data, as the server writes it ----
/** Stores (or clears, with "") an attribute's unknown member's value as Łukasz, through the command. */
export async function setValueAs(key: string, value: string): Promise<void> {
  await asCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const model = await s.model.load(RETAIL);
    const attribute = model.attributes.find((a) => a.id === attrId(key)) ?? null;
    const cube = (await s.modules.list(RETAIL, "cube_entity")).find((c) => c.entity_id === attribute?.entity_id) ?? null;
    const row = (await s.modules.list(RETAIL, "cube_attribute")).find((v) => v.attribute_id === attrId(key)) ?? null;
    return setUnknownValue(ctx, access, { attribute, cube, row }, { attributeId: attrId(key), value, current: row && { id: row.id, version: row.version } });
  });
}

/** Turns a dimension's unknown member on or off as Łukasz, through the command. */
export async function setUnknownAs(dimension: DimKey, on: boolean): Promise<void> {
  await asCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const cube = (await s.modules.list(RETAIL, "cube_entity")).find((c) => c.entity_id === typeEntity(dimension)) ?? null;
    return updateCubeEntity(ctx, access, { cube }, { cubeEntityId: cube!.id, expectedVersion: cube!.version, hasUnknownMember: on });
  });
}

/** The e2e data file as slice 21 left it: no `has_unknown_member` on any `cube_entity` row, no `cube_attribute`. */
export async function writeBeforeSlice22(): Promise<void> {
  const db = (await readDb(E2E_DB)) as unknown as { cube_entity: Record<string, unknown>[]; cube_attribute?: unknown[] };
  db.cube_entity = db.cube_entity.map((r) => {
    const { has_unknown_member, ...rest } = r;
    void has_unknown_member;
    return rest;
  });
  delete db.cube_attribute;
  await writeDb(E2E_DB, db as never);
}

/** The e2e data file with InfoCube turned off in "Retail Co – DWH", its facts and dimensions left (C-7 forbids it through the app). */
export async function writeInfoCubeOff(): Promise<void> {
  const db = (await readDb(E2E_DB)) as unknown as { workspace: { id: string; infocube: boolean }[] };
  db.workspace.find((w) => w.id === RETAIL)!.infocube = false;
  await writeDb(E2E_DB, db as never);
}
