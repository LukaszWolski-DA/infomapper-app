import { createRelationship } from "../../src/domain/commands/relationship";
import { moveOnCanvas } from "../../src/domain/commands/frame";
import { expect, test, type Page } from "../slice-01b/fixtures";
import { asLukasz, card, canvasUrl, ids, lineEnds, loadItems, loadModel, openCanvas, rowNamed, SEED_IDS, signInAs, store } from "../slice-01b/helpers";
import { setCard } from "../slice-06a/helpers";
import { copyRow, pasteOn } from "../slice-10c/helpers";
import { menuOn } from "../slice-10a/helpers";
import { redoButton, undoButton } from "../slice-12a/helpers";
import { item } from "../slice-02b/helpers";
import type { Locator } from "@playwright/test";

// A fix outside any slice (fix/relationship-ends; Łukasz, 7 November 2026): deleting an entity's attributes one by one
// made its card shorter, but the end of a relationship line on the card's bottom edge stayed where it was until a click
// on the canvas. A relationship line ends on a card's bottom (or top) edge when the cards lie one above the other, so it
// depends on the card's height; the line kept its drawing while the card's position, width, collapse and row filter
// were the same. Each case below changes a card's height (or a line's offset) and nothing else the line was drawn from.

/** Customer above Sales Order, as in the seed: the relationship line leaves Customer's bottom edge. */
const VIEW = { x: -100, y: 0, zoom: 0.6 };

/** The live relationship of the demo workspace from one entity to another (the first one, by creation). */
async function relationshipId(from: string, to: string): Promise<string> {
  const m = await loadModel();
  const id = (name: string) => m.entities.find((e) => e.name === name)!.id;
  return m.relationships.find((r) => r.from_entity_id === id(from) && r.to_entity_id === id(to))!.id;
}
const relLine = (page: Page, id: string, layer = "layer-lines") => page.getByTestId(layer).locator(`[data-testid="line-relationship"][data-relationship="${id}"]`);
const bottomOf = async (page: Page, name: string) => {
  const b = (await card(page, name).locator("[data-card]").boundingBox())!;
  return b.y + b.height;
};
const xMiddleOf = async (page: Page, name: string) => {
  const b = (await card(page, name).locator("[data-card]").boundingBox())!;
  return b.x + b.width / 2;
};

/** The line's first drawn point (`start`) or last (`end`) is on the card's bottom edge, within a pixel and a half. */
async function expectOnBottom(page: Page, line: Locator, cardName: string, at: "start" | "end" = "start") {
  await expect
    .poll(async () => {
      const [ends] = await lineEnds(line);
      return Math.round(Math.abs(ends![at].y - (await bottomOf(page, cardName))));
    }, { message: `the line's ${at} on ${cardName}'s bottom edge` })
    .toBeLessThanOrEqual(1);
}

const liveAttributes = async (entity: string) => {
  const m = await loadModel();
  const e = m.entities.find((x) => x.name === entity)!;
  return m.attributes.filter((a) => a.entity_id === e.id && a.deleted_at === null);
};
/** Deletes an attribute from its panel, as Łukasz did (a second click when it has mappings), and waits for its row to go. */
async function deleteFromPanel(page: Page, entity: string, name: string) {
  const m = await loadModel();
  const a = (await liveAttributes(entity)).find((x) => x.name === name)!;
  const asks = m.mappings.some((x) => x.deleted_at === null && x.attribute_id === a.id) || m.attributes.some((x) => x.deleted_at === null && x.copied_from_attribute_id === a.id);
  await rowNamed(page, entity, name).click();
  const del = page.getByTestId("button-delete-attribute");
  await del.click();
  if (asks) {
    await expect(del).toHaveAttribute("data-armed", "true");
    await del.click();
  }
  await expect(rowNamed(page, entity, name)).toHaveCount(0);
}

