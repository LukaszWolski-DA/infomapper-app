import { expect, test } from "./fixtures";
import { expectToast, hydrated, key, loadProject, projectHome, signInAs, undoButton } from "./helpers";

// S12A-03 (item 2): Ctrl+Z and Ctrl+Shift+Z (and Ctrl+Y) outside a text field undo and redo the person's newest step;
// in a text field Ctrl+Z is the browser's own text undo, and the person's history is untouched.

const DESCRIPTION = "One view of the customer across CRM and the web shop.";

test("S12A-03: keys on the home: outside a field they undo and redo; inside the description they undo the typing only", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const name = page.getByTestId("field-project-name");
  await name.fill("Customer 360 – 2026");
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");

  // typing in the description, then Ctrl+Z there: the field's own undo
  const description = page.getByTestId("field-project-description");
  await description.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" More");
  await expect(description).toHaveValue(`${DESCRIPTION} More`);
  // Chrome undoes this typing a letter at a time: Ctrl+Z in the field until the text is back
  await page.keyboard.press("Control+z");
  await expect(description).not.toHaveValue(`${DESCRIPTION} More`);
  for (let i = 0; i < 10 && (await description.inputValue()) !== DESCRIPTION; i++) await page.keyboard.press("Control+z");
  await expect(description).toHaveValue(DESCRIPTION);
  await expect(description).toBeFocused();
  expect((await loadProject()).name).toBe("Customer 360 – 2026");
  await expect(undoButton(page)).toBeEnabled();

  // outside the field: the rename is undone and redone, with each key
  await key(page, "Control+z");
  await expectToast(page, "Undone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360");
  await key(page, "Control+Shift+z");
  await expectToast(page, "Redone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");
  await key(page, "Control+z");
  // the page knows there is something to redo once the undo's answer is back (its toast), as on a canvas (S1B-12)
  await expectToast(page, "Undone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360");
  await key(page, "Control+y");
  await expectToast(page, "Redone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – 2026");
  expect((await loadProject()).description).toBe(DESCRIPTION);
});
