// S22-06 (deletes and roles): deleting an attribute with a stored value takes it in one undo step, undo brings both;
// changing the attribute's type keeps the value and adds or removes the `unkval` line; a reader and a reviewer see the
// flag disabled and the fields read-only; an archived workspace is read only.

import { expect, test } from "./fixtures";
import {
  archive,
  boxItems,
  checkLines,
  groupCounts,
  hydrated,
  OM_HOME,
  openAttribute,
  openEntity,
  openStar,
  rawValues,
  rowNamed,
  setUnknownAs,
  setValueAs,
  signInAs,
  storedValue,
  undoButton,
  unknownBad,
  unknownFlag,
  unknownInput,
  unknownItems,
  unknownSentence,
  OFF_SENTENCE,
} from "./helpers";

test("S22-06: an attribute's delete takes its value in one undo step; a type change keeps the value and moves the check", async ({ page }) => {
  await setValueAs("cust.segment_code", "n/a");
  await setValueAs("cust.city", "2026");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);

  // the delete (a second click: the attribute is fed), then one undo
  await openAttribute(page, "Dim Customer", "segment_code");
  await page.getByTestId("button-delete-attribute").click();
  await page.getByTestId("button-delete-attribute").click();
  await expect(rowNamed(page, "Dim Customer", "segment_code")).toHaveCount(0);
  await expect.poll(() => storedValue("cust.segment_code")).toBeNull();
  expect((await rawValues()).filter((v) => v.unknown_value === "n/a").map((v) => v.deleted_at === null)).toEqual([false]);
  await openEntity(page, "Dim Customer");
  await expect(unknownItems(page)).toHaveCount(4);
  await undoButton(page).click();
  await expect(rowNamed(page, "Dim Customer", "segment_code")).toHaveCount(1);
  await expect.poll(() => storedValue("cust.segment_code")).toBe("n/a");
  await expect(unknownItems(page)).toHaveCount(5);
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("n/a");

  // city: "2026" fits a String; as a Boolean it does not, and the default shown changes with the type
  await expect(unknownBad(page, "cust.city")).toHaveCount(0);
  await openAttribute(page, "Dim Customer", "city");
  await page.getByTestId("select-attribute-type").selectOption("boolean");
  await expect(boxItems(page).filter({ hasText: "unknown member: “2026” is not a Boolean" })).toHaveCount(1);
  expect(await storedValue("cust.city")).toBe("2026");
  await openEntity(page, "Dim Customer");
  await expect(unknownBad(page, "cust.city")).toHaveText("“2026” is not a Boolean");
  await expect(unknownInput(page, "cust.city")).toHaveAttribute("placeholder", "empty (NULL)");
  await page.goto(OM_HOME);
  await hydrated(page);
  await expect(checkLines(page, "unkval")).toHaveText(["Dim Customer.cityunknown member: “2026” is not a Boolean"]);

  // an Integer fits it again: the line goes, the value stays
  await openStar(page);
  await hydrated(page);
  await openAttribute(page, "Dim Customer", "city");
  await page.getByTestId("select-attribute-type").selectOption("integer");
  await expect(boxItems(page).filter({ hasText: "unknown member" })).toHaveCount(0);
  expect(await storedValue("cust.city")).toBe("2026");
  await page.goto(OM_HOME);
  await hydrated(page);
  expect((await groupCounts(page)).some(([id]) => id === "unkval")).toBe(false);
});

for (const who of ["Kasia Zielińska", "Piotr Wiśniewski"] as const) {
  test(`S22-06: ${who} (${who.startsWith("Kasia") ? "reader" : "reviewer"}) sees the flag disabled and the fields read-only`, async ({ page }) => {
    await setValueAs("cust.segment_code", "n/a");
    await setUnknownAs("prod", false);
    await signInAs(page, who);
    await openStar(page);
    await hydrated(page);
    await openEntity(page, "Dim Customer");
    await expect(unknownFlag(page)).toBeDisabled();
    await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true");
    await expect(unknownItems(page)).toHaveCount(5);
    await expect(unknownInput(page, "cust.segment_code")).toHaveValue("n/a");
    for (const input of await unknownItems(page).getByTestId("input-cube-unknown").all()) await expect(input).toHaveAttribute("readonly", "");
    await openEntity(page, "Dim Product");
    await expect(unknownFlag(page)).toBeDisabled();
    await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
    await expect(unknownSentence(page)).toHaveText(OFF_SENTENCE);
  });
}

test("S22-06: an archived workspace is read only", async ({ page }) => {
  await setValueAs("cust.segment_code", "n/a");
  await archive();
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openEntity(page, "Dim Customer");
  await expect(unknownFlag(page)).toBeDisabled();
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("n/a");
  for (const input of await unknownItems(page).getByTestId("input-cube-unknown").all()) await expect(input).toHaveAttribute("readonly", "");
});
