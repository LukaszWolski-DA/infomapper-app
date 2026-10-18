// S4B2-03 (slice 4b-2, PRD items 8–11): trace lines. One per link of the requirement to an element on the canvas, from
// the requirement card's nearest edge to the element's card edge at the header (entity, table), the row (attribute,
// column) or the mapping line's middle; none to an element off the canvas; at a collapsed frame they end at the member's
// row in its block; they follow a moved card; hidden in “Mappings” and “Relationships”.

import { expect, test, type Page } from "./fixtures";
import {
  AROUND,
  box,
  canvasUrl,
  card,
  collapsedFrame,
  dragCardBy,
  linkReq,
  loadItems,
  loadModel,
  loadRequirementLinks,
  mappingLine,
  openCanvas,
  pointOnLine,
  reqCard,
  RETAIL,
  SEED_IDS,
  store,
  requirementByKey,
  signInAs,
  traceEnds,
  tracesOfCard,
  zoomOf,
} from "./helpers";

const VIEW = { x: 10, y: 10, zoom: 0.42 };
const near = (a: number, b: number, d = 2) => Math.abs(a - b) <= d;
const layerButton = (page: Page, layer: string) => page.getByTestId("switch-layer").locator(`[data-layer="${layer}"]`);

/** The trace line of REQ-104's link to a target, by the link's id. */
async function traceTo(page: Page, column: "entity_id" | "attribute_id" | "mapping_id" | "source_table_id" | "source_column_id", id: string) {
  const r = await requirementByKey("REQ-104");
  const link = (await loadRequirementLinks()).find((k) => k.requirement_id === r.id && k[column] === id && k.deleted_at === null)!;
  const cardId = await reqCard(page, "REQ-104").getAttribute("data-card");
  return page.locator(`[data-testid="line-trace"][data-trace="${cardId}|${link.id}"]`);
}

