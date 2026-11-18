import { clickVisible } from "../canvas-click";
import { expect, test, type Page } from "../slice-16/fixtures";
import { canvasUrl, card, emptySpot, hydrated, openCanvas, signInAs, toolboxAt, WHOLE_CO } from "../slice-16/helpers";
import { loadNotes } from "../slice-03a/helpers";

// fix/late-selection-canvas (the S15-24 entry's list, known-limitations.md): a new note's first save (`commit` of the
// draft note) selected the saved note when its answer arrived, whatever had been selected by then. No hold: a person
// types a note and clicks another card, which ends the editing (the save is sent on the blur) and selects the card
// before the answer comes back.

const TEXT = "Ask the CRM team";
const menuItem = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name });
const savedNote = async () => (await loadNotes()).find((n) => n.body_text === TEXT);

test("a card clicked right after typing a new note stays selected when the note's first save answers", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await toolboxAt(page, await emptySpot(page));
  await menuItem(page, "Add a note here").click();
  await expect(page.getByTestId("input-note-text")).toBeFocused();
  await page.keyboard.type(TEXT);

  await clickVisible(card(page, "Sales Order").getByTestId("card-name"));
  // the answer has been applied: the note is stored and drawn
  await expect.poll(async () => !!(await savedNote())).toBe(true);
  await expect(page.locator(`[data-note="${(await savedNote())!.id}"]`)).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.getByTestId("panel-note")).toHaveCount(0);
});

test("a new note is selected after its first save when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await toolboxAt(page, await emptySpot(page));
  await menuItem(page, "Add a note here").click();
  await expect(page.getByTestId("input-note-text")).toBeFocused();
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => !!(await savedNote())).toBe(true);
  await expect(page.locator(`[data-note="${(await savedNote())!.id}"]`)).toBeVisible();
  await expect(page.getByTestId("panel-note")).toBeVisible();
});
