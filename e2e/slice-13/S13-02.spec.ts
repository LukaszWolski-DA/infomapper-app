import { expect, test } from "./fixtures";
import { expectCaretAtEnd, holdUntil, hydrated, loadProject, projectHome, recordToasts, signInAs, toasts } from "./helpers";

// S13-02 (items 3–4, D-59, D-66): the project's description on its home, typed on while its save is on its way: the
// text stays with the focus and the caret, and leaving the field saves the rest. The description saves on leaving it
// (Enter adds a line).

test("S13-02: the project's description typed on while its save is on its way: nothing is lost, saved next", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  const description = page.getByTestId("field-project-description");
  const before = (await loadProject()).version;
  await expect(description).toHaveAttribute("data-version", String(before));

  const hold = await holdUntil(page, "One view of the customer.");
  await description.fill("One view of the customer.");
  await description.blur();
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer.");
  expect(hold.held()).toBe(true);

  await description.click();
  await description.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("For sales and service.");
  hold.release();
  await hold.given;
  await expect(description).toHaveAttribute("data-version", String(before + 1)); // the first save's fresh page
  await expect(description).toHaveValue("One view of the customer.\nFor sales and service.");
  await expect(description).toBeFocused();
  await expectCaretAtEnd(description);

  await description.blur();
  await expect.poll(async () => (await loadProject()).description).toBe("One view of the customer.\nFor sales and service.");
  await expect(description).toHaveAttribute("data-version", String(before + 2));
  expect(await toasts(page)).toEqual([]);
});
