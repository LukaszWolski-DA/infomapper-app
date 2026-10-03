import { expect, test, type Page } from "./fixtures";
import { box, canvasUrl, card, HEADER_MIDDLE, lineEnds, loadItems, loadModel, mappingLine, openCanvas, signInAs } from "./helpers";

/** The lines that read a column of `customers`, and whether each has an end on the card's header (left or right edge). */
async function headerEnds(page: Page) {
  const model = await loadModel();
  const customers = model.sourceTables.find((t) => t.name === "customers")!;
  const columns = new Map(model.sourceColumns.filter((c) => c.source_table_id === customers.id).map((c) => [c.id, c]));
  const maps = model.mappings.filter((m) => model.mappingInputs.some((i) => i.mapping_id === m.id && columns.has(i.source_column_id)));
  const c = await box(card(page, "customers").locator("[data-card]"));
  const result: { mappingId: string; atHeader: boolean }[] = [];
  for (const m of maps) {
    const ends = (await lineEnds(mappingLine(page, m.id))).flatMap((e) => [e.start, e.end]);
    const atHeader = ends.some((p) => Math.abs(p.y - (c.y + HEADER_MIDDLE)) < 1.5 && (Math.abs(p.x - c.x) < 1.5 || Math.abs(p.x - (c.x + c.width)) < 1.5));
    result.push({ mappingId: m.id, atHeader });
  }
  return result;
}

test("S1A-04: collapsing a card and filtering rows re-anchors hidden rows' lines to the header", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  const customers = card(page, "customers").locator("[data-card]");
  expect((await headerEnds(page)).every((e) => !e.atHeader)).toBe(true);

  // collapsed: header only, every line of the card ends at the header
  await customers.getByTestId("button-card-collapse").click();
  await expect(customers).toHaveAttribute("data-collapsed", "true");
  await expect(customers.locator("[data-row]")).toHaveCount(0);
  await expect.poll(async () => (await headerEnds(page)).every((e) => e.atHeader)).toBe(true);

  await customers.getByTestId("button-card-collapse").click();
  await expect(customers).not.toHaveAttribute("data-collapsed", "true");
  await expect.poll(async () => (await headerEnds(page)).every((e) => !e.atHeader)).toBe(true);

  // filter "Unmapped": the mapped rows are hidden, so all lines of the card go to the header; "Mapped" brings them back
  await customers.getByTestId("button-card-filter").click(); // all → mapped
  await expect(customers).toHaveAttribute("data-filter", "mapped");
  await expect.poll(async () => (await headerEnds(page)).every((e) => !e.atHeader)).toBe(true);
  await customers.getByTestId("button-card-filter").click(); // mapped → unmapped
  await expect(customers).toHaveAttribute("data-filter", "unmapped");
  await expect.poll(async () => (await headerEnds(page)).every((e) => e.atHeader)).toBe(true);

  // the state is saved with the card
  const cardId = await customers.getAttribute("data-card");
  await expect.poll(async () => (await loadItems()).find((i) => i.id === cardId)?.row_filter).toBe("unmapped");
  await page.reload();
  await expect(card(page, "customers").locator("[data-card]")).toHaveAttribute("data-filter", "unmapped");
});
