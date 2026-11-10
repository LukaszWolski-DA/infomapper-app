// S22-02 (the panel): Dim Customer's section after History and before Used by: the flag pressed, the sentence, five
// lines with "-1" and "Unknown" placeholders; " n/a " saved as "n/a", one undo step, undo and redo; cleared back to the
// default (the row gone); an unchanged value writes nothing; "abc" in customer_key stored, the field marked and its
// sentence; off hides the lines and keeps the values, on brings them back, one undo step each. And acceptance F3: two
// saves of one field, the second sent while the first's answer is held.

import { expect, test } from "./fixtures";
import {
  attrId,
  conflictLine,
  holdUntil,
  hydrated,
  OFF_SENTENCE,
  ON_SENTENCE,
  openEntity,
  openStar,
  rawValues,
  recordToasts,
  redoButton,
  signInAs,
  storedValue,
  toasts,
  typeValue,
  undoButton,
  unknownBad,
  unknownField,
  unknownFlag,
  unknownInput,
  unknownItems,
  unknownOnOf,
  unknownSentence,
} from "./helpers";

test("S22-02: Dim Customer's unknown member: the flag, the lines, a value saved, cleared, marked, kept while off", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await recordToasts(page);
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Dim Customer");

  // after History, before Used by
  const order = await page.getByTestId("section-cube-dimension").evaluate((section) => {
    const at = (id: string) => section.querySelector(`[data-testid="${id}"]`)!;
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return [before(at("seg-cube-scd"), at("field-cube-unknown")), before(at("field-cube-unknown"), at("list-cube-used-by"))];
  });
  expect(order).toEqual([true, true]);

  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true");
  await expect(unknownSentence(page)).toHaveText(ON_SENTENCE);
  await expect(unknownItems(page).locator("label")).toHaveText([/^customer_key\s*Integer · PK$/, /^customer_number\s*String$/, /^segment_code\s*String$/, /^city\s*String$/, /^country_name\s*String$/]);
  expect(await unknownItems(page).getByTestId("input-cube-unknown").evaluateAll((els) => els.map((e) => [(e as HTMLInputElement).value, (e as HTMLInputElement).placeholder]))).toEqual([
    ["", "-1"],
    ["", "Unknown"],
    ["", "Unknown"],
    ["", "Unknown"],
    ["", "Unknown"],
  ]);

  // " n/a " is saved trimmed, one undo step; undo and redo
  await typeValue(page, "cust.segment_code", " n/a ");
  await expect.poll(() => storedValue("cust.segment_code")).toBe("n/a");
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("n/a");
  expect(await rawValues()).toHaveLength(1);
  await undoButton(page).click();
  await expect.poll(() => storedValue("cust.segment_code")).toBeNull();
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("");
  await expect.poll(() => toasts(page)).toContain("Undone: Set unknown member value of Dim Customer.segment_code");
  await redoButton(page).click();
  await expect.poll(() => storedValue("cust.segment_code")).toBe("n/a");
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("n/a");

  // an unchanged value writes nothing
  const before = JSON.stringify(await rawValues());
  await unknownInput(page, "cust.segment_code").focus();
  await unknownInput(page, "cust.segment_code").press("Tab");
  await typeValue(page, "cust.segment_code", "n/a  ");
  await typeValue(page, "cust.city", "   ");
  await expect(unknownInput(page, "cust.city")).toHaveValue("");

  // cleared: the row is gone and the default shows again
  await typeValue(page, "cust.segment_code", "");
  await expect.poll(() => storedValue("cust.segment_code")).toBeNull();
  const after = await rawValues();
  expect(after).toHaveLength(1);
  expect(after[0]!.deleted_at).not.toBeNull();
  expect(JSON.stringify([{ ...after[0]!, deleted_at: null, version: 0, updated_at: "" }])).toBe(JSON.stringify(JSON.parse(before).map((r: object) => ({ ...r, deleted_at: null, version: 0, updated_at: "" }))));
  await expect(unknownInput(page, "cust.segment_code")).toHaveValue("");
  await expect(unknownInput(page, "cust.segment_code")).toHaveAttribute("placeholder", "Unknown");

  // "abc" in customer_key is stored, marked and explained
  await typeValue(page, "cust.customer_key", "abc");
  await expect.poll(() => storedValue("cust.customer_key")).toBe("abc");
  await expect(unknownInput(page, "cust.customer_key")).toHaveAttribute("aria-invalid", "true");
  await expect(unknownInput(page, "cust.customer_key")).toHaveAttribute("title", "“abc” is not an Integer");
  await expect(unknownBad(page, "cust.customer_key")).toHaveText("“abc” is not an Integer");
  await expect(unknownField(page).getByTestId("text-cube-unknown-bad")).toHaveCount(1);

  // off hides the lines and keeps the value; on brings it back; one undo step each
  await unknownFlag(page).click();
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
  await expect(unknownSentence(page)).toHaveText(OFF_SENTENCE);
  await expect(unknownItems(page)).toHaveCount(0);
  await expect.poll(() => unknownOnOf("cust")).toBe(false);
  expect(await storedValue("cust.customer_key")).toBe("abc");
  await unknownFlag(page).click();
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => unknownOnOf("cust")).toBe(true);
  await expect(unknownInput(page, "cust.customer_key")).toHaveValue("abc");
  await expect(unknownBad(page, "cust.customer_key")).toBeVisible();
  await undoButton(page).click();
  await expect.poll(() => unknownOnOf("cust")).toBe(false);
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => toasts(page)).toContain("Undone: Turn on unknown member of Dim Customer");
  await undoButton(page).click();
  await expect.poll(() => unknownOnOf("cust")).toBe(true);
  await expect(unknownFlag(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => toasts(page)).toContain("Undone: Turn off unknown member of Dim Customer");
});

test("S22-02: a second save of the same field, sent while the first's answer is held, is no conflict (F3)", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Dim Customer");
  const input = unknownInput(page, "cust.city");
  const first = await holdUntil(page, attrId("cust.city"));
  await typeValue(page, "cust.city", "none");
  await expect.poll(() => first.held()).toBe(true);
  await expect.poll(() => storedValue("cust.city")).toBe("none");
  // the page does not know the row yet: its answer is held
  await typeValue(page, "cust.city", "n/a");
  first.release();
  await first.given;
  await expect.poll(() => storedValue("cust.city")).toBe("n/a");
  await expect(input).toHaveValue("n/a");
  await expect(conflictLine(page)).toHaveCount(0);
  const rows = await rawValues();
  expect(rows.map((r) => [r.unknown_value, r.version, r.deleted_at])).toEqual([["n/a", 2, null]]);

  // and cleared right after a value, again before the page knows the new version
  const second = await holdUntil(page, attrId("cust.city"));
  await typeValue(page, "cust.city", "x");
  await expect.poll(() => second.held()).toBe(true);
  await typeValue(page, "cust.city", "");
  second.release();
  await second.given;
  await expect.poll(() => storedValue("cust.city")).toBeNull();
  await expect(input).toHaveValue("");
  await expect(conflictLine(page)).toHaveCount(0);
});
