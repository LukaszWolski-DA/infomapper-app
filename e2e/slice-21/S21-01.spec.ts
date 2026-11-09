// S21-01 (slice 21, item 1, X1, D-76): a logical attribute's row dropped onto a source column's row maps them as the
// column dropped onto the row does (slice 1b, D-48): a direct mapping, one undo step; on a mapped attribute D-48's choice
// with the same hint, Enter and Esc as there. While it is dragged the table cards stay lit under the veil. With InfoCube
// off a logical row on a logical row does nothing. With InfoCube on (the star, a table placed), the facts and dimensions
// stay lit with the table (6 lit cards, S15-09's count since slice 21) and a dimensional row on a column is refused. A
// reader's press starts no drag.

import { expect, starTest, test } from "./fixtures";
import {
  attributeIdOf,
  canvasUrl,
  dragTo,
  expectToast,
  ids,
  LEFT_AT_100,
  loadModel,
  model,
  openCanvas,
  openStar,
  place,
  recordToasts,
  rowNamed,
  signInAs,
  STAR,
  startDrag,
  toasts,
  undoButton,
  veil,
} from "./helpers";

const mappingsOf = async (attributeId: string) => (await loadModel()).mappings.filter((m) => m.attribute_id === attributeId && m.deleted_at === null);

test("S21-01: InfoCube off: a row onto a column maps it, one undo step; the tables lit; D-48's choice with its hint; a row on a row does nothing", async ({ page }) => {
  await recordToasts(page);
  const { attribute, column } = await ids();
  const code = attribute("Customer", "segment_code"), segment = column("customers", "segment");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);

  // the veil: the table cards stay lit, every entity card is dimmed
  const tables = await page.locator(".card.src[data-card]").count();
  expect(tables).toBeGreaterThan(0);
  await startDrag(page, rowNamed(page, "Customer", "segment_code"));
  await expect.poll(() => veil(page)).toMatchObject({ litCards: tables });
  await expect(page.getByTestId("line-draft")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => veil(page)).toBeNull();

  // a direct mapping, the same toast as the opposite drag (S1B-01)
  await dragTo(page, rowNamed(page, "Customer", "segment_code"), rowNamed(page, "customers", "segment"));
  await expectToast(page, "Mapped customers.segment to Customer.segment_code");
  const made = await mappingsOf(code.id);
  expect(made).toHaveLength(1);
  expect(made[0]).toMatchObject({ kind: "direct", status: "draft" });
  expect((await loadModel()).mappingInputs.filter((i) => i.mapping_id === made[0]!.id).map((i) => i.source_column_id)).toEqual([segment.id]);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  // one undo step removes it
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await undoButton(page).click();
  await expect.poll(async () => (await mappingsOf(code.id)).length).toBe(0);

  // a mapped attribute: D-48's choice with the opposite drag's hint (another system: a separate mapping); Esc cancels
  const number = attribute("Customer", "customer_number");
  const before = (await mappingsOf(number.id)).length;
  const choice = page.getByTestId("popover-map-choice");
  const selectedOption = choice.locator('[data-testid="option-map-choice"][aria-selected="true"]');
  await dragTo(page, rowNamed(page, "Customer", "customer_number"), rowNamed(page, "web_users", "cust_no"));
  await expect(choice).toBeVisible();
  await expect(selectedOption).toHaveText("Separate mapping (alternative source)");
  await page.keyboard.press("Escape");
  await expect(choice).toHaveCount(0);
  expect((await mappingsOf(number.id)).length).toBe(before);
  // Enter confirms
  await dragTo(page, rowNamed(page, "Customer", "customer_number"), rowNamed(page, "web_users", "cust_no"));
  await expect(selectedOption).toHaveText("Separate mapping (alternative source)");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await mappingsOf(number.id)).length).toBe(before + 1);
  // the same table: "Add to mapping" is pre-selected, as for customers.lname dropped on first_name (S1B-02)
  await dragTo(page, rowNamed(page, "Customer", "first_name"), rowNamed(page, "customers", "lname"));
  await expect(selectedOption).toHaveText("Add to mapping customers.fname");
  await page.keyboard.press("Escape");

  // a logical row on another logical row: nothing, no refusal (F2)
  const count = (await loadModel()).mappings.length;
  const shown = (await toasts(page)).length;
  await dragTo(page, rowNamed(page, "Customer", "segment_code"), rowNamed(page, "Customer", "first_name"));
  await expect(choice).toHaveCount(0);
  await expect(page.getByTestId("line-draft")).toHaveCount(0);
  expect((await loadModel()).mappings.length).toBe(count);
  expect((await toasts(page)).length).toBe(shown);
});

test("S21-01: a reader's press on a logical row starts no drag", async ({ page }) => {
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);
  const count = (await loadModel()).mappings.length;
  await dragTo(page, rowNamed(page, "Customer", "segment_code"), rowNamed(page, "customers", "segment"));
  await expect(page.getByTestId("line-draft")).toHaveCount(0);
  await expect(page.getByTestId("popover-map-choice")).toHaveCount(0);
  expect(await veil(page)).toBeNull();
  expect((await loadModel()).mappings.length).toBe(count);
});

starTest("S21-01: InfoCube on: the tables lit with the facts and dimensions; a row onto a column maps it; a dimensional row on a column is refused", async ({ page }) => {
  await recordToasts(page);
  await place("customer_addresses", { x: 1460, y: 40 }, STAR);
  await signInAs(page, "Łukasz");
  await openStar(page);

  // the five facts and dimensions and the table stay lit
  await startDrag(page, rowNamed(page, "Customer", "segment_code"));
  await expect.poll(() => veil(page)).toMatchObject({ litCards: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => veil(page)).toBeNull();

  const code = await attributeIdOf("Customer", "segment_code");
  const before = (await mappingsOf(code)).length;
  await dragTo(page, rowNamed(page, "Customer", "segment_code"), rowNamed(page, "customer_addresses", "city"));
  await expect.poll(async () => (await mappingsOf(code)).length).toBe(before + 1);
  await expect.poll(() => toasts(page)).toContainEqual(expect.stringContaining("Mapped customer_addresses.city to Customer.segment_code"));

  // a dimensional row on a column keeps InfoCube's refusal
  const count = (await model()).mappings.length;
  await dragTo(page, rowNamed(page, "Dim Customer", "city"), rowNamed(page, "customer_addresses", "city"));
  await expect.poll(() => toasts(page)).toContain("Facts and dimensions are fed from the logical model, not from source columns.");
  expect((await model()).mappings.length).toBe(count);
});