test("S4B2-03: trace lines to cards, rows and mapping middles, none off the canvas; at collapsed frames to the block row; following a move; hidden in Mappings and Relationships", async ({ page }) => {
  // a long test (about a minute): room for a slow run (slice 4b-2, step 4)
  test.setTimeout(120_000);
  const model = await loadModel();
  const entity = (name: string) => model.entities.find((e) => e.name === name)!;
  const table = (name: string) => model.sourceTables.find((t) => t.name === name)!;
  const customer = entity("Customer");
  const email = model.sourceColumns.find((c) => c.source_table_id === table("customers").id && c.name === "email_addr")!;
  const mapping = model.mappings.find((m) => model.attributes.find((a) => a.id === m.attribute_id)?.entity_id === customer.id)!;
  // test data: REQ-104 (four attributes of Sales Order and Order Line, seeded) linked also to Customer, order_header, a
  // column of customers, a mapping onto Customer and Product (not on this canvas)
  await linkReq("REQ-104", { kind: "entity", id: customer.id });
  await linkReq("REQ-104", { kind: "source_table", id: table("order_header").id });
  await linkReq("REQ-104", { kind: "source_column", id: email!.id });
  await linkReq("REQ-104", { kind: "mapping", id: mapping.id });
  await linkReq("REQ-104", { kind: "entity", id: entity("Product").id });

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  // one line per link to an element here: 4 seeded + Customer, order_header, the column, the mapping; none to Product
  await expect(await tracesOfCard(page, "REQ-104")).toHaveCount(8);
  await expect(await traceTo(page, "entity_id", entity("Product").id)).toHaveCount(0);

  const z = await zoomOf(page);
  const req = await box(reqCard(page, "REQ-104"));
  // every line starts on the requirement card's edge (everything lies to its left: its left edge)
  for (const line of await (await tracesOfCard(page, "REQ-104")).all()) {
    const { start } = await traceEnds(line);
    expect(near(start.x, req.x), `starts at the card's left edge: ${start.x} vs ${req.x}`).toBe(true);
    expect(start.y).toBeGreaterThanOrEqual(req.y - 1);
    expect(start.y).toBeLessThanOrEqual(req.y + req.height + 1);
  }
  // an entity: the card's nearer (right) edge, at the header's middle
  const cust = await box(card(page, "Customer").locator("[data-card]"));
  let end = (await traceEnds(await traceTo(page, "entity_id", customer.id))).end;
  expect(near(end.x, cust.x + cust.width) && near(end.y, cust.y + 27 * z), `Customer end ${JSON.stringify(end)}`).toBe(true);
  // a table: the same at order_header
  const oh = await box(card(page, "order_header").locator("[data-card]"));
  end = (await traceEnds(await traceTo(page, "source_table_id", table("order_header").id))).end;
  expect(near(end.x, oh.x + oh.width) && near(end.y, oh.y + 27 * z)).toBe(true);
  // an attribute and a column: their rows' height
  const total = model.attributes.find((a) => a.name === "total_amount")!;
  for (const [column, rowId, cardName] of [["attribute_id", total.id, "Sales Order"], ["source_column_id", email!.id, "customers"]] as const) {
    const row = await box(card(page, cardName).locator(`[data-row="${rowId}"]`));
    const c = await box(card(page, cardName).locator("[data-card]"));
    end = (await traceEnds(await traceTo(page, column, rowId))).end;
    expect(near(end.x, c.x + c.width) && near(end.y, row.y + row.height / 2), `${cardName} row end ${JSON.stringify(end)}`).toBe(true);
  }
  // a mapping: the middle of its line
  const mid = await pointOnLine(mappingLine(page, mapping.id), 0.5);
  end = (await traceEnds(await traceTo(page, "mapping_id", mapping.id))).end;
  expect(near(end.x, mid.x, 3) && near(end.y, mid.y, 3), `mapping end ${JSON.stringify(end)} vs ${JSON.stringify(mid)}`).toBe(true);

  // following a moved card
  const before = (await traceEnds(await traceTo(page, "entity_id", customer.id))).end;
  await dragCardBy(page, "Customer", 0, 64);
  await expect.poll(async () => Math.round((await traceEnds(await traceTo(page, "entity_id", customer.id))).end.y - before.y)).toBeGreaterThan(40);

  // hidden in Mappings and Relationships, back in Everything
  await layerButton(page, "mappings").click();
  await expect(page.getByTestId("line-trace")).toHaveCount(0);
  await layerButton(page, "relationships").click();
  await expect(page.getByTestId("line-trace")).toHaveCount(0);
  await layerButton(page, "all").click();
  await expect(await tracesOfCard(page, "REQ-104")).toHaveCount(8);
  // the layer is saved per canvas (S2A-11): wait for “all” in the data before the page is opened again below
  await expect.poll(async () => (await store().canvases.get(RETAIL, SEED_IDS.canvasCustomerOrders))!.look.layer).toBe("all");

  // a collapsed frame around Sales Order and Order Line: their lines end at their rows in the block
  const frameId = await collapsedFrame(AROUND.sales);
  await openCanvas(page, canvasUrl(), VIEW);
  const block = await box(page.locator(`[data-testid="block-member"]`).first().locator("xpath=ancestor::*[contains(@class,'fblock')]"));
  for (const name of ["Sales Order", "Order Line"]) {
    const cardId = (await loadItems()).find((i) => i.entity_id === entity(name).id)!.id;
    const member = await box(page.locator(`[data-testid="block-member"][data-member="${cardId}"]`));
    const attr = model.attributes.find((a) => a.entity_id === entity(name).id && ["total_amount", "quantity"].includes(a.name))!;
    end = (await traceEnds(await traceTo(page, "attribute_id", attr.id))).end;
    expect(near(end.x, block.x + block.width) && near(end.y, member.y + member.height / 2), `${name} block row end ${JSON.stringify(end)}`).toBe(true);
  }
  expect(frameId).toBeTruthy();
  await expect(await tracesOfCard(page, "REQ-104")).toHaveCount(8);
});
