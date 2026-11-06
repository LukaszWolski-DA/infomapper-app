import { expect, test } from "./fixtures";
import {
  backButton,
  clickCard,
  clickCubeLine,
  collapse,
  cubeLine,
  cubeLines,
  cubeMappingId,
  cubePanel,
  deleteCubeMappingElsewhere,
  expectSelected,
  forwardButton,
  freePoint,
  hydrated,
  liveCubeMappings,
  makeFrame,
  openStar,
  recordToasts,
  rowNamed,
  signInAs,
  STAR,
  toasts,
  toolboxItem,
  veil,
} from "./helpers";

// S15-22 (C7, C8, X6, D-38): a dimensional line on the canvas. A hover lights a row's lines both ways and a line's
// rows; Focus on a selected line keeps its cards and the lines between them lit; a card in a collapsed frame leaves
// its lines out, not bundled; the miniature has none; Delete and its Undo; the line's menu; a selected line is a
// history place, and one that no longer exists says so.

test("S15-22: hover both ways, Focus on a line, a collapsed frame and the miniature leave the lines out", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);

  // a logical row: its two lines (Fact Sales.quantity and net_amount) and the rows at their ends
  await rowNamed(page, "Order Line", "quantity").locator(".dt").hover();
  await expect(page.getByTestId("hover-module")).toHaveCount(2);
  // quantity itself, Fact Sales.quantity, Fact Sales.net_amount and net_amount's other inputs unit_price, discount_pct
  await expect(page.getByTestId("hover-row")).toHaveCount(5);
  // a dimensional row: its line back to the logical row
  await rowNamed(page, "Dim Customer", "segment_code").locator(".dt").hover();
  await expect(page.getByTestId("hover-module")).toHaveCount(1);
  await expect(page.getByTestId("hover-row")).toHaveCount(2);
  // a line: its rows
  const net = cubeLine(page, cubeMappingId("sales.net_amount"));
  const p = await freePoint(net);
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId("hover-row")).toHaveCount(4);

  // Focus on a selected line: its two cards stay lit, and the lines between them
  await clickCubeLine(page, cubeMappingId("cust.segment_code"));
  await page.getByTestId("button-focus").click();
  await expect.poll(() => veil(page)).toEqual({ key: `focus:ext:${cubeMappingId("cust.segment_code")}`, litCards: 2 });
  const lit = page.getByTestId("lit-module");
  await expect(lit.and(page.locator(`[data-ext="${cubeMappingId("cust.segment_code")}"]`))).toHaveCount(1);
  await expect(lit).toHaveCount(2); // customer_number and segment_code come from Customer
  await page.getByTestId("button-focus").click();
  await expect.poll(() => veil(page)).toBeNull();

  // the miniature draws no dimensional line (the star has no source card: no mapping pair either)
  await expect(page.locator(".overview line.mm")).toHaveCount(0);

  // Dim Customer in a collapsed frame: its four lines are left out, not bundled
  const frame = await makeFrame({ x: 760, y: 20, width: 300, height: 260 }, { canvasId: STAR });
  await collapse(frame);
  await page.reload();
  await expect(cubeLines(page)).toHaveCount(16);
  await expect(page.getByTestId("line-bundle").and(page.locator("[data-count]"))).toHaveCount(0);
  await collapse(frame, false);
  await page.reload();
  await expect(cubeLines(page)).toHaveCount(20);
});

test("S15-22: the line's menu, Delete with Undo, and a selected line as a history place", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  const city = cubeMappingId("cust.city");

  // the menu (prototype): its head, the status, the rule, the delete
  const at = await freePoint(cubeLine(page, city));
  await page.mouse.click(at.x, at.y, { button: "right" });
  const menu = page.getByTestId("menu-toolbox");
  await expect(menu).toContainText("Customer Address.city → Dim Customer.city");
  expect(await menu.locator('[data-testid="toolbox-item"] span.min-w-0').allInnerTexts()).toEqual(["Draft", "In review", "Approved", "Edit transformation rule…", "Delete mapping"]);
  await toolboxItem(page, "Approved").click();
  await expect(cubeLine(page, city)).toHaveClass(/\bcmap approved\b/);
  await expect.poll(async () => (await liveCubeMappings()).find((m) => m.id === city)?.status).toBe("approved");

  // Delete: gone at once, Undo in the toast brings it back
  await clickCubeLine(page, city);
  await page.keyboard.press("Delete");
  await expect(cubeLine(page, city)).toHaveCount(0);
  await expect.poll(() => toasts(page)).toContain("Mapping deleted");
  expect((await liveCubeMappings()).some((m) => m.id === city)).toBe(false);
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(cubeLine(page, city)).toHaveCount(1);
  expect((await liveCubeMappings()).find((m) => m.id === city)?.status).toBe("approved");

  // a history place: Back to the selected line, Forward to the card
  const segment = cubeMappingId("cust.segment_code");
  await clickCubeLine(page, segment);
  await clickCard(page, "Fact Sales");
  await expectSelected(page, "entity:Fact Sales");
  await backButton(page).click();
  await expect(cubePanel(page)).toHaveAttribute("data-mapping", segment);
  await expect(cubeLine(page, segment)).toHaveClass(/\bsel\b/);
  await forwardButton(page).click();
  await expectSelected(page, "entity:Fact Sales");

  // deleted elsewhere (the page learns it with its next data, here a reload, which keeps the history): Back says so and
  // selects nothing
  await deleteCubeMappingElsewhere(segment);
  await page.reload();
  await hydrated(page);
  await backButton(page).click();
  await expect.poll(() => toasts(page)).toContain("That mapping no longer exists.");
  await expect(cubePanel(page)).toHaveCount(0);
  await expectSelected(page, "none");
});
