// Slice 18's e2e helpers: the earlier slices' steps (through slice 15c's chain: the star, its ids, InfoCube's rows and
// the mapping panel), the calculation section and its picker, and reads of the calculations in the data file.

import type { Locator } from "@playwright/test";
import { addAttribute } from "../../src/domain/commands/attribute";
import { calculateAttribute, setCalculationRule } from "../../src/domain/commands/derivation";
import { deleteMapping } from "../../src/domain/commands/mapping";
import type { AttributeInput } from "../../src/domain/types";
import { asLukasz, RETAIL, store } from "../slice-01b/helpers";
import { cubeStore } from "../slice-15a/helpers";
import { expect, type Page } from "./fixtures";

export * from "../slice-15c/helpers";
export { asUser, asLukasz } from "../slice-01b/helpers";
export { recordToasts, toasts } from "../slice-09/helpers";

/** The live model in the e2e data file, InfoCube's rows included. */
export const liveModel = () => cubeStore().model.load(RETAIL);

/** An attribute by its entity's and its own name. */
export async function attributeNamed(entity: string, name: string) {
  const m = await liveModel();
  const e = m.entities.find((x) => x.name === entity && x.deleted_at === null)!;
  return m.attributes.find((a) => a.entity_id === e.id && a.name === name && a.deleted_at === null)!;
}

/** A calculated attribute's live inputs by name, in order. */
export async function inputsOf(attributeId: string): Promise<string[]> {
  const m = await liveModel();
  return (m.attributeInputs as AttributeInput[])
    .filter((i) => i.attribute_id === attributeId && i.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => m.attributes.find((a) => a.id === i.input_attribute_id)?.name ?? "?");
}

/** Adds an attribute to an entity as Łukasz, through the domain, and names it. */
export async function addAttributeAs(entityName: string, name: string): Promise<string> {
  const m = await store().model.load(RETAIL);
  const e = m.entities.find((x) => x.name === entityName && x.deleted_at === null)!;
  const r = await asLukasz((ctx, access) => addAttribute(ctx, access, { entity: e, attributes: m.attributes }, { entityId: e.id, name }));
  return r.attributeId;
}

/** The attribute panel's "Calculated from" section. */
export const calcSection = (page: Page): Locator => page.getByTestId("panel-attribute").getByTestId("fold-calculation");
/** The calculation picker, shown. */
export async function calcPicker(page: Page): Promise<Locator> {
  const picker = page.getByTestId("picker-calculation");
  await expect(picker).toHaveAttribute("data-shown", "true");
  return picker;
}
/** A picker item by its label. */
export const pickItem = (picker: Locator, label: string): Locator => picker.locator(`[data-testid="picker-item"][data-label="${label}"]`);

/** Picks inputs in the open calculation picker and confirms. */
export async function pickInputs(page: Page, names: readonly string[]): Promise<void> {
  const picker = await calcPicker(page);
  for (const n of names) await pickItem(picker, n).click();
  await picker.getByTestId("picker-confirm").click();
}

/** Waits for the attribute panel to show the stored version (the next edit sends it). */
export async function expectAttributePanelAt(page: Page, attributeId: string): Promise<void> {
  const m = await liveModel();
  const a = m.attributes.find((x) => x.id === attributeId)!;
  await expect(page.getByTestId("panel-attribute")).toHaveAttribute("data-version", String(a.version));
}

export { approvedMapping } from "../slice-04b1/helpers";
export { openRequirement } from "../slice-04a/helpers";
export { gapsOf, lensRows, litModules } from "../slice-15d/helpers";
export { ids } from "../slice-01b/helpers";
export { setCard } from "../slice-06a/helpers";

/** Makes an attribute calculated from others of its entity, as Łukasz, through the domain; with a rule. */
export async function calculateAs(entity: string, name: string, inputs: readonly string[], rule: string | null = null): Promise<void> {
  const a = await attributeNamed(entity, name);
  const m = await liveModel();
  const inputIds = await Promise.all(inputs.map(async (n) => (await attributeNamed(entity, n)).id));
  await asLukasz((ctx, access) => calculateAttribute(ctx, access, { attribute: a, attributes: m.attributes, attributeInputs: m.attributeInputs }, { attributeId: a.id, expectedVersion: a.version, inputIds }));
  if (!rule) return;
  const b = await attributeNamed(entity, name);
  await asLukasz((ctx, access) => setCalculationRule(ctx, access, { attribute: b, attributes: [], attributeInputs: [] }, { attributeId: b.id, expectedVersion: b.version, rule }));
}

/** Deletes a source mapping as Łukasz, through the domain. */
export async function deleteMappingAs(mappingId: string): Promise<void> {
  const m = await store().model.load(RETAIL);
  const mapping = m.mappings.find((x) => x.id === mappingId)!;
  await asLukasz((ctx, access) => deleteMapping(ctx, access, { mapping, inputs: m.mappingInputs }, { mappingId, expectedVersion: mapping.version }));
}

/** A card's count ("8/9"). */
export const cardCount = (page: Page, cardName: string): Locator =>
  page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText(cardName, { exact: true }) }).locator(".cov-t");
/** The Overview's coverage line of an entity ("8 of 9 fed"). */
export const overviewLine = (page: Page, entityName: string): Locator => page.getByTestId("inspector-overview").getByTestId("item-coverage").filter({ hasText: entityName });
