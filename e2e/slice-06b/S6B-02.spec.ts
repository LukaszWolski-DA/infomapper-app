// S6B-02 (slice 6b, items 1–3; Łukasz's step 1 answer 3): selection places. A card, a mapping, a frame, a note and a
// requirement selected one after another record five places; Back walks them in reverse, each selected again, then the
// page's own entry with nothing selected. The same card twice records one place; a deselection, a multi-selection and
// view-state changes record none.

import { expect, test } from "./fixtures";
import {
  AROUND,
  backButton,
  canvasUrl,
  clickCard,
  DEMO_NOTES,
  expectSelected,
  forwardButton,
  makeFrame,
  mappingId,
  mappingLine,
  namePoint,
  notePoint,
  openCanvas,
  openRequirement,
  pointOnLine,
  signInAs,
  FRAMED,
} from "./helpers";

test("S6B-02: five selections are five places, walked back in reverse; repeats, deselection, several items and view state record none", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1000 });
  await makeFrame(AROUND.tables, { name: "Tables" });
  const mapping = await mappingId("customers.email_addr", "Customer.email");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(backButton(page)).toBeEnabled(); // the sign-in page before it
  const length = () => page.evaluate(() => (window as unknown as { navigation: { entries: () => unknown[] } }).navigation.entries().length);
  const start = await length();

  // a card, then the same card again: one place
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  await clickCard(page, "Customer");
  expect(await length()).toBe(start + 1);

  // a deselection, a multi-selection, view state: none
  await page.keyboard.press("Escape");
  await expectSelected(page, "none");
  await clickCard(page, "Customer");
  await page.getByTestId("card-name").getByText("Sales Order", { exact: true }).click({ modifiers: ["Shift"] });
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.locator('[data-testid="switch-layer"] [data-layer="all"]').click();
  await page.getByTestId("button-focus").click();
  expect(await length()).toBe(start + 1);

  // a mapping, a frame, a note, a requirement: four more
  const at = await pointOnLine(mappingLine(page, mapping));
  await page.mouse.click(at.x, at.y);
  await expectSelected(page, "mapping");
  const frame = await namePoint(page, "Tables");
  await page.mouse.click(frame.x, frame.y);
  await expectSelected(page, "frame:Tables");
  const note = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.click(note.x, note.y);
  await expectSelected(page, "note");
  await openRequirement(page, "REQ-101");
  await expectSelected(page, "req:REQ-101");
  expect(await length()).toBe(start + 5);

  // Back walks them in reverse, then the page's own entry
  for (const expected of ["note", "frame:Tables", "mapping", "entity:Customer", "none"]) {
    await backButton(page).click();
    await expectSelected(page, expected);
  }
  await expect(page).toHaveURL(new RegExp(`${canvasUrl()}$`));
  await forwardButton(page).click();
  await expectSelected(page, "entity:Customer");
});
