import { createProject, deleteProject } from "../../src/domain/commands/project";
import { expect, test, type Page } from "./fixtures";
import { asLukasz, C360, callActionDirectly, captureActionId, deleteButton, deleteText, expectToast, OM, OM_HOME, projectHome, RETAIL, signInAs, store } from "./helpers";

// S12A-10 (items 9, 11, P6): with one project left the button is disabled with "This is the only project."; a direct
// call is refused with "A workspace needs at least one project.".

/** The delete action's id, caught by deleting a spare project through the page. */
async function deleteActionId(page: Page): Promise<string> {
  const { projectId } = await asLukasz((ctx, access) => createProject(ctx, access, { workspaceId: RETAIL, name: "Spare" }));
  await page.goto(projectHome(projectId));
  await deleteButton(page).click();
  return captureActionId(page, () => deleteButton(page).click());
}

/** Deletes a project through the domain, as of now. */
async function deleteThrough(projectId: string) {
  const s = store();
  const [project, projects, canvases, items, frames, notes, pins] = await Promise.all([
    s.projects.get(RETAIL, projectId),
    s.projects.list(RETAIL),
    s.canvases.list(RETAIL),
    s.canvasItems.list(RETAIL),
    s.frames.list(RETAIL),
    s.notes.list(RETAIL),
    s.labels.listPins(RETAIL),
  ]);
  const links = (await Promise.all(canvases.map((c) => s.canvases.listLinksOfCanvas(RETAIL, c.id)))).flat();
  await asLukasz((ctx, access) => deleteProject(ctx, access, { project, projects, links, canvases, items, frames, notes, pins }, { projectId, expectedVersion: project!.version }));
}

test("S12A-10: the only project: the button is disabled with “This is the only project.”; a direct call is refused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const actionId = await deleteActionId(page);
  await expectToast(page, "Deleted the project Spare and 1 canvas that only it used. The model is untouched.");

  await deleteThrough(C360);
  await page.goto(OM_HOME);
  await expect(deleteButton(page)).toBeDisabled();
  await expect(deleteText(page)).toHaveText("This is the only project.");
  const project = (await store().projects.get(RETAIL, OM))!;
  const reply = await callActionDirectly(page, actionId, [{ workspaceId: RETAIL, projectId: OM, expectedVersion: project.version }]);
  expect(reply).toContain("A workspace needs at least one project.");
  expect((await store().projects.get(RETAIL, OM))?.deleted_at).toBeNull();
});
