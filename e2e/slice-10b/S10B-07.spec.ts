import { expect, test } from "./fixtures";
import { approvedMapping, clickCard, fade, fadeTables, FK_ORDER, loadModel, openCanvas, signInAs, sourceLine, sourceRelationshipId } from "./helpers";

// S10B-07: Focus and the Changes view (item 8, D-62; F6). A source line is lit (drawn again above the veil, with its
// arrow) only when both of its cards are lit. Focus on Order Line, whose mappings read order_line and, as test data,
// order_header: lit. Focus on order_line alone: it lights no other table, so the line fades. The Changes view's request
// is a lit set of tables: both tables lit, lit; one, faded.

const litSource = (page: import("./fixtures").Page) => page.getByTestId("layer-lit-lines").getByTestId("lit-source");

test("S10B-07: Focus lights the line when both tables are lit, and fades it when one is", async ({ page }) => {
  const model = await loadModel();
  const header = model.sourceTables.find((t) => t.name === "order_header")!;
  const line = model.entities.find((e) => e.name === "Order Line")!;
  const ordId = model.sourceColumns.find((c) => c.source_table_id === header.id && c.name === "ord_id")!;
  const orderId = model.attributes.find((a) => a.entity_id === line.id && a.name === "order_id")!;
  await approvedMapping(orderId.id, ordId.id);

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  const id = await sourceRelationshipId(FK_ORDER);

  // Focus on Order Line: both tables lit
  await clickCard(page, "Order Line");
  await page.getByTestId("button-focus").click();
  await expect(page.getByTestId("layer-fade")).toBeAttached();
  await expect(litSource(page)).toHaveCount(1);
  await expect(litSource(page)).toHaveAttribute("data-source-relationship", id);
  await expect(litSource(page).locator("path.ar")).toHaveCount(1);

  // Focus on order_line alone: order_header is not lit, the line stays under the veil
  await clickCard(page, "order_line");
  await expect(page.getByTestId("layer-fade")).toBeAttached();
  await expect(litSource(page)).toHaveCount(0);
  await expect(sourceLine(page, id)).toHaveCount(1);
});

test("S10B-07: the Changes view's lit set lights the line with both tables, not with one", async ({ page }) => {
  const model = await loadModel();
  const t = (name: string) => model.sourceTables.find((x) => x.name === name)!.id;
  await signInAs(page, "Łukasz");
  await openCanvas(page);

  await fadeTables(page, [t("order_line"), t("order_header")], "lit:changes:both");
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /both/);
  await expect(litSource(page)).toHaveCount(1);

  await fadeTables(page, [t("order_line")], "lit:changes:one");
  await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /one/);
  await expect(litSource(page)).toHaveCount(0);

  await fade(page, null);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
});
