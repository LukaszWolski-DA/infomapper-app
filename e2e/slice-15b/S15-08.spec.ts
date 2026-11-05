import { expect, test } from "./fixtures";
import {
  card,
  cubeRowOf,
  entityIdOf,
  hints,
  hintsOk,
  hydrated,
  liveMeasures,
  measureRows,
  openAttribute,
  openEntity,
  openStar,
  recordToasts,
  rowNamed,
  signInAs,
  toasts,
  undoButton,
  attrId,
} from "./helpers";

// S15-08 (IC-04 to IC-06, B-4, B-3): clearing Fact Sales' grain shows its hint and one undo brings it back; quantity
// semi-additive across "Date" shows Σ~ on its row and in Measures; order_number as a measure shows the type hint in its
// panel and the fact's; a foreign key made a measure gets the toast; each is one undo step; a reviewer sees it all
// read-only.

test("S15-08: grain cleared and undone; quantity semi-additive across Date (Σ~); order_number's type hint; a key as a measure; one undo each", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);

  // the grain
  await openEntity(page, "Fact Sales");
  await expect(hintsOk(page)).toHaveText("Nothing to check: grain, keys and measures look complete.");
  await page.getByTestId("input-cube-grain").fill("");
  await page.getByTestId("input-cube-grain").press("Tab");
  await expect.poll(async () => (await cubeRowOf(entityIdOf("sales")))?.grain).toBeNull();
  await expect(hints(page)).toHaveText(["No grain yet. Write what one row of this fact stands for."]);
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRowOf(entityIdOf("sales")))?.grain).toBe("One order line");
  await expect(page.getByTestId("input-cube-grain")).toHaveValue("One order line");
  await expect(hintsOk(page)).toBeVisible();

  // quantity semi-additive across "Date"
  await expect(rowNamed(page, "Fact Sales", "quantity")).toHaveClass(/\bmeas add\b/);
  await openAttribute(page, "Fact Sales", "quantity");
  await page.getByTestId("seg-cube-additivity").getByText("Semi-additive", { exact: true }).click();
  await expect(rowNamed(page, "Fact Sales", "quantity")).toHaveClass(/\bmeas semi\b/);
  await page.getByTestId("input-cube-semi").fill("Date");
  await page.getByTestId("input-cube-semi").press("Tab");
  const quantity = async () => (await liveMeasures()).find((m) => m.attribute_id === attrId("sales.quantity"));
  await expect.poll(async () => [(await quantity())?.additivity, (await quantity())?.semi_note]).toEqual(["semi", "Date"]);
  expect(await rowNamed(page, "Fact Sales", "quantity").locator(".dt").evaluate((el) => getComputedStyle(el, "::before").content)).toBe('"Σ~"');
  await openEntity(page, "Fact Sales");
  await expect(measureRows(page).filter({ hasText: "quantity" })).toContainText("Σ~ Semi-additive, Date");
  // two undo steps: the note, then the additivity
  await undoButton(page).click();
  await expect.poll(async () => (await quantity())?.semi_note).toBeNull();
  await undoButton(page).click();
  await expect.poll(async () => (await quantity())?.additivity).toBe("additive");
  await expect(rowNamed(page, "Fact Sales", "quantity")).toHaveClass(/\bmeas add\b/);

  // order_number as a measure: non-additive (a String), the type hint
  await openAttribute(page, "Fact Sales", "order_number");
  await expect(page.getByTestId("text-cube-not-measure")).toHaveText("Not a measure: a degenerate dimension or a descriptive value of the fact.");
  await page.getByTestId("flag-cube-measure").getByRole("button", { name: "Measure" }).click();
  await expect(page.getByTestId("hint-cube-measure-type")).toHaveText("Its type is String. Measures are usually Integer or Decimal.");
  await expect(rowNamed(page, "Fact Sales", "order_number")).toHaveClass(/\bmeas non\b/);
  const orderNumber = async () => (await liveMeasures()).find((m) => m.attribute_id === attrId("sales.order_number"));
  await expect.poll(async () => (await orderNumber())?.additivity).toBe("non");
  await openEntity(page, "Fact Sales");
  await expect(hints(page)).toHaveText(["order_number is a measure but its type is String. Measures are usually Integer or Decimal."]);
  await undoButton(page).click();
  await expect.poll(orderNumber).toBeUndefined();
  await expect(hintsOk(page)).toBeVisible();
  await expect(rowNamed(page, "Fact Sales", "order_number")).not.toHaveClass(/\bmeas\b/);

  // a foreign key made a measure: made, with the toast
  await openAttribute(page, "Fact Sales", "customer_key");
  await expect(page.getByTestId("text-cube-not-measure")).toHaveText("A foreign key carries a dimension's key; it is not a measure.");
  await page.getByTestId("flag-cube-measure").getByRole("button", { name: "Measure" }).click();
  await expect.poll(() => toasts(page)).toContainEqual("customer_key is a foreign key. A dimension key is usually not a measure.");
  await expect.poll(async () => (await liveMeasures()).some((m) => m.attribute_id === attrId("sales.customer_key"))).toBe(true);
  await undoButton(page).click();
  await expect.poll(async () => (await liveMeasures()).some((m) => m.attribute_id === attrId("sales.customer_key"))).toBe(false);
  await expect(card(page, "Fact Sales")).toHaveCount(1);
});

test("S15-08 (reviewer): Piotr sees the grain, the SCD type, the measure and the key read-only", async ({ page }) => {
  await signInAs(page, "Piotr Wiśniewski");
  await openStar(page);
  await openEntity(page, "Fact Sales");
  await expect(page.getByTestId("input-cube-grain")).toHaveAttribute("readonly", "");
  await expect(page.getByTestId("button-cube-add-key")).toHaveCount(0);
  await openEntity(page, "Dim Date");
  await expect(page.getByTestId("seg-cube-scd").getByRole("button").first()).toBeDisabled();
  await openAttribute(page, "Fact Sales", "quantity");
  await expect(page.getByTestId("flag-cube-measure").getByRole("button", { name: "Measure" })).toBeDisabled();
  await expect(page.getByTestId("seg-cube-additivity").getByRole("button").first()).toBeDisabled();
});
