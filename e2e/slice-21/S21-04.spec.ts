// S21-04 (slice 21, item 4, D-66, D-76; acceptance F8, Łukasz's answer 5): InfoMapper's mapping rule keeps its draft
// for its mapping. A rule is typed and the panel is replaced while the field still has the focus: a synthetic click on
// another card's name selects it without a press, so the focus never moves first. With the mapping selected again the
// field shows the typed text, and no other mapping got it. The annotation "path" records what Chromium did: the text
// saved when the field was removed (its blur), or kept as a draft (`keep`). Also: a click on a logical row (a drag start
// since slice 21) leaves the rule saved into its own mapping, as S20-Q10's three clicks.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, freePoint, hydrated, loadModel, openCanvas, rowNamed, signInAs, WHOLE_CO } from "./helpers";
import { mappingId, mappingLines } from "../slice-02c/helpers";

const ruleOf = async (id: string) => (await loadModel()).mappings.find((m) => m.id === id)?.rule_expression ?? null;

async function clickMapping(page: Page, id: string) {
  const at = await freePoint(mappingLines(page, id));
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("panel-mapping").waitFor();
}

test("S21-04: a rule typed, its panel replaced while the field has the focus: the text comes back for its mapping only", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const created = await mappingId("customers.created_ts", "Customer.created_at");
  const other = await mappingId("customers.cust_id", "Customer.customer_id");
  const before = await ruleOf(created);

  await clickMapping(page, created);
  const rule = page.getByTestId("input-mapping-rule");
  const typed = "CAST(created_ts AS date) -- kept";
  await rule.fill(typed);
  await expect(rule).toBeFocused();
  // the panel goes with the field focused: a click event without a press
  await card(page, "Order Line").getByTestId("card-name").dispatchEvent("click");
  await expect(page.getByTestId("panel-mapping")).toHaveCount(0);

  await clickMapping(page, created);
  await expect(page.getByTestId("input-mapping-rule")).toHaveValue(typed);
  expect(await ruleOf(other)).toBeNull();
  const stored = await ruleOf(created);
  const path = stored === typed ? "saved when the field was removed (blur)" : stored === before ? "kept as a draft (keep)" : `other: ${stored}`;
  test.info().annotations.push({ type: "path", description: path });
  console.log(`S21-04 path: ${path}`);
  expect([typed, before]).toContain(stored);
  // leaving the field now saves the draft into its own mapping (D-66: a kept draft is saved when its field is left)
  await page.getByTestId("input-mapping-rule").focus();
  await page.getByTestId("input-mapping-rule").blur();
  await expect.poll(() => ruleOf(created)).toBe(typed);
  expect(await ruleOf(other)).toBeNull();

  // a click on a logical row (it may start a drag since slice 21): the rule is saved into its own mapping
  await clickMapping(page, created);
  await page.getByTestId("input-mapping-rule").fill(`${typed} 2`);
  await rowNamed(page, "Order Line", "quantity").click();
  await expect.poll(() => ruleOf(created)).toBe(`${typed} 2`);
  expect(await ruleOf(other)).toBeNull();
});
