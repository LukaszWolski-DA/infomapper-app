import { expect, test } from "./fixtures";
import {
  backButton,
  card,
  clickCard,
  closeToolbox,
  employeesFile,
  expectHidden,
  expectSelected,
  FK_ORDER,
  freePointOn,
  importKeys,
  loadModel,
  openCanvas,
  place,
  signInAs,
  sourceLine,
  sourceRelationshipId,
  sourceShape,
  togglePanel,
  toolboxAt,
  viewportTransform,
} from "./helpers";

// S10B-06: clicks and hover (item 7, D-62; F7, F8). A click on the stroke selects the table with the key as a click on
// its card does, without moving the view; its panel shows where the details panel is shown, a hidden one stays hidden
// (D-54); Back returns to what was selected before (D-38). A click inside a loop's empty area selects nothing. Hover
// thickens the line. A right-click opens the empty canvas's toolbox. Delete with the line hovered removes nothing;
// after the click it is the card's own Delete (nothing on an ordinary canvas). A reviewer sees the same line.

test("S10B-06: a click selects order_line without moving the view; Back; hover; right-click; Delete", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  const id = await sourceRelationshipId(FK_ORDER);
  const line = sourceLine(page, id);

  // something else first, for Back
  await clickCard(page, "customers");
  await expectSelected(page, "table");
  await expect(page.getByTestId("panel-source-table")).toContainText("customers");

  // hover: the stroke thickens by CSS
  const width = () => line.locator("path.s").evaluate((p) => getComputedStyle(p).strokeWidth);
  expect(await width()).toBe("1.2px");
  const at = await freePointOn(page, id);
  await page.mouse.move(at.x, at.y);
  await expect.poll(width).toBe("2.6px");

  // Delete with the line hovered (customers still selected): nothing goes
  const before = await loadModel();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  await expect(card(page, "customers")).toHaveCount(1);

  // the click: order_line selected, the view where it was
  const view = await viewportTransform(page);
  await page.mouse.click(at.x, at.y);
  await expectSelected(page, "table");
  await expect(page.getByTestId("panel-source-table")).toContainText("order_line");
  await expect(card(page, "order_line").locator("[data-card]")).toHaveClass(/\bsel\b/);
  expect(await viewportTransform(page)).toEqual(view);

  // after the click, Delete is the card's own: on an ordinary canvas nothing goes
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  await expect(card(page, "order_line")).toHaveCount(1);
  await expect(line).toHaveCount(1);
  const after = await loadModel();
  expect(after.sourceRelationships.map((r) => r.id)).toEqual(before.sourceRelationships.map((r) => r.id));

  // Back: customers again
  await backButton(page).click();
  await expect(page.getByTestId("panel-source-table")).toContainText("customers");

  // a right-click: the empty canvas's toolbox, not a line menu
  const items = await toolboxAt(page, at);
  expect(items).toContain("New entity here");
  expect(items.some((i) => /relationship|mapping/i.test(i))).toBe(false);
  await closeToolbox(page);

  // with the details panel hidden, the click selects and the panel stays hidden
  await togglePanel(page, "right");
  await expectHidden(page, "right");
  await page.mouse.click(at.x, at.y);
  await expect(card(page, "order_line").locator("[data-card]")).toHaveClass(/\bsel\b/);
  await expectHidden(page, "right");
});

test("S10B-06: a click inside a loop's empty area selects nothing", async ({ page }) => {
  await importKeys(employeesFile({ manager: true }));
  await place("employees", { x: 80, y: 1000 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 0, y: -700, zoom: 1 });
  await clickCard(page, "employees");
  await expectSelected(page, "table");
  const s = await sourceShape(page, await sourceRelationshipId("FK_employees_manager"), "employees", "employees");
  // between the loop's stroke and the card's corner
  await page.mouse.click(s.from.right + 8, s.from.top - 8);
  await page.waitForTimeout(300);
  await expectSelected(page, "none");
});

test("S10B-06: a reviewer sees the same line", async ({ page }) => {
  await signInAs(page, "Piotr Wiśniewski");
  await openCanvas(page);
  await expect(sourceLine(page, await sourceRelationshipId(FK_ORDER))).toHaveCount(1);
});
