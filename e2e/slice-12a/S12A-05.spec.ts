import { createFromSwitcher } from "../slice-00/helpers";
import { expect, test } from "./fixtures";
import { expectAt, expectToast, RETAIL, recordToasts, redoButton, signInAs, store, toasts, undoButton, WS_HOME } from "./helpers";

// S12A-05 (item 5, Q-A, F2): undoing "Create project" on that project's home removes the page's project: the workspace
// home shows with only "Undone: Create project", not "That project no longer exists."; Redo brings the project back.

test("S12A-05: Undo on a new project's home goes to the workspace home with only the undo's toast; Redo brings the project back", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(WS_HOME);
  await createFromSwitcher(page, "switcher-project", "input-new-project", "Finance");
  await expectToast(page, "Created the project Finance.");
  await expect(page.getByTestId("page-project-home").getByTestId("field-project-name")).toHaveValue("Finance");
  const finance = async () => (await store().projects.list(RETAIL)).find((p) => p.name === "Finance");
  await expect.poll(finance).toBeTruthy();

  await undoButton(page).click();
  await expectToast(page, "Undone: Create project");
  await expectAt(page, WS_HOME);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect.poll(finance).toBeUndefined();
  expect(await toasts(page)).not.toContain("That project no longer exists.");
  await expect(page.getByTestId("tile-project").filter({ hasText: "Finance" })).toHaveCount(0);

  await redoButton(page).click();
  await expectToast(page, "Redone: Create project");
  await expect.poll(finance).toBeTruthy();
  await expect(page.getByTestId("tile-project").filter({ hasText: "Finance" })).toHaveCount(1);
});
