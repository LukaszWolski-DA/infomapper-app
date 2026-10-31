// Slice 11's steps: aliases of entities and attributes and the canvas's names or aliases (D-64). Test data through the
// domain (an alias, the canvas's mode, a card's exception), cards found by their canvas item (a card shows its alias,
// so its name may not be on the page), the two check boxes and the card menu's segments.

import { expect, type Locator, type Page } from "@playwright/test";
import { updateAttribute } from "../../src/domain/commands/attribute";
import { setCanvasNames } from "../../src/domain/commands/canvas";
import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { updateEntity } from "../../src/domain/commands/entity";
import type { NameDimension } from "../../src/domain/model/aliases";
import type { NameMode } from "../../src/domain/types";
import { asLukasz, asUser, loadModel, RETAIL, SEED_IDS, store } from "../slice-01b/helpers";
import { item } from "../slice-02b/helpers";
import { loadItems } from "../slice-02a/helpers";
import { rawDb } from "../slice-03a/helpers";

export * from "../slice-10c/helpers";
export { item } from "../slice-02b/helpers";
export { setCard } from "../slice-06a/helpers";
export { setWidth } from "../slice-10b/helpers";
export { labelItem, liveUrl, openLiveFor } from "../slice-03b/helpers";
export { openEntityFromTree } from "../slice-04a/helpers";
export { placeReqCards } from "../slice-04b2/helpers";

export const CO = SEED_IDS.canvasCustomerOrders;
/** Customer & orders at 50 %: every card's rows drawn (above 40 %) and the seed's cards in view. */
export const HALF = { x: 0, y: 0, zoom: 0.5 };
/** At 100 % with Customer in view (slice 1b's `LEFT_AT_100`). */
export const FULL = { x: 0, y: 0, zoom: 1 };

/** Test data: an entity's alias, as Łukasz (or another person). */
export async function setEntityAlias(name: string, alias: string | null, userId: string = SEED_IDS.userLukasz): Promise<void> {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === name)!;
  await asUser(userId, (ctx, access) => updateEntity(ctx, access, { entity, entities: model.entities, concept: null }, { entityId: entity.id, expectedVersion: entity.version, alias }));
}

/** Test data: an attribute's alias, as Łukasz. */
export async function setAttributeAlias(entityName: string, name: string, alias: string | null): Promise<void> {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === entityName)!;
  const a = model.attributes.find((x) => x.entity_id === entity.id && x.name === name)!;
  await asLukasz((ctx, access) => updateAttribute(ctx, access, { attribute: a, attributes: model.attributes, entities: model.entities }, { attributeId: a.id, expectedVersion: a.version, alias }));
}

/** Test data: the canvas's mode in one dimension, clearing the cards' exceptions there, as a person (Łukasz). */
export async function setNamesAs(dimension: NameDimension, mode: NameMode, canvasId: string = CO, userId: string = SEED_IDS.userLukasz): Promise<void> {
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  const items = await loadItems(RETAIL, canvasId);
  await asUser(userId, (ctx, access) =>
    setCanvasNames(ctx, access, { canvas, items }, { canvasId, dimension, mode, cards: items.map((i) => ({ canvasItemId: i.id, expectedVersion: i.version })) }),
  );
}

/** Test data: a card's exception (its choice; none when it equals the canvas's mode), as Łukasz. */
export async function setException(name: string, choice: { entityNames?: NameMode; attributeNames?: NameMode }, canvasId: string = CO): Promise<void> {
  const i = await item(name, canvasId);
  const canvas = (await store().canvases.get(RETAIL, canvasId))!;
  await asLukasz((ctx, access) => updateCanvasItem(ctx, access, { item: i, canvas }, { canvasItemId: i.id, expectedVersion: i.version, ...choice }));
}

/** The canvas row as stored. */
export const canvasRow = async (canvasId: string = CO) => (await rawDb()).canvas.find((c) => c.id === canvasId)!;
/** A card's stored exceptions, by its entity's name. */
export const exceptionsOf = async (name: string, canvasId: string = CO) => {
  const i = await item(name, canvasId);
  return { entity: i.entity_names, attribute: i.attribute_names };
};

/** A card on the page by its canvas item (its header may show an alias). */
export const cardOf = (page: Page, itemId: string): Locator => page.locator(`.react-flow__node [data-card="${itemId}"]`);
/** What a card's header shows. */
export const headerOf = (page: Page, itemId: string): Locator => cardOf(page, itemId).getByTestId("card-name");
/** What an attribute row shows (its name span). */
export const rowTextOf = (page: Page, itemId: string, attributeId: string): Locator => cardOf(page, itemId).locator(`[data-row="${attributeId}"] .nm`);
/** The ids of a card of Customer & orders and of one of its attributes. */
export async function idsOf(entityName: string, attributeName?: string, canvasId: string = CO): Promise<{ itemId: string; attributeId: string }> {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === entityName)!;
  const i = await item(entityName, canvasId);
  const a = attributeName ? model.attributes.find((x) => x.entity_id === entity.id && x.name === attributeName)! : undefined;
  return { itemId: i.id, attributeId: a?.id ?? "" };
}

/** The top bar's check boxes. */
export const entityBox = (page: Page): Locator => page.getByTestId("check-entity-aliases");
export const attributeBox = (page: Page): Locator => page.getByTestId("check-attribute-aliases");
/** A check box's state: `name`, `alias` or `mixed` (its `data-state`), checked against the DOM's own properties. */
export async function expectBox(box: Locator, state: "name" | "alias" | "mixed"): Promise<void> {
  await expect(box).toHaveAttribute("data-state", state);
  expect(await box.evaluate((e: HTMLInputElement) => ({ checked: e.checked, indeterminate: e.indeterminate }))).toEqual({ checked: state === "alias", indeterminate: state === "mixed" });
}

/** Right-clicks a card's header and picks a segment's option (“Entity name” or “Attribute names”: “Name” or “Alias”). */
export async function pickSegment(page: Page, itemId: string, seg: "entity" | "attribute", label: "Name" | "Alias"): Promise<void> {
  const head = cardOf(page, itemId).locator(".c-head");
  const b = (await head.boundingBox())!;
  await page.mouse.click(b.x + Math.min(30, b.width / 2), b.y + b.height / 2, { button: "right" });
  await page.getByTestId(seg === "entity" ? "seg-entity-name" : "seg-attribute-names").getByRole("button", { name: label, exact: true }).click();
}

/** Tints: whether a card's header and its rows' area carry the exception's class. */
export const tintOf = (page: Page, itemId: string) =>
  cardOf(page, itemId).evaluate((c) => ({ header: !!c.querySelector(".c-head.alt"), rows: !!c.querySelector(".c-body.alt, .c-lod.alt") }));
