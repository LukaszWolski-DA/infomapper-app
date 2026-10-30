// Slice 10c's steps: copies of attributes (D-63). Test data through the domain (a paste, a type change, a delete), the
// attribute's rows with deleted ones (`rawAttribute`), the row's “Copy” and the card header's “Paste attribute”, and
// the attribute panel's copy sections.

import { expect, type Locator, type Page } from "@playwright/test";
import { deleteAttribute, pasteAttribute, updateAttribute } from "../../src/domain/commands/attribute";
import type { Attribute } from "../../src/domain/types";
import { rawDb } from "../slice-03a/helpers";
import { asLukasz, card, ids, loadModel, rowNamed } from "../slice-01b/helpers";
import { menuOn } from "../slice-10a/helpers";

export * from "../slice-10a/helpers";
export { closeToolbox, toolboxAt } from "../slice-01b/helpers";
export { newSession } from "../slice-00/helpers";
export { rawDb } from "../slice-03a/helpers";

/** A live attribute by its entity's name and its own name (the first one when the name is taken twice). */
export async function attributeOf(entityName: string, name: string): Promise<Attribute> {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === entityName)!;
  const a = model.attributes.find((x) => x.entity_id === entity.id && x.name === name);
  if (!a) throw new Error(`${entityName}.${name}`);
  return a;
}

/** An attribute's stored row, deleted or not. */
export async function rawAttribute(id: string): Promise<Attribute | undefined> {
  return (await rawDb()).attribute.find((a) => a.id === id);
}

/** The live attributes of an entity, in their order. */
export async function attributesOf(entityName: string): Promise<Attribute[]> {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === entityName)!;
  return model.attributes.filter((a) => a.entity_id === entity.id).sort((a, b) => a.sort_order - b.sort_order);
}

/** Test data: pastes a copy of an attribute into an entity, as Łukasz; the copy's id. */
export async function pasteAs(entityName: string, original: Attribute): Promise<string> {
  const model = await loadModel();
  const entity = (await ids()).entity(entityName);
  const r = await asLukasz((ctx, access) => pasteAttribute(ctx, access, { entity, original, attributes: model.attributes }, { entityId: entity.id, attributeId: original.id }));
  return r.attributeId;
}

/** Test data: an attribute's string length, as Łukasz (its copies follow). */
export async function setLengthAs(id: string, length: number): Promise<void> {
  const model = await loadModel();
  const a = model.attributes.find((x) => x.id === id)!;
  await asLukasz((ctx, access) =>
    updateAttribute(ctx, access, { attribute: a, attributes: model.attributes, entities: model.entities }, { attributeId: id, expectedVersion: a.version, type: { dataType: "string", length } }),
  );
}

/** Test data: deletes an attribute, as Łukasz. */
export async function deleteAs(id: string): Promise<void> {
  const model = await loadModel();
  const a = model.attributes.find((x) => x.id === id)!;
  await asLukasz((ctx, access) => deleteAttribute(ctx, access, { attribute: a, mappings: model.mappings, mappingInputs: model.mappingInputs }, { attributeId: id, expectedVersion: a.version }));
}

/** “Copy” in an attribute row's menu, and its toast. */
export async function copyRow(page: Page, cardName: string, rowName: string): Promise<void> {
  await menuOn(page, rowNamed(page, cardName, rowName), "Copy");
}

/** The card header of an entity card. */
export const headOf = (page: Page, cardName: string): Locator => card(page, cardName).locator(".c-head");

/** “Paste attribute “{name}”” in an entity card header's menu. */
export async function pasteOn(page: Page, cardName: string, attributeName: string): Promise<void> {
  await menuOn(page, headOf(page, cardName), `Paste attribute “${attributeName}”`);
}

/** The attribute panel, once it shows the attribute of that id. */
export async function attributePanel(page: Page, id?: string): Promise<Locator> {
  const panel = page.getByTestId("panel-attribute");
  await expect(panel).toBeVisible();
  if (id) await expect(page.getByTestId("panel-attribute").getByTestId("input-attribute-name")).toBeVisible();
  return panel;
}

export const COPY_TOAST = (name: string) => `Copied “${name}”. Paste it with “Paste attribute” in an entity card's menu.`;

/** What the attribute panel shows: "{entity}.{attribute}", or "none". */
export const attributeShown = (page: Page): Promise<string> =>
  page.getByTestId("panel-inspector").evaluate((p) => {
    const panel = p.querySelector("[data-testid='panel-attribute']");
    if (!panel) return "none";
    const entity = panel.querySelector("[data-testid='link-attribute-entity']")?.textContent?.trim();
    const name = (panel.querySelector("[data-testid='input-attribute-name']") as HTMLInputElement | null)?.value;
    return `${entity}.${name}`;
  });

/** Waits until the attribute panel shows "{entity}.{attribute}". */
export const expectAttributeShown = (page: Page, expected: string) => expect.poll(() => attributeShown(page)).toBe(expected);
