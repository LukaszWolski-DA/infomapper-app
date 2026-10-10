import { expect, test } from "./fixtures";
import { AROUND, blockEl, canvasTab, canvasUrl, collapsedFrame, frameEl, loadFrames, makeFrame, openCanvas, openCanvasMenu, signInAs, FRAMED } from "./helpers";

test("S2C-09: Duplicate layout keeps each frame's collapsed state", async ({ page }) => {
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await makeFrame(AROUND.sales, { name: "Sales" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("menu-item-duplicate").click();
  await expect(canvasTab(page, "Customer & orders (copy)")).toHaveAttribute("aria-selected", "true");
  const copyId = new URL(page.url()).pathname.split("/c/")[1]!;
  const copies = await loadFrames(copyId);
  expect(copies.map((f) => [f.name, f.collapsed]).sort()).toEqual([
    ["Sales", false],
    ["Tables", true],
  ]);
  // the copy draws the same: a block for Tables, the frame Sales
  await expect(blockEl(page, "Tables")).toBeVisible();
  await expect(frameEl(page, "Sales")).toBeVisible();
});
