// S4B2-07 (slice 4b-2, PRD items 20–21, answer C): Focus with requirement cards. A requirement card stays lit when its
// requirement is the Focus target or its scope contains the focused element itself (not a neighbour Focus lights); a lit
// card has its hole in the veil; a trace line is lit (drawn again above the veil) only with both ends lit.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, dragCardBy, linkReq, loadModel, loadRequirementLinks, openCanvas, openRequirement, placeReqCards, reqCard, reqCardData, requirementByKey, signInAs, tracesOfCard, WHOLE } from "./helpers";

const veil = (page: Page) => page.getByTestId("layer-fade");
/** A requirement card's hole: the veil's sub-path for its rectangle (`roundRect`, 8 px corners, 230 px wide). */
async function hasHole(page: Page, key: string) {
  const { x, y } = (await reqCardData(key))!;
  const d = (await veil(page).locator("path").getAttribute("d")) ?? "";
  return d.includes(`M${x + 8},${y}H${x + 222}`);
}
/** The lit copies of a requirement card's trace lines. */
async function litTracesOf(page: Page, key: string) {
  const id = await reqCard(page, key).getAttribute("data-card");
  return page.locator(`[data-testid="lit-trace"][data-trace^="${id}|"]`);
}

test("S4B2-07: requirement cards lit by their requirement or scope, their holes in the veil, trace lines lit only with both ends lit", async ({ page }) => {
  const model = await loadModel();
  const customers = model.sourceTables.find((t) => t.name === "customers")!;
  // test data: REQ-101 (Customer) and REQ-105 (four Customer attributes) get cards beside REQ-104's (seeded: four
  // attributes of Sales Order and Order Line); REQ-104 is also linked to the table customers
  await placeReqCards([
    { key: "REQ-101", x: 1176, y: 1400 },
    { key: "REQ-105", x: 1480, y: 1400 },
  ]);
  await linkReq("REQ-104", { kind: "source_table", id: customers.id });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await expect(await tracesOfCard(page, "REQ-104")).toHaveCount(5);

  // Focus on Customer: REQ-101 (Customer itself) and REQ-105 (its attributes) lit; REQ-104 faded, although Focus lights
  // the table customers, which REQ-104 is linked to (C: the scope must contain Customer itself)
  await card(page, "Customer").locator(".c-head .c-l2").click();
  await page.getByTestId("button-focus").click();
  await expect(veil(page)).toHaveCount(1);
  await expect.poll(() => hasHole(page, "REQ-101")).toBe(true);
  expect(await hasHole(page, "REQ-105")).toBe(true);
  expect(await hasHole(page, "REQ-104")).toBe(false);
  await expect(await litTracesOf(page, "REQ-101")).toHaveCount(1);
  await expect(await litTracesOf(page, "REQ-105")).toHaveCount(4);
  await expect(await litTracesOf(page, "REQ-104")).toHaveCount(0);

  // Focus moves to Sales Order: REQ-104 lit, the others faded; its four attribute lines lit (Sales Order and Order Line
  // are lit), the one to customers not (that table is faded now)
  await card(page, "Sales Order").locator(".c-head .c-l2").click();
  await expect.poll(() => hasHole(page, "REQ-104")).toBe(true);
  expect(await hasHole(page, "REQ-101")).toBe(false);
  expect(await hasHole(page, "REQ-105")).toBe(false);
  await expect(await litTracesOf(page, "REQ-104")).toHaveCount(4);
  const r104 = await requirementByKey("REQ-104");
  const link = (await loadRequirementLinks()).find((k) => k.requirement_id === r104.id && k.source_table_id === customers.id && k.deleted_at === null)!;
  const trace = `${await reqCard(page, "REQ-104").getAttribute("data-card")}|${link.id}`;
  await expect(page.locator(`[data-testid="line-trace"][data-trace="${trace}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-testid="lit-trace"][data-trace="${trace}"]`)).toHaveCount(0);
  await expect(await litTracesOf(page, "REQ-105")).toHaveCount(0);

  // the lit copies follow a drag: every lit line and trace line lies where the line layer draws it (before step 6 the
  // lit mapping and relationship lines kept their old place)
  await dragCardBy(page, "Sales Order", 0, 64);
  const drawnAt = (sel: string) => page.locator(sel).evaluateAll((ps) => ps.map((p) => p.getAttribute("d")));
  await expect
    .poll(async () => {
      const below = new Set(await drawnAt('[data-testid="layer-lines"] path.s, [data-testid="line-trace"]'));
      const lit = await drawnAt('[data-testid="layer-lit-lines"] path.s, [data-testid="lit-trace"]');
      return lit.length > 4 && lit.every((d) => below.has(d));
    })
    .toBe(true);

  // Focus on REQ-104 itself (selected from the Requirements tab, as selecting its card does; at this view the Overview
  // covers its card): only its card lit, and all five lines (its scope is lit)
  await openRequirement(page, "REQ-104");
  await expect(veil(page)).toHaveAttribute("data-fade", /^focus:requirement:/);
  await expect.poll(() => hasHole(page, "REQ-104")).toBe(true);
  expect(await hasHole(page, "REQ-101")).toBe(false);
  expect(await hasHole(page, "REQ-105")).toBe(false);
  await expect(await litTracesOf(page, "REQ-104")).toHaveCount(5);
  await expect(await litTracesOf(page, "REQ-101")).toHaveCount(0);

  // Focus off: no veil, no lit copies
  await page.getByTestId("button-focus").click();
  await expect(veil(page)).toHaveCount(0);
  await expect(page.getByTestId("lit-trace")).toHaveCount(0);
});
