import { expect, test } from "./fixtures";
import { canvasUrl, loadItems, loadModel, mappingLine, openCanvas, signInAs } from "./helpers";

test("S1A-01: Customer & orders shows the prototype's cards and lines: entity and source cards with their rows, mapping lines in status colours, relationship lines", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());

  // the prototype's cards (DEMO_LAYOUT.customerOrders), with all their rows
  const names = (testId: string) => page.getByTestId(testId).getByTestId("card-name").allTextContents();
  expect((await names("card-entity")).sort()).toEqual(["Customer", "Order Line", "Sales Order"]);
  expect((await names("card-source")).sort()).toEqual(["customers", "order_header", "order_line", "web_users"]);

  const model = await loadModel();
  const items = await loadItems();
  for (const item of items) {
    const rows = item.entity_id
      ? model.attributes.filter((a) => a.entity_id === item.entity_id).length
      : model.sourceColumns.filter((c) => c.source_table_id === item.source_table_id).length;
    await expect(page.locator(`[data-card="${item.id}"] [data-row]`)).toHaveCount(rows);
  }

  // every mapping between two cards here has a line; the relationships between entities here too
  const here = new Set(items.map((i) => i.entity_id ?? i.source_table_id));
  const columnTable = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const attributeEntity = new Map(model.attributes.map((a) => [a.id, a.entity_id]));
  const drawn = model.mappings.filter(
    (m) =>
      here.has(attributeEntity.get(m.attribute_id)!) &&
      model.mappingInputs.some((i) => i.mapping_id === m.id && here.has(columnTable.get(i.source_column_id)!)),
  );
  expect(drawn.length).toBeGreaterThan(5);
  await expect(page.getByTestId("line-mapping")).toHaveCount(drawn.length);
  const rels = model.relationships.filter((r) => here.has(r.from_entity_id) && here.has(r.to_entity_id));
  await expect(page.getByTestId("line-relationship")).toHaveCount(rels.length);

  // status colours as in the prototype: approved solid, draft dashed, in review dash-dot; type problems orange
  const dash = { approved: "none", draft: "6px, 4px", review: "10px, 3px, 2px, 3px" } as const;
  for (const status of ["approved", "draft", "review"] as const) {
    const m = drawn.find((x) => x.status === status);
    if (!m) continue;
    await expect(mappingLine(page, m.id).locator("path.s")).toHaveCSS("stroke-dasharray", dash[status]);
  }
  const map = await page.locator(".im-canvas").evaluate((el) => getComputedStyle(el).getPropertyValue("--im-map").trim());
  const ok = page.locator(".lnk.map:not(.warn) path.s").first();
  await expect(ok).toHaveCSS("stroke", hexToRgb(map));
});

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