test("deleting attributes one by one moves the line's end with the shrinking card; undo, redo, add and paste move it too", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  const line = relLine(page, await relationshipId("Customer", "Sales Order"));
  await expectOnBottom(page, line, "Customer");

  // one by one, from the panel
  const plain = await liveAttributes("Customer");
  expect(plain.length).toBeGreaterThanOrEqual(3);
  for (const a of plain.slice(-3)) {
    const before = await bottomOf(page, "Customer");
    await deleteFromPanel(page, "Customer", a.name);
    await expect.poll(() => bottomOf(page, "Customer")).toBeLessThan(before);
    await expectOnBottom(page, line, "Customer");
  }

  // undo brings a row back, redo takes it away again
  await undoButton(page).click();
  const last = plain.at(-1)!.name;
  await expect(rowNamed(page, "Customer", last)).toHaveCount(1);
  await expectOnBottom(page, line, "Customer");
  await redoButton(page).click();
  await expect(rowNamed(page, "Customer", last)).toHaveCount(0);
  await expectOnBottom(page, line, "Customer");

  // the header menu's "Add attribute"
  await menuOn(page, card(page, "Customer").locator(".c-head"), "Add attribute");
  await expect(rowNamed(page, "Customer", "new_attribute")).toHaveCount(1);
  await page.getByTestId("panel-attribute").getByTestId("input-attribute-name").press("Escape");
  await expectOnBottom(page, line, "Customer");

  // a pasted attribute
  await copyRow(page, "Sales Order", "order_date");
  await pasteOn(page, "Customer", "order_date");
  await expect(rowNamed(page, "Customer", "order_date")).toHaveCount(1);
  await expectOnBottom(page, line, "Customer");
});

test("with Focus on, the lit line follows the card's height too (an undo brings a row back)", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  const id = await relationshipId("Customer", "Sales Order");
  const name = (await liveAttributes("Customer")).at(-1)!.name;
  await deleteFromPanel(page, "Customer", name);

  // Focus on Customer (a deleted selection would end it, so the height changes by an undo while Customer is selected)
  await card(page, "Customer").locator(".c-head .c-l2").click({ button: "right" });
  await page.getByTestId("toolbox-focus").click();
  await expect(page.getByTestId("layer-fade")).toHaveCount(1);
  const lit = relLine(page, id, "layer-lit-lines");
  await expectOnBottom(page, lit, "Customer");

  await undoButton(page).click();
  await expect(rowNamed(page, "Customer", name)).toHaveCount(1);
  await expect(page.getByTestId("layer-fade")).toHaveCount(1);
  await expectOnBottom(page, lit, "Customer");
  await expectOnBottom(page, relLine(page, id), "Customer");
});

test("a source table that grows under the Mapped filter moves the source line's end", async ({ page }) => {
  // order_header above order_line, both at the same x: the key's line ends on order_header's bottom edge
  const items = await loadItems();
  const header = await item("order_header");
  const canvas = (await store().canvases.get(SEED_IDS.wsRetailDwh, SEED_IDS.canvasCustomerOrders))!;
  await asLukasz((ctx, access) =>
    moveOnCanvas(ctx, access, { canvas, frames: [], items, entities: [], concepts: [] }, {
      canvasId: canvas.id,
      frames: [],
      items: [{ canvasItemId: header.id, expectedVersion: header.version, x: 1176, y: 120, height: header.height }],
    }),
  );
  await setCard("order_header", { rowFilter: "mapped" });

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -300, y: 0, zoom: 0.6 });
  const line = page.getByTestId("layer-lines").getByTestId("line-source");
  await expect(line).toHaveCount(1);
  await expectOnBottom(page, line, "order_header", "end");

  // map one of order_header's unmapped columns: the Mapped filter now shows it, and the card grows
  const m = await loadModel();
  const table = m.sourceTables.find((t) => t.name === "order_header")!;
  const mappedColumns = new Set(m.mappingInputs.filter((i) => i.deleted_at === null).map((i) => i.source_column_id));
  const column = m.sourceColumns.find((c) => c.source_table_id === table.id && c.deleted_at === null && !mappedColumns.has(c.id))!;
  const before = await bottomOf(page, "order_header");
  await rowNamed(page, "Sales Order", "order_date").click();
  await page.getByTestId("select-add-source-column").selectOption(column.id);
  await expect.poll(() => bottomOf(page, "order_header")).toBeGreaterThan(before);
  await expectOnBottom(page, line, "order_header", "end");
});

test("deleting one of two parallel relationships moves the other to the middle", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer"), order = entity("Sales Order");
  const { relationship: second } = await asLukasz((ctx, access) => createRelationship(ctx, access, { from: customer, to: order }, { fromEntityId: customer.id, toEntityId: order.id }));
  const first = await relationshipId("Customer", "Sales Order");

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  const line = relLine(page, second.id);
  const middle = await xMiddleOf(page, "Customer");
  // the second one is drawn beside the first
  await expect.poll(async () => Math.round(Math.abs((await lineEnds(line))[0]!.start.x - middle))).toBeGreaterThan(5);

  await relLine(page, first).locator("path.hit").click({ force: true });
  await page.getByTestId("button-delete-relationship").click();
  await expect(relLine(page, first)).toHaveCount(0);
  await expect.poll(async () => Math.round(Math.abs((await lineEnds(line))[0]!.start.x - middle))).toBeLessThanOrEqual(1);
});
