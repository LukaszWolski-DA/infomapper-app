import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, labelNamed, loadPins, newSession, projectHome, redoButton, SEED_IDS, signInAs, undoButton } from "./helpers";

// S12A-06 (item 7, P2): pinning and unpinning a label on the project home is one undo step each, named after the label;
// reviewers and readers see the plain ★ (D-29); a label's delete, undone, still brings its pin back.

const pinned = async (label = "CR-23") => {
  const id = (await labelNamed(label))?.id;
  return (await loadPins()).some((p) => p.project_id === SEED_IDS.projCustomer360 && p.label_id === id);
};

test("S12A-06: a pin and an unpin are undo steps on the home; a reviewer sees the plain star; a label's delete undone brings the pin back", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  const row = page.locator('[data-testid="item-project-label"][data-label="CR-23"]');
  const star = row.getByTestId("button-label-pin");

  await star.click();
  await expect.poll(() => pinned()).toBe(true);
  await undoButton(page).click();
  await expectToast(page, "Undone: Pin label CR-23");
  await expect.poll(() => pinned()).toBe(false);
  await expect(row).not.toHaveAttribute("data-pinned");
  await redoButton(page).click();
  await expectToast(page, "Redone: Pin label CR-23");
  await expect.poll(() => pinned()).toBe(true);
  await expect(row).toHaveAttribute("data-pinned", "true");

  await star.click();
  await expect.poll(() => pinned()).toBe(false);
  await undoButton(page).click();
  await expectToast(page, "Undone: Unpin label CR-23");
  await expect.poll(() => pinned()).toBe(true);

  // a reviewer sees the plain star, no control
  const reviewer = await newSession(browser, "Piotr Wiśniewski");
  await reviewer.page.goto(projectHome());
  const theirRow = reviewer.page.locator('[data-testid="item-project-label"][data-label="CR-23"]');
  await expect(theirRow).toContainText("★");
  await expect(theirRow.getByTestId("button-label-pin")).toHaveCount(0);
  await reviewer.context.close();

  // the label's delete, undone from the home, brings the pin back
  const labelId = (await labelNamed("CR-23"))!.id;
  await page.goto(`${canvasUrl()}?label=${labelId}`);
  await page.getByTestId("button-label-delete").click();
  await expect.poll(async () => (await labelNamed("CR-23")) === undefined).toBe(true);
  await page.goto(projectHome());
  await undoButton(page).click();
  await expectToast(page, "Undone: Delete label");
  await expect.poll(() => pinned()).toBe(true);
});
