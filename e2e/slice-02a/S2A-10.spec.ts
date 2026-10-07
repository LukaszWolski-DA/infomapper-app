import { expect, test, type Page } from "./fixtures";
import { canvasIn, card, expectToast, key, openCanvas, openCanvasMenu, SEED_IDS, signInAs, store, WHOLE } from "./helpers";

const ws = SEED_IDS.wsRetailDwh;
const lookOf = async (canvasId: string) => (await store().canvases.get(ws, canvasId))!.look;

async function expectDrawn(page: Page, background: string, color: string, grid: "dots" | "lines" | "none") {
  await expect(page.getByTestId("frame-canvas-look")).toHaveAttribute("data-bg", background);
  const area = page.getByTestId("area-canvas");
  await expect(area).toHaveAttribute("data-grid", grid);
  expect(await area.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(color);
  if (grid === "none") await expect(page.getByTestId("canvas-grid")).toHaveCount(0);
  else {
    const image = await page.getByTestId("canvas-grid").evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(image).toContain(grid === "dots" ? "radial-gradient" : "linear-gradient");
  }
}

test("S2A-10: background and grid change per canvas, are drawn, survive a reload and are not undone by Ctrl+Z; “Use this look on all canvases” sets every canvas of the workspace", async ({ page }) => {
  const om = SEED_IDS.projOrderManagement, here = SEED_IDS.canvasCustomerOrders, other = SEED_IDS.canvasOrderLines;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasIn(om, here), WHOLE);
  await expectDrawn(page, "grey", "rgb(232, 236, 240)", "dots");

  // a layout change first, so Ctrl+Z has something to undo
  await card(page, "Customer").getByTestId("card-name").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("button-undo")).toBeEnabled();

  // the tab menu: White and no grid; the overview panel: Lines
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("group-canvas-background").locator('[data-background="white"]').click();
  await menu.getByTestId("group-canvas-grid").locator('[data-grid="none"]').click();
  await expect(menu.getByTestId("group-canvas-background").locator('[data-background="white"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expectDrawn(page, "white", "rgb(255, 255, 255)", "none");
  await page.keyboard.press("Escape"); // nothing selected: the overview panel
  await page.getByTestId("section-canvas-look").getByTestId("group-canvas-grid").locator('[data-grid="lines"]').click();
  await expectDrawn(page, "white", "rgb(255, 255, 255)", "lines");
  await expect.poll(() => lookOf(here)).toEqual({ background: "white", grid: "lines", layer: "all" });
  expect(await lookOf(other)).toEqual({ background: "grey", grid: "dots", layer: "all" }); // per canvas

  // a reload keeps it; Ctrl+Z undoes the card's move, not the look
  await openCanvas(page, canvasIn(om, here));
  await expectDrawn(page, "white", "rgb(255, 255, 255)", "lines");
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move card");
  await expectDrawn(page, "white", "rgb(255, 255, 255)", "lines");
  expect(await lookOf(here)).toEqual({ background: "white", grid: "lines", layer: "all" });
  await key(page, "Control+z"); // nothing left to undo: the look is not a step
  await expect(page.getByTestId("button-undo")).toBeDisabled();
  expect(await lookOf(here)).toEqual({ background: "white", grid: "lines", layer: "all" });

  // the other canvas looks as before; its own layer mode is set to show it stays its own
  await page.getByTestId("tab-canvas").filter({ hasText: "Order lines & products" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${other}$`));
  await expectDrawn(page, "grey", "rgb(232, 236, 240)", "dots");
  await page.getByTestId("switch-layer").locator('[data-layer="relationships"]').click();
  await expect.poll(async () => (await lookOf(other)).layer).toBe("relationships");

  // “Use this look on all canvases” from Customer & orders' menu: background and grid everywhere, layers stay
  const menu2 = await openCanvasMenu(page, "Customer & orders");
  await menu2.getByTestId("menu-item-look-all").click();
  await expectToast(page, "All canvases now use this look.");
  await expectDrawn(page, "white", "rgb(255, 255, 255)", "lines");
  for (const c of await store().canvases.list(ws)) {
    expect(c.look.background, c.name).toBe("white");
    expect(c.look.grid, c.name).toBe("lines");
  }
  expect((await lookOf(other)).layer).toBe("relationships");
  expect((await lookOf(here)).layer).toBe("all");
});
