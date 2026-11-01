import { expect, test } from "./fixtures";
import { canvasData, expectDrawn, expectedOf, openLiveFor, projectHome, signInAs, thumbnailOf } from "./helpers";

// S12B-06 (PRD item 10; D-10): a label's live canvas has a thumbnail with its full and its context cards.

test("S12B-06: a live canvas's thumbnail shows its full and context cards", async ({ page }) => {
  const canvasId = await openLiveFor("CR-23");
  const data = await canvasData(canvasId);
  expect(data.items.some((i) => i.live_level === "full")).toBe(true);
  expect(data.items.some((i) => i.live_level === "context")).toBe(true);

  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  const tile = page.getByTestId("tile-canvas").filter({ has: page.getByTestId("tile-canvas-live") });
  await expect(tile).toHaveCount(1);
  const t = (await thumbnailOf(page, tile))!;
  expectDrawn(t, expectedOf(data));
  expect(t.rects.filter((r) => r.kind === "entity" || r.kind === "table")).toHaveLength(data.items.filter((i) => i.entity_id || i.source_table_id).length);
});
