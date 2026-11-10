// S22-03 (value fit): the rule's unit tests are `src/modules/infocube/domain/unknown-member.test.ts` (every type, the
// String length, the sentences). Here: the panel's sentence for an Integer and a Date, gone when the value fits.

import { expect, test } from "./fixtures";
import { hydrated, openEntity, openStar, signInAs, storedValue, typeValue, unknownBad, unknownInput, unknownItems } from "./helpers";

test("S22-03: Dim Date's panel says why an Integer and a Date do not fit, and nothing once they do", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Dim Date");
  // date_key Integer PK, calendar_date Date, year and month Integer, day_of_week String
  expect(await unknownItems(page).getByTestId("input-cube-unknown").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).placeholder))).toEqual(["-1", "empty (NULL)", "empty (NULL)", "empty (NULL)", "Unknown"]);

  await typeValue(page, "date.date_key", "1900-01-01");
  await expect(unknownBad(page, "date.date_key")).toHaveText("“1900-01-01” is not an Integer");
  await expect(unknownInput(page, "date.date_key")).toHaveAttribute("aria-invalid", "true");
  await typeValue(page, "date.calendar_date", "01.01.1900");
  await expect(unknownBad(page, "date.calendar_date")).toHaveText("“01.01.1900” is not a Date (YYYY-MM-DD)");
  await expect(unknownInput(page, "date.calendar_date")).toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => storedValue("date.calendar_date")).toBe("01.01.1900");

  await typeValue(page, "date.date_key", "19000101");
  await expect(unknownBad(page, "date.date_key")).toHaveCount(0);
  await expect(unknownInput(page, "date.date_key")).not.toHaveAttribute("aria-invalid", "true");
  await typeValue(page, "date.calendar_date", "1900-01-01");
  await expect(unknownBad(page, "date.calendar_date")).toHaveCount(0);
  await expect(unknownInput(page, "date.calendar_date")).not.toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => storedValue("date.calendar_date")).toBe("1900-01-01");
  expect(await storedValue("date.date_key")).toBe("19000101");
});
