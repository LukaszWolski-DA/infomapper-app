// S38-06 (slice 38, step 6): a phone shows what matters. At 390 px the top bar keeps the panels' toggles, the path and the
// account and hides the working context, Undo and Redo, the save state and "Local"; the details panel opens below the
// navigation row and the canvas toolbar, so "More" stays in reach; the tab rows scroll with a fade at their end; no
// page scrolls sideways. The check script reports no overlap at 390 px (the step's report).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, signInAs, topBar, WS_HOME } from "./helpers";

const wider = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const faded = (page: Page, testId: string) => page.getByTestId(testId).evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage);

test("S38-06: at 390 px the top bar keeps the toggles, the path and the account; the panel leaves the navigation row and the toolbar free", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl());

  for (const id of ["button-toggle-left", "switcher-organization", "switcher-workspace", "switcher-project", "button-toggle-right", "indicator-user"]) await expect(topBar(page).getByTestId(id)).toBeVisible();
  for (const id of ["button-context", "group-undo", "group-save"]) await expect(topBar(page).getByTestId(id)).toBeHidden();
  expect(await topBar(page).evaluate((b) => b.scrollWidth - b.clientWidth)).toBe(0);
  expect(await wider(page)).toBeLessThanOrEqual(0);
  expect(await faded(page, "tabs-canvases")).toContain("linear-gradient");

  // the details panel over the canvas: below the navigation row and the toolbar
  await page.getByTestId("button-toggle-right").click();
  const panel = page.getByTestId("panel-inspector");
  await expect(panel).toBeVisible();
  const p = (await panel.boundingBox())!;
  const nav = (await page.getByTestId("nav-breadcrumbs").boundingBox())!;
  const bar = (await page.getByTestId("bar-canvas").boundingBox())!;
  expect(p.y).toBeGreaterThanOrEqual(nav.y + nav.height);
  expect(p.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  // "More" in reach with the panel open, and it works
  await page.getByTestId("button-more-tools").click();
  await expect(page.getByTestId("menu-more-tools")).toBeVisible();
  await page.getByTestId("more-changes").click();
  await expect(page.getByTestId("bar-changes")).toBeVisible();
});

test("S38-06: at 390 px the workspace home's tabs scroll with a fade and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "Łukasz");
  await page.goto(WS_HOME);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  expect(await wider(page)).toBeLessThanOrEqual(0);
  await expect(topBar(page).getByTestId("group-undo")).toBeHidden();
  const tabs = page.getByRole("tablist").first();
  expect(await tabs.evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage)).toContain("linear-gradient");
});
