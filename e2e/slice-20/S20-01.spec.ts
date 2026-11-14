// S20-01 (rules, PRD section 2; acceptance doc Q12 as recounted in step 2): on the demo, Order management's home lists
// 15 lines: wrong 1, dup 1, calc 1, norel 1, nokey 1, under 10. Changing Customer.segment_code to Integer adds the
// `feeds` line (High); deleting Sales Order.order_id gives two `lost` lines; clearing Fact Sales' grain gives a `facts`
// line. One undo each, from the home's Undo, takes it back; the page is reloaded once the undo's toast shows (its answer
// has come), since a reload right after the click read the data before the undo's write (fix/s20-01-undo-reload).

import { expect, type Page, test } from "./fixtures";
import { expectToast } from "../slice-00/helpers";
import { canvasUrl, checkLines, groupCounts, hydrated, OM_HOME, openCanvas, openEntity, openStar, rowNamed, signInAs, undoButton, WHOLE_CO } from "./helpers";

const DEMO: [string, number][] = [
  ["wrong", 1],
  ["dup", 1],
  ["calc", 1],
  ["norel", 1],
  ["nokey", 1],
  ["under", 10],
];

async function home(page: Page) {
  await page.goto(OM_HOME);
  await hydrated(page);
}

test("S20-01: the demo's lines, and three changes with their undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await home(page);
  expect(await groupCounts(page)).toEqual(DEMO);
  await expect(checkLines(page, "wrong")).toHaveText(["Customer.last_order_idcopy of Sales Order.order_id, but Customer is the one side of “places”"]);
  await expect(checkLines(page, "nokey")).toHaveText(["Country – Customer Address (locates)Customer Address has no copy of country_code"]);

  // Customer.segment_code to Integer: the approved direct feed into Dim Customer no longer fits (High, first)
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await rowNamed(page, "Customer", "segment_code").click();
  await page.getByTestId("select-attribute-type").selectOption("integer");
  await expect(page.getByTestId("panel-attribute")).toHaveAttribute("data-version", "2");
  await home(page);
  expect(await groupCounts(page)).toEqual([["wrong", 1], ["feeds", 1], ...DEMO.slice(1)]);
  await expect(checkLines(page, "feeds")).toHaveText(["Customer.segment_code → Dim Customer.segment_codetype conflict: Customer.segment_code is Integer, Dim Customer.segment_code is String"]);
  await undoButton(page).click();
  await expectToast(page, /^Undone: /);
  await page.reload();
  expect(await groupCounts(page)).toEqual(DEMO);

  // Sales Order.order_id deleted (its copies stay, D-63): both copies lost; the wrong way goes with the key
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await rowNamed(page, "Sales Order", "order_id").click();
  await page.getByTestId("button-delete-attribute").click();
  await page.getByTestId("button-delete-attribute").click();
  await expect(rowNamed(page, "Sales Order", "order_id")).toHaveCount(0);
  await home(page);
  const lost = await groupCounts(page);
  expect(lost.find(([id]) => id === "lost")).toEqual(["lost", 2]);
  expect(lost.some(([id]) => id === "wrong")).toBe(false);
  await expect(checkLines(page, "lost")).toHaveText([/^Customer\.last_order_idcopy of Sales Order\.order_id, which was deleted$/, /^Order Line\.order_idcopy of Sales Order\.order_id, which was deleted$/]);
  await undoButton(page).click();
  await expectToast(page, /^Undone: /);
  await page.reload();
  expect(await groupCounts(page)).toEqual(DEMO);

  // Fact Sales without a grain: a fact hint, an InfoCube group
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Fact Sales");
  const grain = page.getByTestId("input-cube-grain");
  await grain.fill("");
  await grain.press("Tab");
  await expect.poll(async () => (await page.getByTestId("input-cube-grain").inputValue())).toBe("");
  await page.waitForTimeout(500);
  await home(page);
  expect(await groupCounts(page)).toEqual([...DEMO.slice(0, 5), ["facts", 1], ["under", 10]]);
  await expect(checkLines(page, "facts")).toHaveText(["Fact SalesNo grain yet. Write what one row of this fact stands for."]);
  await expect(page.getByTestId("check-group").filter({ has: page.getByText("Facts to check") }).getByTestId("check-module")).toHaveText("InfoCube");
  await undoButton(page).click();
  await expectToast(page, /^Undone: /);
  await page.reload();
  expect(await groupCounts(page)).toEqual(DEMO);
});
