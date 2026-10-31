import { updateProject } from "../../src/domain/commands/project";
import { ARCHIVED_MESSAGE } from "../../src/domain/errors";
import { expect, test, type Page } from "./fixtures";
import { archive, asUser, C360, expectToast, hydrated, loadProject, projectHome, redoButton, SEED_IDS, signInAs, undoButton } from "./helpers";

// S12A-04 (item 3): a home's undo has the canvas's refusals: a step whose row someone else changed since is refused
// with the existing message and changes nothing; in an archived workspace undo and redo are refused.

async function rename(page: Page, to: string) {
  const name = page.getByTestId("field-project-name");
  await name.fill(to);
  await name.press("Enter");
  await expect.poll(async () => (await loadProject()).name).toBe(to);
}

test("S12A-04: a step changed by someone else is refused on the home; in an archived workspace undo and redo are refused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  await hydrated(page);
  await rename(page, "Customer 360 – mine");

  // Anna renames it again; Łukasz's undo is refused, and nothing changes
  const project = await loadProject();
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateProject(ctx, access, { project }, { projectId: C360, expectedVersion: project.version, name: "Customer 360 – Anna" }));
  await undoButton(page).click();
  await expectToast(page, "Couldn't undo “Rename project” because it was changed afterwards. Ctrl+Z again goes further back.");
  expect((await loadProject()).name).toBe("Customer 360 – Anna");

  // archived: a step to undo and one to redo, both refused with the archive's message
  await page.reload();
  await hydrated(page);
  await rename(page, "Customer 360 – one");
  await rename(page, "Customer 360 – two");
  await undoButton(page).click();
  await expectToast(page, "Undone: Rename project");
  await expect.poll(async () => (await loadProject()).name).toBe("Customer 360 – one");
  await archive();
  await page.reload();
  await expect(undoButton(page)).toBeEnabled();
  await undoButton(page).click();
  await expectToast(page, ARCHIVED_MESSAGE);
  await redoButton(page).click();
  await expectToast(page, ARCHIVED_MESSAGE);
  expect((await loadProject()).name).toBe("Customer 360 – one");
});
