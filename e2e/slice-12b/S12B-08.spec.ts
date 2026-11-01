import { removeCanvasFromProject } from "../../src/domain/commands/canvas";
import { expect, test } from "./fixtures";
import { asLukasz, CO, OL, OM, RETAIL, SEED_IDS, signInAs, store, thumbnailHref, WS_HOME } from "./helpers";

// S12B-08 (PRD P8, item 9; step 1, F8): on the workspace home each project tile shows its first canvas's thumbnail;
// after the first canvas is removed from the project, the tile shows the next one's.

test("S12B-08: each project tile shows its first canvas; after it leaves the project, the next one", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(WS_HOME);
  const project = (name: string) => page.getByTestId("tile-project").filter({ hasText: name });
  await expect(project("Customer 360").getByTestId("tile-thumbnail")).toHaveCount(1);
  expect(await thumbnailHref(project("Customer 360"))).toContain(`/thumbnail/${CO}?v=`);
  expect(await thumbnailHref(project("Order management"))).toContain(`/thumbnail/${CO}?v=`);
  // the same canvas, the same address: one drawing for both tiles (and for the project homes)
  expect(await thumbnailHref(project("Order management"))).toBe(await thumbnailHref(project("Customer 360")));

  const s = store();
  const [canvas, projectRow, canvasLinks, projectLinks] = await Promise.all([s.canvases.get(RETAIL, CO), s.projects.get(RETAIL, OM), s.canvases.listLinksOfCanvas(RETAIL, CO), s.canvases.listLinksOfProject(RETAIL, OM)]);
  await asLukasz((ctx, access) => removeCanvasFromProject(ctx, access, { canvas, project: projectRow, canvasLinks, projectLinks }, { canvasId: CO, projectId: OM }));
  await page.reload();
  expect(await thumbnailHref(project("Order management"))).toContain(`/thumbnail/${OL}?v=`);
  expect(await thumbnailHref(project("Customer 360"))).toContain(`/thumbnail/${CO}?v=`);
  void SEED_IDS;
});
