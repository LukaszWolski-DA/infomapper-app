// Slice 17's e2e helpers: the earlier slices' steps it uses (through slice 16's chain), the picker, the requirement
// cards, the history buttons, and a few reads of the data file.

import type { Locator } from "@playwright/test";
import { RETAIL, store } from "../slice-01b/helpers";
import { expect, type Page } from "./fixtures";

export * from "../slice-16/helpers";
export { pickConcept } from "../slice-01b/helpers";
export { linkFromPanel, newRequirementFromPanel, loadRequirementLinks, requirementByKey, tracesOf, openEntityFromTree } from "../slice-04a/helpers";
export { placeReqCards, reqCard, reqCardData } from "../slice-04b2/helpers";
export { backButton, expectSelected, selected } from "../slice-06b/helpers";
export { setCard } from "../slice-06a/helpers";
export { item, namePoint } from "../slice-02b/helpers";
export { addNote } from "../slice-12b/helpers";
export { lastGroup } from "../slice-03b/helpers";
export { expectToast } from "../slice-00/helpers";

/** The concept picker, shown (opened hidden until its size is known). */
export const conceptPicker = (page: Page) => page.getByTestId("picker-concept");
export async function expectConceptPicker(page: Page, role: "entity" | "fact" | "dimension"): Promise<Locator> {
  const picker = conceptPicker(page);
  await expect(picker).toHaveAttribute("data-shown", "true");
  await expect(picker.getByTestId("picker-title")).toHaveText(`Concept for the new ${role}`);
  // nothing preselected: no item is selected, and the filter field has the focus
  await expect(picker.locator('[aria-selected="true"]')).toHaveCount(0);
  await expect(picker.getByTestId("picker-filter")).toBeFocused();
  return picker;
}

/** The live entities in the data file, by name. */
export const entitiesNamed = async (name: string) => (await store().model.load(RETAIL)).entities.filter((e) => e.name === name && e.deleted_at === null);

/** An entity's live attributes in their order. */
export async function attributeOrder(entityId: string): Promise<string[]> {
  const m = await store().model.load(RETAIL);
  return m.attributes
    .filter((a) => a.entity_id === entityId && a.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => a.id);
}

/** A frame in the data file by id. */
export const frameRow = async (frameId: string, canvasId: string) => (await store().frames.listOfCanvas(RETAIL, canvasId)).find((f) => f.id === frameId)!;

/** Drags with a real mouse from the middle of an element by `dx`, `dy` screen pixels, in steps. */
export async function dragBy(page: Page, el: Locator, dx: number, dy: number): Promise<void> {
  const b = (await el.boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

/** Drags with a real mouse from the middle of one element to the middle of another (or a point), in steps. */
export async function dragOnto(page: Page, from: Locator, to: { x: number; y: number } | Locator, options: { release?: boolean } = {}): Promise<void> {
  const a = (await from.boundingBox())!;
  const end = "boundingBox" in to ? await (async () => { const b = (await to.boundingBox())!; return { x: b.x + Math.min(60, b.width / 2), y: b.y + b.height / 2 }; })() : to;
  const x = a.x + a.width / 2, y = a.y + a.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + ((end.x - x) * i) / 12, y + ((end.y - y) * i) / 12);
  if (options.release !== false) await page.mouse.up();
}
