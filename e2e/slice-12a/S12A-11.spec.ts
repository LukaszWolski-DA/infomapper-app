import { createProject } from "../../src/domain/commands/project";
import { ARCHIVED_MESSAGE } from "../../src/domain/errors";
import { expect, test } from "./fixtures";
import { archive, asLukasz, callActionDirectly, captureActionId, deleteButton, deleteSection, expectAt, expectToast, newSession, OM, OM_HOME, projectHome, RETAIL, signInAs, store, WS_HOME } from "./helpers";

// S12A-11 (items 8, 11, P9, P11): reviewers and readers see no delete section and a direct call is refused; a modeler
// deletes; in an archived workspace there is no section and the delete is refused.

test("S12A-11: no section for a reviewer or a reader, refused when called; a modeler deletes; archived: no section, refused", async ({ page, browser }) => {
  // Anna (modeler) sees the section and deletes a spare project; her request gives the action's id
  const { projectId } = await asLukasz((ctx, access) => createProject(ctx, access, { workspaceId: RETAIL, name: "Spare" }));
  await signInAs(page, "Anna Nowak");
  await page.goto(projectHome(projectId));
  await expect(deleteSection(page)).toBeVisible();
  await deleteButton(page).click();
  const actionId = await captureActionId(page, () => deleteButton(page).click());
  await expectToast(page, "Deleted the project Spare and 1 canvas that only it used. The model is untouched.");
  await expectAt(page, WS_HOME);

  const version = async () => (await store().projects.get(RETAIL, OM))!.version;
  for (const [name, role] of [["Piotr Wiśniewski", "reviewer"], ["Kasia Zielińska", "reader"]] as const) {
    const other = await newSession(browser, name);
    await other.page.goto(OM_HOME);
    await expect(other.page.getByTestId("page-project-home")).toBeVisible();
    await expect(deleteSection(other.page)).toHaveCount(0);
    const reply = await callActionDirectly(other.page, actionId, [{ workspaceId: RETAIL, projectId: OM, expectedVersion: await version() }]);
    expect(reply).toContain(`As a ${role} you cannot delete projects.`);
    await other.context.close();
  }
  expect(await store().projects.get(RETAIL, OM)).not.toBeNull();

  // archived: no section, and the delete is refused
  await archive();
  await page.goto(OM_HOME);
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  await expect(deleteSection(page)).toHaveCount(0);
  const reply = await callActionDirectly(page, actionId, [{ workspaceId: RETAIL, projectId: OM, expectedVersion: await version() }]);
  expect(reply).toContain(ARCHIVED_MESSAGE);
  expect(await store().projects.get(RETAIL, OM)).not.toBeNull();
});
