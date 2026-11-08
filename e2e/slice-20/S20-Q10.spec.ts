// S20-Q10 (acceptance doc Q10; Łukasz's step 1 answer 10 (a)): a guard for the prototype's field bug. A transformation
// rule typed in a mapping's panel, then a click on another mapping's line, on a card or on the empty canvas, is saved
// into that mapping, and never into what the click selects. InfoMapper's mapping panel and InfoCube's.

import { expect, type Page, test } from "./fixtures";
import { canvasUrl, card, clickCubeLine, cubeLine, cubeMappingId, cubeMappingRow, emptySpot, freePoint, hydrated, openCanvas, openStar, signInAs, WHOLE_CO } from "./helpers";
import { loadModel } from "../slice-01a/helpers";
import { mappingId, mappingLines } from "../slice-02c/helpers";

const ruleOf = async (id: string) => (await loadModel()).mappings.find((m) => m.id === id)?.rule_expression ?? null;

async function clickMapping(page: Page, id: string) {
  const at = await freePoint(mappingLines(page, id));
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("panel-mapping").waitFor();
}

test("S20-Q10: a rule left by a click elsewhere is saved into its own mapping", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const created = await mappingId("customers.created_ts", "Customer.created_at");
  const other = await mappingId("customers.cust_id", "Customer.customer_id");

  // InfoMapper's mapping: three ways of leaving the rule
  const leaves: [string, () => Promise<void>][] = [
    ["another mapping", () => clickMapping(page, other)],
    ["a card", () => card(page, "Order Line").getByTestId("card-name").click()],
    ["the empty canvas", async () => {
      const at = await emptySpot(page);
      await page.mouse.click(at.x, at.y);
    }],
  ];
  for (const [i, [what, leave]] of leaves.entries()) {
    await clickMapping(page, created);
    const rule = page.getByTestId("input-mapping-rule");
    await rule.fill(`CAST(created_ts AS date) -- ${i}`);
    await leave();
    await expect.poll(() => ruleOf(created), what).toBe(`CAST(created_ts AS date) -- ${i}`);
    expect(await ruleOf(other), what).toBeNull();
  }

  // InfoCube's dimensional mapping: the same
  await openStar(page);
  await hydrated(page);
  const dateKey = cubeMappingId("sales.date_key");
  const customerKey = cubeMappingId("sales.customer_key");
  const before = (await cubeMappingRow(customerKey))!.rule_expression;
  const cubeLeaves: [string, () => Promise<void>][] = [
    ["another mapping", () => clickCubeLine(page, customerKey)],
    ["a card", () => card(page, "Dim Date").getByTestId("card-name").click()],
    ["the empty canvas", async () => {
      const at = await emptySpot(page);
      await page.mouse.click(at.x, at.y);
    }],
  ];
  for (const [i, [what, leave]] of cubeLeaves.entries()) {
    await clickCubeLine(page, dateKey);
    const rule = page.getByTestId("input-cube-rule");
    await rule.fill(`yyyymmdd(order_date) -- ${i}`);
    await leave();
    await expect.poll(async () => (await cubeMappingRow(dateKey))?.rule_expression, what).toBe(`yyyymmdd(order_date) -- ${i}`);
    expect((await cubeMappingRow(customerKey))!.rule_expression, what).toBe(before);
  }
  await expect(cubeLine(page, dateKey)).toHaveCount(1);
});
