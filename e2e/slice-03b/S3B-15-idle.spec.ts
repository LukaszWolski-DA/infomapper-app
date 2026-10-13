// S3B-15 (d): the guard of S2C-12 and S3A-14's idle test on a live canvas. Context cards (their own class, tooltip and
// filter), faded mappings and bold rows must not make the canvas commit while nobody touches it, neither at 100 % nor
// below 40 % zoom; nor may the miniature redraw.

import { expect, test, type Page } from "./fixtures";
import { canvasCommits, ids, labelItem, liveUrl, miniatureCommits, openCanvas, openLiveFor, signInAs } from "./helpers";

async function expectIdle(page: Page) {
  await expect(page.locator("[data-card][data-live=context]").first()).toBeVisible();
  await page.waitForTimeout(1500);
  const canvas = await canvasCommits(page), mini = await miniatureCommits(page);
  expect(canvas).toBeGreaterThan(0); // the counters work
  expect(mini).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  expect(await canvasCommits(page), "canvas commits while idle").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits while idle").toBe(mini);
}

test("S3B-15 (guard): a live canvas with context cards and faded mappings does not re-render while idle, at 100 % and below 40 % zoom", async ({ page }) => {
  const { attribute, table } = await ids();
  // context cards (Sales Order, web_users), a full table whose mappings into Customer are faded (customers)
  await labelItem("CR-23", { kind: "attribute", id: attribute("Sales Order", "order_date").id });
  await labelItem("CR-23", { kind: "source_table", id: table("customers").id });
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 1 });
  await expect(page.locator(".lnk.ctxline").first()).toBeAttached();
  await expectIdle(page);
  await openCanvas(page, liveUrl(live), { x: 10, y: 10, zoom: 0.3 });
  await expectIdle(page);
});
