// S4B2-05 (slice 4b-2, PRD item 16): “Add to this canvas” on an entity and a table panel whose card is not on the open
// canvas, where “Remove from this canvas” stands; it places the card at the view's centre, upper third, and selects it;
// with the card here the panel offers “Remove from this canvas” instead.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, linkReq, loadItems, loadModel, openCanvas, openRequirement, signInAs } from "./helpers";

const VIEW = { x: 10, y: 10, zoom: 0.42 };

const viewRect = (page: Page) =>
  page.evaluate(() => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec((document.querySelector(".react-flow__viewport") as HTMLElement).style.transform)!;
    const [tx, ty, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    return { x: -tx / z, y: -ty / z, w: pane.width / z, h: pane.height / z };
  });

test("S4B2-05: “Add to this canvas” on an entity and a table panel without a card; hidden when the card is here", async ({ page }) => {
  const model = await loadModel();
  const product = model.entities.find((e) => e.name === "Product")!;
  const items = model.sourceTables.find((t) => t.name === "items")!;
  // test data: REQ-101 traced to Product and to the table items, neither on “Customer & orders”
  await linkReq("REQ-101", { kind: "entity", id: product.id });
  await linkReq("REQ-101", { kind: "source_table", id: items.id });
  await signInAs(page, "Łukasz");

  for (const [name, panel, find] of [
    ["Product", "panel-entity", (i: { entity_id: string | null }) => i.entity_id === product.id],
    ["items", "panel-source-table", (i: { source_table_id: string | null }) => i.source_table_id === items.id],
  ] as const) {
    await openCanvas(page, canvasUrl(), VIEW);
    await openRequirement(page, "REQ-101");
    await page.getByTestId("item-req-trace").filter({ hasText: new RegExp(`^${name}`) }).getByRole("button").first().click();
    await expect(page.getByTestId(panel)).toBeVisible();
    await expect(page.getByTestId("button-remove-card")).toHaveCount(0);
    const v = await viewRect(page);
    await page.getByTestId("button-add-card").click();
    await expect.poll(async () => (await loadItems()).some(find as (i: unknown) => boolean)).toBe(true);
    const placed = (await loadItems()).find(find as (i: unknown) => boolean)!;
    expect(placed.x).toBe(Math.round((v.x + v.w / 2 - 128) / 8) * 8);
    expect(placed.y).toBe(Math.round((v.y + v.h / 3) / 8) * 8);
    // selected; the panel now offers “Remove from this canvas”, not “Add to this canvas”
    await expect(page.locator(`[data-card="${placed.id}"]`)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("button-remove-card")).toBeVisible();
    await expect(page.getByTestId("button-add-card")).toHaveCount(0);
  }
});
