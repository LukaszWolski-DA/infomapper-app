import { expect, test } from "@playwright/test";
import { callActionDirectly, captureActionId, createFromSwitcher, expectToast, newSession, SEED_IDS } from "./helpers";

const ws = SEED_IDS.wsRetailDwh;

test("S0-06: a reviewer gets no way to create projects or edit settings, and the server refuses direct calls", async ({ browser }) => {
  // Łukasz (owner) uses the actions once, so their ids can be called again directly as Piotr.
  const owner = await newSession(browser, "Łukasz");
  const createProjectId = await captureActionId(owner.page, () =>
    createFromSwitcher(owner.page, "switcher-project", "input-new-project", "Reviewer check"),
  );
  await expectToast(owner.page, "Created the project Reviewer check.");
  await owner.page.goto(`/w/${ws}?tab=settings`);
  const updateSettingsId = await captureActionId(owner.page, () => owner.page.getByTestId("checkbox-dv2").check());
  await expectToast(owner.page, "Data Vault 2.0 mode is on: see the hints in entity panels.");
  await owner.page.getByTestId("checkbox-dv2").uncheck();
  await expectToast(owner.page, "Data Vault 2.0 mode is off.");

  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await expect(page).toHaveURL(new RegExp(`/w/${ws}$`));
  await expect(page.getByTestId("banner-role")).toHaveText(
    "You are a reviewer here: you can approve mappings and requirements and add notes, but not edit the model.",
  );
  await expect(page.getByTestId("tile-project").first()).toBeVisible();
  await expect(page.getByTestId("tile-new-project")).toHaveCount(0);
  await expect(page.getByTestId("box-archive")).toHaveCount(0);

  await page.getByTestId("switcher-project").click();
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  await expect(page.getByTestId("input-new-project")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByTestId("tab-settings").click();
  for (const id of ["input-workspace-name", "input-workspace-client", "input-workspace-description", "select-workspace-language", "checkbox-dv2", "checkbox-four-eyes"]) {
    await expect(page.getByTestId(id)).toBeDisabled();
  }

  // Direct calls, bypassing the UI
  const projectReply = await callActionDirectly(page, createProjectId, [{ workspaceId: ws, name: "Sneaky" }]);
  expect(projectReply).toContain("As a reviewer you cannot create projects.");
  const settingsReply = await callActionDirectly(page, updateSettingsId, [{ workspaceId: ws, expectedVersion: 3, name: "Sneaky" }]);
  expect(settingsReply).toContain("As a reviewer you cannot change the workspace settings.");

  await page.goto(`/w/${ws}`);
  await expect(page.getByTestId("page-workspace-home")).toContainText("Retail Co – DWH");
  await expect(page.getByTestId("tile-project").filter({ hasText: "Sneaky" })).toHaveCount(0);
});
