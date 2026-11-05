import { expect, test } from "./fixtures";
import { openStar, pathStart, pillOf, relId, relationshipLine, signInAs } from "./helpers";

// RP-01 (R-7, RP-D): on the star, Dim Date and Fact Sales are joined twice; the lines carry the pills "Order date" and
// "Ship date" and are drawn 20 px apart (slice 15b; source lines keep 16 px, R7).

test("RP-01: two lines Dim Date – Fact Sales with the pills Order date and Ship date, 20 px apart", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  const order = relId("date>sales"), ship = relId("date>sales:ship");
  await expect(relationshipLine(page, order)).toHaveCount(1);
  await expect(relationshipLine(page, ship)).toHaveCount(1);
  await expect(pillOf(page, order).locator("text")).toHaveText("Order date");
  await expect(pillOf(page, ship).locator("text")).toHaveText("Ship date");
  // a relationship without a role keeps its verb phrase
  await expect(pillOf(page, relId("cust>sales")).locator("text")).toHaveText("describes");
  const [a, b] = [await pathStart(page, order), await pathStart(page, ship)];
  expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeCloseTo(20, 5);
});
