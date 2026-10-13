import { expect, test } from "./fixtures";
import { canvasUrl, liveUrl, openCanvas, openLiveFor, RETAIL, SEED_IDS, signInAs, WHOLE_CO } from "./helpers";

// The view-state bar's “Live: {name}” chip belongs to the view-state bar slice (slice 6, D-39; PRD item 8).
test("S3B-08: the tab icon, the overview box with “Open label” and the tile icon on the project home are shown; on a normal canvas none of them", async ({ page }) => {
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");

  // the live canvas: its tab's tag icon with the tooltip, the overview's box
  await openCanvas(page, liveUrl(live), WHOLE_CO);
  const liveTab = page.getByTestId("tab-canvas").filter({ hasText: "CR-23" });
  await expect(liveTab.getByTestId("tab-canvas-live")).toHaveAttribute("title", "Live canvas: shows everything labeled CR-23");
  await expect(page.getByTestId("tab-canvas-live")).toHaveCount(1); // the other tabs have none
  const box = page.getByTestId("box-live-canvas");
  await expect(box).toHaveText(
    "This is the live canvas for CR-23. Everything labeled CR-23 appears here by itself. Adding an entity here adds the label; removing one takes the label off.Open label",
  );
  await box.getByTestId("button-live-open-label").click();
  await expect(page.getByTestId("panel-label")).toBeVisible();
  await expect(page.getByTestId("input-label-name")).toHaveValue("CR-23");

  // the project home: the live canvas's tile has the icon, the others none
  await page.goto(`/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`);
  const tile = page.getByTestId("tile-canvas").filter({ hasText: "CR-23" });
  await expect(tile.getByTestId("tile-canvas-live")).toHaveAttribute("title", "Live canvas: shows everything labeled CR-23");
  await expect(page.getByTestId("tile-canvas-live")).toHaveCount(1);

  // a normal canvas: no box (the overview shows its usual text)
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await expect(page.getByTestId("box-live-canvas")).toHaveCount(0);
  await expect(page.getByTestId("tab-canvas").filter({ hasText: "Customer & orders" }).getByTestId("tab-canvas-live")).toHaveCount(0);
});
