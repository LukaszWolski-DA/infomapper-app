// S22-05 (checks): a stored "abc" in Dim Customer.customer_key gives one High `unkval` line (the row's and the header's
// marks, the attribute's and the entity's panels, the project home, the status bar); Dim Product off gives one Normal
// `nounk` line naming its facts; undo takes each away; InfoCube off shows neither.

import { expect, test, type Page } from "./fixtures";
import {
  boxItems,
  checkGroup,
  checkLines,
  expectMark,
  groupCounts,
  headLine,
  hydrated,
  OM_HOME,
  openAttribute,
  openEntity,
  openStar,
  rowType,
  setUnknownAs,
  setValueAs,
  signInAs,
  statusChecks,
  storedValue,
  typeValue,
  undoButton,
  unknownFlag,
  unknownOnOf,
  writeInfoCubeOff,
} from "./helpers";

const UNKVAL = "Dim Customer.customer_keyunknown member: “abc” is not an Integer";
const NOUNK = "Dim Productused by Fact Sales";
const statusCount = async (page: Page) => Number(((await statusChecks(page).textContent()) ?? "").match(/\d+/)?.[0] ?? 0);
const idsOf = async (page: Page) => (await groupCounts(page)).map(([id]) => id);

test("S22-05: a value that does not fit and a dimension without an unknown member: marks, panels, the home, the status bar; undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await hydrated(page);
  const demo = await groupCounts(page);
  expect(demo.some(([id]) => id === "unkval" || id === "nounk")).toBe(false);

  await openStar(page);
  await hydrated(page);
  const before = await statusCount(page);
  await expectMark(headLine(page, "Dim Customer"), null);
  await expectMark(headLine(page, "Dim Product"), null);

  // "abc" in Dim Customer.customer_key: High, on the row and the header
  await openEntity(page, "Dim Customer");
  await typeValue(page, "cust.customer_key", "abc");
  await expect.poll(() => storedValue("cust.customer_key")).toBe("abc");
  await expectMark(rowType(page, "Dim Customer", "customer_key"), "high");
  await expectMark(headLine(page, "Dim Customer"), "high");
  await expect(boxItems(page).filter({ hasText: "unknown member: “abc” is not an Integer" })).toHaveCount(1);
  await expect.poll(() => statusCount(page)).toBe(before + 1);
  await openAttribute(page, "Dim Customer", "customer_key");
  await expect(boxItems(page).filter({ hasText: "unknown member: “abc” is not an Integer" })).toHaveCount(1);

  // Dim Product turned off: Normal, on its header
  await openEntity(page, "Dim Product");
  await unknownFlag(page).click();
  await expect.poll(() => unknownOnOf("prod")).toBe(false);
  await expectMark(headLine(page, "Dim Product"), "normal");
  await expect(boxItems(page).filter({ hasText: "used by Fact Sales" })).toHaveCount(1);
  await expect.poll(() => statusCount(page)).toBe(before + 2);

  // the project home: High first, each with InfoCube's tag
  await page.goto(OM_HOME);
  await hydrated(page);
  const counts = await groupCounts(page);
  expect(counts.filter(([id]) => id === "unkval" || id === "nounk")).toEqual([["unkval", 1], ["nounk", 1]]);
  expect(counts.filter(([id]) => id !== "unkval" && id !== "nounk")).toEqual(demo);
  expect((await idsOf(page)).indexOf("unkval")).toBeLessThan((await idsOf(page)).indexOf("nounk"));
  await expect(checkLines(page, "unkval")).toHaveText([UNKVAL]);
  await expect(checkLines(page, "nounk")).toHaveText([NOUNK]);
  await expect(checkGroup(page, "unkval").getByTestId("check-title")).toHaveText("Unknown member values that do not fit");
  await expect(checkGroup(page, "nounk").getByTestId("check-title")).toHaveText("Dimensions without an unknown member");
  await expect(checkGroup(page, "unkval").getByTestId("check-module")).toHaveText("InfoCube");
  await expect(checkGroup(page, "unkval")).toContainText("A value of a dimension's unknown member does not fit its attribute's type. Change the value or the type.");
  await expect(checkGroup(page, "nounk")).toContainText("A fact row whose key is empty or has no match finds no row. Turn on the dimension's unknown member, or say in its description why not.");

  // a line opens its object on the project's canvas that shows it
  await checkLines(page, "unkval").click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expectMark(rowType(page, "Dim Customer", "customer_key"), "high");

  // undo takes each away, the newest first
  await undoButton(page).click();
  await expect.poll(() => unknownOnOf("prod")).toBe(true);
  await expectMark(headLine(page, "Dim Product"), null);
  await undoButton(page).click();
  await expect.poll(() => storedValue("cust.customer_key")).toBeNull();
  await expectMark(headLine(page, "Dim Customer"), null);
  await page.goto(OM_HOME);
  await hydrated(page);
  expect(await groupCounts(page)).toEqual(demo);
});

test("S22-05: InfoCube off shows neither group", async ({ page }) => {
  await setValueAs("cust.customer_key", "abc");
  await setUnknownAs("prod", false);
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await hydrated(page);
  expect((await idsOf(page)).filter((id) => id === "unkval" || id === "nounk")).toEqual(["unkval", "nounk"]);
  await writeInfoCubeOff();
  await page.reload();
  await hydrated(page);
  expect((await idsOf(page)).filter((id) => id === "unkval" || id === "nounk")).toEqual([]);
});
