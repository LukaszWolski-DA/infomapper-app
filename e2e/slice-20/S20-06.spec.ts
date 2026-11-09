// S20-06 (in part: the element guard, the LayerTree read, the benches and the measuring sitting are in the acceptance
// doc): on the Sales star with its marks (Customer orange, Product, Sales Order and Customer Address grey), the canvas
// and the miniature do not commit while idle or after a pan (S2C-12's and S3B-15's guards); the status bar's count,
// clicked with nothing selected, adds no canvas commit of its own; hovering a mark (its title is built then) adds none.

import { expect, test } from "./fixtures";
import { canvasCommits, emptySpot, expectMark, headLine, hydrated, openStar, rowType, settledCommits, signInAs, statusChecks } from "./helpers";
import { miniatureCommits } from "../slice-03b/helpers";

test("S20-06: no canvas commit while idle, panned, on the count's click or a mark's hover", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await expectMark(headLine(page, "Customer"), "high");
  await expectMark(headLine(page, "Customer Address"), "normal");
  await expect(statusChecks(page)).toHaveText("Model checks 15");

  const canvas = await settledCommits(page, canvasCommits);
  const mini = await settledCommits(page, miniatureCommits);
  expect(canvas).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  expect(await canvasCommits(page), "canvas commits while idle").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits while idle").toBe(mini);

  // a pan with the right button on an empty spot
  const from = await emptySpot(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(from.x - 120, from.y - 60, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(1000);
  expect(await canvasCommits(page), "canvas commits after a pan").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits after a pan").toBe(mini);

  // the count, clicked with nothing selected: the panel's group, no canvas commit
  await statusChecks(page).click();
  await expect(page.getByTestId("section-canvas-checks")).toBeInViewport();
  await page.waitForTimeout(1000);
  expect(await canvasCommits(page), "canvas commits after the count's click").toBe(canvas);

  // a mark's title is built on hover, with no commit
  await rowType(page, "Customer", "last_order_id").hover();
  await expect(rowType(page, "Customer", "last_order_id")).toHaveAttribute("title", /^Model checks: 1\n/);
  await page.waitForTimeout(500);
  expect(await canvasCommits(page), "canvas commits after a mark's hover").toBe(canvas);
  expect(await miniatureCommits(page)).toBe(mini);
});
