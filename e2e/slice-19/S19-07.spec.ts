// S19-07 (in part; CI, the element guard and the two full runs are in the acceptance doc): on the Sales star with slice 19's
// types (an aggregate, a junk dimension, a snapshot, an outrigger and its line), the canvas and the miniature do not
// commit while idle, and a pan adds no canvas commit (S2C-12's and S3B-15's guards). The chips are text and a class on
// existing elements: no element more on a card (AD-24).

import { expect, test } from "./fixtures";
import { canvasCommits, card, emptySpot, openStar, roleOf, settledCommits, signInAs } from "./helpers";
import { miniatureCommits } from "../slice-03b/helpers";

test("S19-07: the star with its types does not commit while idle or panned; a chip adds no element", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension · Outrigger");

  const canvas = await settledCommits(page, canvasCommits);
  const mini = await settledCommits(page, miniatureCommits);
  expect(canvas).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  expect(await canvasCommits(page), "canvas commits while idle").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits while idle").toBe(mini);

  // a pan with the right button on an empty spot (slice 16: no toolbox after a right drag)
  const from = await emptySpot(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(from.x - 120, from.y - 60, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(1000);
  expect(await canvasCommits(page), "canvas commits after a pan").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits after a pan").toBe(mini);

  // each chip is the one span a plain fact's is, its text and the cube's ::before only: no element more
  for (const name of ["Fact Orders", "Dim Category", "Dim Order Flags", "Dim Product", "Fact Sales"]) {
    await expect(roleOf(page, name).locator("*")).toHaveCount(0);
    await expect(card(page, name).getByTestId("card-role")).toHaveCount(1);
  }
});
