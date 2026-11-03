import { expect, test } from "./fixtures";
import { changeRequirementAsAnna, conflictLine, expectToast, openCanvas, openRequirement, otherValue, recordToasts, requirementByKey, signInAs, STALE, useThis } from "./helpers";

// S13-04 (item 7, F4, answer 2): a conflict on a requirement's description, a rich text of several paragraphs. The line
// is inside the editor dialog, the other text folded with "Show more"; Save is off while it shows; "Use this" puts
// the stored text into the editor, which stays open, and Save then stores an edit of it.

const ANNAS = [
  "<p>Every active customer has exactly one e-mail address, checked when the customer is created and on every change.</p>",
  "<p>Two customers may not share an address, in any case; the CRM's duplicates are merged before the load.</p>",
  "<p>An address that bounces three times is marked, not removed, so the history stays.</p>",
  "<p>Owner: the CRM team. Reviewed every quarter with the web shop.</p>",
].join("");

test("S13-04: a long description in the rich-text dialog: the line inside the dialog, folded; Use this puts it into the editor", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-103");
  await changeRequirementAsAnna("REQ-103", "description", ANNAS);

  await page.getByTestId("field-req-description-edit").click();
  const dialog = page.getByTestId("dialog-rich-text");
  const editor = dialog.getByTestId("rte-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" My own sentence.");
  await dialog.getByTestId("button-rte-save").click();
  await expectToast(page, STALE);

  await expect(dialog).toBeVisible();
  await expect(conflictLine(dialog)).toContainText("Changed meanwhile to:");
  await expect(otherValue(dialog)).toContainText("exactly one e-mail address");
  await expect(dialog.getByTestId("button-draft-more")).toHaveText("Show more");
  await dialog.getByTestId("button-draft-more").click();
  await expect(dialog.getByTestId("button-draft-more")).toHaveText("Show less");
  await expect(editor).toContainText("My own sentence.");
  // Save is off while the line shows
  await expect(dialog.getByTestId("button-rte-save")).toBeDisabled();

  await useThis(dialog).click();
  await expect(conflictLine(dialog)).toHaveCount(0);
  await expect(editor).toContainText("Reviewed every quarter");
  await expect(editor).not.toContainText("My own sentence.");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Agreed.");
  await dialog.getByTestId("button-rte-save").click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await requirementByKey("REQ-103")).description_text).toContain("Reviewed every quarter with the web shop. Agreed.");
});
