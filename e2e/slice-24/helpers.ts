// Slice 24's helpers: the Metadata conventions tab's Entity stereotypes box (a row by code, its fields, the Add row, the
// remove dialog), the e2e data file's stereotypes and entities, and test data written through the domain (an entity's
// stereotype as Łukasz).

import { expect, type Locator, type Page } from "@playwright/test";
import { readDb } from "../../src/data/local/file";
import { updateEntity } from "../../src/domain/commands/entity";
import { E2E_DB } from "../config";
import { asLukasz, loadModel, RETAIL } from "../slice-07c/helpers";

export * from "../slice-23/helpers";
export { asLukasz as asLukaszOnModel } from "../slice-07c/helpers";
export { card, canvasUrl, openCanvas, treeItem } from "../slice-01a/helpers";
export { openEntityFromTree } from "../slice-04a/helpers";
export { archive } from "../slice-07a/helpers";

export const box = (page: Page): Locator => page.getByTestId("box-stereotypes");
/** A row of the box by its stereotype's code. */
export const stRow = (page: Page, code: string): Locator => page.locator(`[data-testid="stereotype-row"][data-code="${code}"]`);
export const stName = (row: Locator) => row.getByTestId("input-stereotype-name");
export const stDefinition = (row: Locator) => row.getByTestId("input-stereotype-definition");
/** The codes of the box's rows, in their order. */
export const stCodes = (page: Page) => box(page).getByTestId("stereotype-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-code")));

/** Types a name (and, when given, a code) into the Add row and presses Add. */
export async function addStereotype(page: Page, name: string, code?: string) {
  await page.getByTestId("input-new-stereotype").fill(name);
  if (code !== undefined) await page.getByTestId("input-new-stereotype-code").fill(code);
  await page.getByTestId("button-add-stereotype").click();
}

/** Retail Co – DWH's stereotypes in the e2e data file, removed ones too. */
export const storedStereotypes = async (ws: string = RETAIL) => (await readDb(E2E_DB)).stereotype.filter((s) => s.workspace_id === ws);
export const storedStereotype = async (code: string, ws: string = RETAIL) => (await storedStereotypes(ws)).find((s) => s.code === code);
/** An entity of Retail Co – DWH in the e2e data file, by name. */
export const storedEntity = async (name: string) => (await loadModel()).entities.find((e) => e.name === name)!;

/** Test data: an entity's stereotype, as Łukasz, through the domain (the undo history is not touched). */
export const setStereotypeAs = (entityName: string, code: string) =>
  asLukasz((m) => {
    const entity = m.entities.find((e) => e.name === entityName)!;
    return (ctx, access) => updateEntity(ctx, access, { entity, entities: m.entities, concept: null, stereotypes: m.stereotypes }, { entityId: entity.id, expectedVersion: entity.version, stereotype: code });
  });

/** The stereotype label of an entity's card (its first line's first span). */
export const cardStereotype = (cardLocator: Locator) => cardLocator.locator(".c-l1 .stereo");

/** Waits for a row's stored name, after a save. */
export async function expectStoredName(code: string, name: string) {
  await expect.poll(async () => (await storedStereotype(code))?.name).toBe(name);
}
