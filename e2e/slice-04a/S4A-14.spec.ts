// S4A-14: the canvas is unchanged by slice 4a. This part runs with every e2e run: opening requirement panels and the
// go-to fallback's element panels neither emphasise nor fade a line, select a card or row, add a card or move the view,
// and an idle canvas does not commit. The element counts against slice 3b are S4A-14-elements.spec.ts (measurement
// build); S2C-12, S3A-14's and S3B-15's idle tests and S3B-13 run unchanged in the normal suite.

import { expect, test, type Page } from "./fixtures";
import { canvasCommits, canvasUrl, openCanvas, openRequirement, SEED_IDS, signInAs } from "./helpers";

/** What the canvas draws, as far as a selection can change it. */
const drawn = (page: Page) =>
  page.evaluate(() => ({
    cards: document.querySelectorAll("[data-card]").length,
    selected: document.querySelectorAll("[data-card].sel, .row.sel").length,
    lines: [...document.querySelectorAll("[data-testid=line-mapping], [data-testid=line-relationship]")].map((l) => (l as Element).getAttribute("class")).join("|"),
    view: (document.querySelector(".react-flow__viewport") as HTMLElement).style.transform,
  }));

test("S4A-14 (canvas): requirement panels and element panels without a card leave the canvas as it was drawn, and it stays idle", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), { x: 0, y: 0, zoom: 0.6 });
  await page.waitForTimeout(800);
  const before = await drawn(page);
  expect(before.cards).toBeGreaterThan(0);

  await openRequirement(page, "REQ-104");
  expect(await drawn(page)).toEqual(before);
  await openRequirement(page, "REQ-102");
  // Customer has no card here: its attribute's panel opens alone
  await page.getByTestId("item-req-trace").filter({ hasText: "Customer.first_name" }).getByRole("button").first().click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  expect(await drawn(page)).toEqual(before);

  // idle with a requirement's panel open: no commits
  await openRequirement(page, "REQ-101");
  await page.waitForTimeout(1500);
  const commits = await canvasCommits(page);
  await page.waitForTimeout(2500);
  expect(await canvasCommits(page), "canvas commits while idle").toBe(commits);
});
