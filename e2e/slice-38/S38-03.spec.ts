// S38-03 (slice 38, step 4): the homes are pages. The project home has no side panels and no panels' toggles (B4); both
// homes run up to 1,320 px, centred, with the prototype's gutters; the project home is in two columns above 1,100 px
// (the work on the left: model consistency, model checks, Canvases; the lists on the right, 420 px: Requirements without
// the kind's name, Labels, Open notes, Other projects) and in one column at 1,100 px and less, in the same order, the
// delete section below at full width. "Other projects" and "Other workspaces in {organization}" (B3) are shown only when
// there is another; the lifecycle grid takes four in a row (B5). Leaving a home for a canvas, the canvas comes back as it
// was left, never shifted.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, openCanvas, projectPath, SEED_IDS, signInAs, viewportTransform, WHOLE_CO, WS_HOME } from "./helpers";

const box = async (page: Page, testId: string) => (await page.getByTestId(testId).first().boundingBox())!;

test("S38-03: the project home is a page in two columns above 1,100 px and one at 1,100 px, with “Other projects”", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectPath());
  await expect(page.getByTestId("page-project-home")).toBeVisible();

  // a page: no side panels, no panels' toggles
  for (const id of ["panel-left", "panel-inspector", "button-toggle-left", "button-toggle-right"]) await expect(page.getByTestId(id)).toHaveCount(0);

  // two columns at 1,280 px: the work on the left, the lists (420 px) on the right, side by side
  const work = await box(page, "column-project-work"), lists = await box(page, "column-project-lists");
  expect(Math.round(lists.width)).toBe(420);
  expect(lists.x).toBeGreaterThanOrEqual(work.x + work.width + 47);
  expect(Math.abs(lists.y - work.y)).toBeLessThan(1);
  for (const id of ["section-consistency", "section-checks", "tiles-canvases"]) {
    const b = await box(page, id);
    expect(b.x + b.width, `${id} in the left column`).toBeLessThanOrEqual(work.x + work.width + 1);
  }
  for (const id of ["list-project-requirements", "section-other-projects"]) {
    const b = await box(page, id);
    expect(b.x, `${id} in the right column`).toBeGreaterThanOrEqual(lists.x - 1);
  }

  // a requirement's row: its kind's icon and key, its name, no kind's name
  const row = page.getByTestId("item-project-requirement").filter({ hasText: "REQ-101" });
  await expect(row).toContainText("Single view of the customer");
  await expect(row).not.toContainText("Business need");

  // “Other projects”: the hint and the other project with its canvas count, a link to its home
  const other = page.getByTestId("section-other-projects");
  await expect(other.getByRole("heading")).toHaveText("Other projects");
  await expect(other).toContainText("The model is shared by all 2 projects: an entity changed here is changed everywhere.");
  await expect(other.getByTestId("item-other-project")).toHaveCount(1);
  await expect(other.getByTestId("item-other-project")).toHaveText(/^Order management\s*2 canvases$/);
  await expect(other.getByTestId("item-other-project")).toHaveAttribute("href", projectPath(SEED_IDS.projOrderManagement));

  // the delete section below both columns, at the content's width
  const del = await box(page, "section-project-delete");
  expect(del.y).toBeGreaterThanOrEqual(Math.max(work.y + work.height, lists.y + lists.height) - 1);

  // at 1,100 px one column, in the same order: the work above the lists
  await page.setViewportSize({ width: 1100, height: 770 });
  await expect.poll(async () => (await box(page, "column-project-lists")).y).toBeGreaterThan((await box(page, "column-project-work")).y + 100);
  expect(Math.abs((await box(page, "column-project-lists")).x - (await box(page, "column-project-work")).x)).toBeLessThan(1);

  // at 1,920 px the content stops at 1,320 px, centred
  await page.setViewportSize({ width: 1920, height: 900 });
  const content = await page.getByTestId("columns-project-home").boundingBox();
  expect(Math.round(content!.width)).toBe(1320);
  expect(Math.abs(content!.x + content!.width / 2 - 960)).toBeLessThan(2);

  // a workspace with one project has no “Other projects”
  await page.goto(projectPath(SEED_IDS.projBankFirst).replace(SEED_IDS.wsRetailDwh, SEED_IDS.wsBankX));
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  await expect(page.getByTestId("section-other-projects")).toHaveCount(0);
});

test("S38-03: the workspace home runs up to 1,320 px with 240 px tiles and ends with “Other workspaces in …”", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto(WS_HOME);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  const tiles = await box(page, "tiles-projects");
  expect(Math.round(tiles.width)).toBe(1320);
  const tile = await box(page, "tile-project");
  expect(tile.width).toBeGreaterThanOrEqual(240);

  // the organization's other workspaces, at the Overview's end
  const other = page.getByTestId("section-other-workspaces");
  await expect(other.getByRole("heading")).toHaveText("Other workspaces in InfoMate");
  // the seed's Bank X is archived: its row says so after its name
  await expect(other.getByTestId("item-other-workspace")).toHaveCount(1);
  await expect(other.getByTestId("item-other-workspace")).toHaveText(/^Bank X – Risk DWH\s*archived$/);
  await expect(other.getByTestId("item-other-workspace")).toHaveAttribute("href", `/w/${SEED_IDS.wsBankX}`);
  // another tab has none of it
  await page.getByTestId("tab-people").click();
  await expect(page.getByTestId("section-other-workspaces")).toHaveCount(0);

  // the only workspace of its organization: none
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect(page.getByTestId("section-other-workspaces")).toHaveCount(0);
});

test("S38-03: leaving a home for a canvas, the canvas comes back as it was left, never shifted", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const before = await viewportTransform(page);
  // the project home by its tab, then the canvas by its tile
  await page.getByTestId("tab-home").click();
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  await page.getByTestId("tile-canvas").first().click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await viewportTransform(page)).toEqual(before);
  // the workspace home, then the canvas again
  await page.goto(WS_HOME);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await page.goto(canvasUrl());
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await viewportTransform(page)).toEqual(before);
});
