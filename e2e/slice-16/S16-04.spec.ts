// S16-04 (slice 16, item 2, D-71, D-28): a canvas in two projects, moved in one, keeps its place in the other.

import { addCanvasToProject } from "../../src/domain/commands/canvas";
import { expect, test } from "./fixtures";
import { asLukasz, C360_PROJECT, canvasUrl, OM_PROJECT, OM_URL, openCanvasMenu, orderOf, RETAIL, SEED_IDS, signInAs, store, tabNames } from "./helpers";

const CO = "Customer & orders", OL = "Order lines & products";

test("S16-04: moving a canvas in one project leaves its place in the other", async ({ page }) => {
  // Order lines & products also in Customer 360, after Customer & orders: both projects have [CO, OL]
  const s = store();
  const [canvas, project, canvasLinks, projectLinks] = await Promise.all([
    s.canvases.get(RETAIL, SEED_IDS.canvasOrderLines),
    s.projects.get(RETAIL, C360_PROJECT),
    s.canvases.listLinksOfCanvas(RETAIL, SEED_IDS.canvasOrderLines),
    s.canvases.listLinksOfProject(RETAIL, C360_PROJECT),
  ]);
  await asLukasz((ctx, access) => addCanvasToProject(ctx, access, { canvas, project, canvasLinks, projectLinks }, { canvasId: SEED_IDS.canvasOrderLines, projectId: C360_PROJECT }));
  expect(await orderOf(OM_PROJECT)).toEqual([CO, OL]);
  expect(await orderOf(C360_PROJECT)).toEqual([CO, OL]);

  await signInAs(page, "Łukasz");
  await page.goto(OM_URL());
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const menu = await openCanvasMenu(page, OL);
  await menu.getByTestId("menu-item-move-start").click();
  await expect.poll(() => tabNames(page)).toEqual([OL, CO]);
  expect(await orderOf(OM_PROJECT)).toEqual([OL, CO]);
  expect(await orderOf(C360_PROJECT)).toEqual([CO, OL]);

  await page.goto(canvasUrl(undefined, C360_PROJECT));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await tabNames(page)).toEqual([CO, OL]);
});
