// Slice 10a's steps: slice 9's (toasts, change groups, the panels' fields) and the line and row menus of the canvas.
// Step 3: a relationship from an entity to itself as test data, and the earlier slices' panels, history and context.
// Saves are started without waiting for the page: the point of step 2 is that the second write does not need to.

import { expect, type Locator, type Page } from "@playwright/test";
import { createRelationship, updateRelationship } from "../../src/domain/commands/relationship";
import type { Relationship } from "../../src/domain/types";
import { asLukasz, ids, loadModel, pointOnLine } from "../slice-01b/helpers";
import { expectSelected } from "../slice-06b/helpers";

export * from "../slice-09/helpers";
export { canvasCommits, contextOn, linkedTo } from "../slice-03b/helpers";
export { expectHidden, togglePanel, viewportTransform } from "../slice-05a/helpers";
export { backButton, clickCard, expectSelected } from "../slice-06b/helpers";
export { setCard } from "../slice-06a/helpers";
export { dragCardBy } from "../slice-02a/helpers";
export { collapsedFrame, makeFrame, AROUND } from "../slice-02c/helpers";
export { pointOnLine } from "../slice-01b/helpers";

/** A mapping's line on the canvas. */
export const mappingLine = (page: Page, mappingId: string): Locator =>
  page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mappingId}"]`);

/** A relationship's line on the canvas. */
export const relationshipLine = (page: Page, relationshipId: string): Locator =>
  page.getByTestId("layer-lines").locator(`[data-testid="line-relationship"][data-relationship="${relationshipId}"]`);

/** Right-clicks a line and picks an item of its menu (`at` as in `pointOnLine`). */
export async function lineMenu(page: Page, line: Locator, item: string, at = 0.5): Promise<void> {
  const p = await pointOnLine(line, at);
  await page.mouse.click(p.x, p.y, { button: "right" });
  await toolboxItem(page, item).click();
}

/** An item of the open toolbox by its label, without its shortcut or check mark. */
export const toolboxItem = (page: Page, item: string): Locator =>
  page
    .getByTestId("menu-toolbox")
    .getByTestId("toolbox-item")
    .filter({ has: page.locator("span.min-w-0").getByText(item, { exact: true }) });

/** Right-clicks an element (a row, a card's header) and picks an item of its menu. */
export async function menuOn(page: Page, target: Locator, item: string): Promise<void> {
  const b = (await target.boundingBox())!;
  await page.mouse.click(b.x + Math.min(30, b.width / 2), b.y + b.height / 2, { button: "right" });
  await toolboxItem(page, item).click();
}

/** The canvas commit counter (development) once it has not moved for half a second. */
export async function settledCommits(page: Page, read: (page: Page) => Promise<number>): Promise<number> {
  let last = -1;
  for (;;) {
    const now = await read(page);
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(500);
  }
}

/** Test data: a relationship from an entity to itself (step 3), as Łukasz through the domain; its row. */
export async function selfRelationship(entityName: string, ends: Partial<Pick<Relationship, "label" | "from_min" | "from_max" | "to_min" | "to_max">> = {}): Promise<Relationship> {
  const e = (await ids()).entity(entityName);
  const { relationship } = await asLukasz((ctx, access) => createRelationship(ctx, access, { from: e, to: e }, { fromEntityId: e.id, toEntityId: e.id }));
  if (Object.keys(ends).length === 0) return relationship;
  const input = {
    relationshipId: relationship.id,
    expectedVersion: relationship.version,
    ...(ends.label !== undefined ? { label: ends.label } : {}),
    ...(ends.from_min !== undefined ? { fromMin: ends.from_min } : {}),
    ...(ends.from_max !== undefined ? { fromMax: ends.from_max } : {}),
    ...(ends.to_min !== undefined ? { toMin: ends.to_min } : {}),
    ...(ends.to_max !== undefined ? { toMax: ends.to_max } : {}),
  };
  return (await asLukasz((ctx, access) => updateRelationship(ctx, access, { relationship }, input))).relationship;
}

/** "Customer & orders" at 100 %, with room above Customer for its loops (step 4). */
export const LOOP_VIEW = { x: -260, y: 140, zoom: 1 };

/** Clicks a relationship's line (a loop included) at its middle; the details panel shows it. */
export async function clickLine(page: Page, relationshipId: string): Promise<void> {
  const at = await pointOnLine(relationshipLine(page, relationshipId), 0.5);
  await page.mouse.click(at.x, at.y);
  await expectSelected(page, "relationship");
}

/** The relationships of an entity in the data file, deleted ones left out. */
export const relationshipsOf = async (entityId: string): Promise<Relationship[]> =>
  (await loadModel()).relationships.filter((r) => r.from_entity_id === entityId || r.to_entity_id === entityId);

export { expect };
