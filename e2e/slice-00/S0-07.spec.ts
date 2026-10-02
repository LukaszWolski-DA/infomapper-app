import { expect, test } from "@playwright/test";
import { addMember, callActionDirectly, captureActionId, createFromSwitcher, expectToast, newSession, SEED_IDS } from "./helpers";

const bank = SEED_IDS.wsBankX;

test("S0-07: in an archived workspace all writes are refused; after the owner unarchives it, writes work again", async ({ browser }) => {
  const { page } = await newSession(browser, "Łukasz");
  // capture the create-project action in an editable workspace, to call it directly in Bank X
  const createProjectId = await captureActionId(page, () =>
    createFromSwitcher(page, "switcher-project", "input-new-project", "Archive check"),
  );
  await expectToast(page, "Created the project Archive check.");

  await page.goto(`/w/${bank}`);
  await expect(page.getByTestId("banner-archived")).toContainText("This workspace is archived. Everything is read-only.");
  await expect(page.getByTestId("badge-archived")).toHaveText("Archived · read-only");
  await expect(page.getByTestId("tile-new-project")).toHaveCount(0);
  await page.getByTestId("switcher-project").click();
  await expect(page.getByTestId("input-new-project")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto(`/w/${bank}?tab=settings`);
  await expect(page.getByTestId("input-workspace-name")).toBeDisabled();

  const refused = await callActionDirectly(page, createProjectId, [{ workspaceId: bank, name: "Not allowed" }]);
  expect(refused).toContain("This workspace is archived, so it is read-only.");

  // the owner unarchives from the banner
  await page.goto(`/w/${bank}`);
  await page.getByTestId("button-unarchive-banner").click();
  await expectToast(page, "Bank X – Risk DWH is editable again.");
  await expect(page.getByTestId("banner-archived")).toHaveCount(0);
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Owner");

  // writes work again
  await page.getByTestId("tile-new-project").click();
  await page.getByTestId("input-new-project-tile").fill("Risk models");
  await page.getByTestId("input-new-project-tile").press("Enter");
  await expectToast(page, "Created the project Risk models.");
  await expect(page.getByTestId("page-project-home")).toContainText("Risk models");

  // and archive it again for the other tests
  await page.goto(`/w/${bank}`);
  await page.getByTestId("button-archive").click();
  await expectToast(page, "Archived Bank X – Risk DWH. It is read-only now.");
  await expect(page.getByTestId("banner-archived")).toBeVisible();
});

test("S0-07: only the owner can archive; an admin sees the button disabled with a hint", async ({ browser }) => {
  const owner = await newSession(browser, "Łukasz");
  await createFromSwitcher(owner.page, "switcher-workspace", "input-new-workspace", "Admin check");
  await expectToast(owner.page, "Created the workspace Admin check.");
  await expect(owner.page.getByTestId("switcher-workspace")).toHaveText("Admin check");
  const workspaceId = /\/w\/([^/?]+)/.exec(owner.page.url())![1]!;
  await expect(owner.page.getByTestId("button-archive")).toBeEnabled();

  // Test setup: Anna becomes admin there (changing roles is not part of slice 0).
  await addMember(workspaceId, SEED_IDS.userAnna, "admin", SEED_IDS.userLukasz);

  const { page } = await newSession(browser, "Anna Nowak");
  await page.goto(`/w/${workspaceId}`);
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Admin");
  await expect(page.getByTestId("button-archive")).toBeDisabled();
  await expect(page.getByTestId("hint-archive-owner-only")).toHaveText("Only the owner can archive");
  // an admin may edit the settings
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("input-workspace-name")).toBeEnabled();
});
