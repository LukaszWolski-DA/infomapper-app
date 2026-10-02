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
  await expectToast(owner.page, "Data Vault 2.0 mode is on.");
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

test("S0-06: a reviewer gets no way to create, rename or move canvases, and the server refuses direct calls", async ({ browser }) => {
  const projectUrl = `/w/${ws}/p/${SEED_IDS.projCustomer360}`;
  const owner = await newSession(browser, "Łukasz");
  await createFromSwitcher(owner.page, "switcher-project", "input-new-project", "Canvas check");
  await expectToast(owner.page, "Created the project Canvas check.");
  const createCanvasId = await captureActionId(owner.page, () => owner.page.getByTestId("tile-new-canvas").click());
  const renameId = await captureActionId(owner.page, async () => {
    await owner.page.getByTestId("input-canvas-name").fill("Renamed once");
    await owner.page.getByTestId("input-canvas-name").press("Enter");
  });
  await owner.page.getByTestId("tab-home").click();
  const tile = owner.page.getByTestId("tile-canvas").filter({ hasText: "Renamed once" });
  await tile.hover();
  await tile.getByTestId("button-canvas-menu").click();
  const addId = await captureActionId(owner.page, () =>
    owner.page.getByTestId("menu-item-in-project").filter({ hasText: "Customer 360" }).click(),
  );
  await expectToast(owner.page, "Renamed once is now also in Customer 360.");

  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await page.goto(projectUrl);
  await expect(page.getByTestId("tile-canvas").first()).toBeVisible();
  await expect(page.getByTestId("tile-new-canvas")).toHaveCount(0);
  await expect(page.getByTestId("tile-add-canvas")).toHaveCount(0);
  await expect(page.getByTestId("button-canvas-menu")).toHaveCount(0);
  await expect(page.getByTestId("button-new-canvas")).toHaveCount(0);
  await page.getByTestId("tab-canvas").first().dblclick();
  await expect(page.getByTestId("input-canvas-name")).toHaveCount(0);

  const canvasId = SEED_IDS.canvasCustomerOrders;
  expect(await callActionDirectly(page, createCanvasId, [{ workspaceId: ws, projectId: SEED_IDS.projCustomer360, name: "Sneaky" }])).toContain(
    "As a reviewer you cannot create canvases.",
  );
  expect(await callActionDirectly(page, renameId, [{ workspaceId: ws, canvasId, expectedVersion: 1, name: "Sneaky" }])).toContain(
    "As a reviewer you cannot rename canvases.",
  );
  expect(await callActionDirectly(page, addId, [{ workspaceId: ws, canvasId: SEED_IDS.canvasOrderLines, projectId: SEED_IDS.projCustomer360 }])).toContain(
    "As a reviewer you cannot change which projects a canvas belongs to.",
  );
  await page.goto(projectUrl);
  await expect(page.getByTestId("tile-canvas-name")).not.toContainText(["Sneaky"]);
});
