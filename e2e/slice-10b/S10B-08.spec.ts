import { expect, test } from "./fixtures";
import { FK_ORDER, labelItem, liveUrl, loadModel, openCanvas, openLiveFor, signInAs, sourceLine, sourceLines, sourceRelationshipId } from "./helpers";

// S10B-08: live canvases and the miniature (items 10, 11; F11, F18). On a live canvas the line is drawn between its two
// table cards, a context card included, and never faded. The miniature draws its relationship lines as before and none
// for a source relationship.

test("S10B-08: on a live canvas the line joins a labeled table and a context card, not faded", async ({ page }) => {
  const model = await loadModel();
  const lineTable = model.sourceTables.find((t) => t.name === "order_line")!;
  const header = model.sourceTables.find((t) => t.name === "order_header")!;
  const ordId = model.sourceColumns.find((c) => c.source_table_id === header.id && c.name === "ord_id")!;
  // order_line labeled itself; order_header only through a column: a context card
  await labelItem("Keys", { kind: "source_table", id: lineTable.id });
  await labelItem("Keys", { kind: "source_column", id: ordId.id });
  const canvasId = await openLiveFor("Keys");

  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(canvasId));
  await expect(page.locator(".card.src.ctx")).toHaveCount(1);
  const line = sourceLine(page, await sourceRelationshipId(FK_ORDER));
  await expect(line).toHaveCount(1);
  await expect(line).not.toHaveClass(/ctxline/);
});

test("S10B-08: the miniature draws no line for a source relationship", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await expect(sourceLines(page)).toHaveCount(1);
  const mini = page.getByTestId("panel-overview");
  // one line per relationship drawn on the canvas, one per mapping's pair of cards, nothing else
  const relationships = await page.getByTestId("layer-lines").getByTestId("line-relationship").count();
  await expect(mini.locator("line.mr")).toHaveCount(relationships);
  await expect(mini.locator("line:not(.mr):not(.mm)")).toHaveCount(0);
});
