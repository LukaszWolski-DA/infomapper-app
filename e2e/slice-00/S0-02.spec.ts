import { expect, test } from "@playwright/test";
import { pickFromMenu, SEED_IDS, signInAs } from "./helpers";

test("S0-02: the top bar shows organization / workspace / project, and the switchers navigate", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await expect(page.getByTestId("switcher-organization")).toHaveText("InfoMate");
  await expect(page.getByTestId("switcher-workspace")).toHaveText("Retail Co – DWH");
  await expect(page.getByTestId("switcher-project")).toHaveText("Customer 360");

  // switching to the Retail Co organization opens Sales analytics
  await pickFromMenu(page, "switcher-organization", "Retail Co guest");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));
  await expect(page.getByTestId("switcher-organization")).toHaveText("Retail Co");
  await expect(page.getByTestId("switcher-workspace")).toHaveText("Sales analytics");

  // switching workspace opens its home
  await pickFromMenu(page, "switcher-organization", "InfoMate 2 workspaces");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await pickFromMenu(page, "switcher-workspace", "Bank X – Risk DWH archived");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsBankX}$`));
  await expect(page.getByTestId("page-workspace-home")).toContainText("Bank X – Risk DWH");

  // switching project opens the project home
  await pickFromMenu(page, "switcher-workspace", "Retail Co – DWH Owner");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await pickFromMenu(page, "switcher-project", "Order management 2 canvases");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projOrderManagement}$`));
  await expect(page.getByTestId("page-project-home")).toContainText("Order management");

  // the last used project is remembered per workspace
  await pickFromMenu(page, "switcher-workspace", "Workspace home");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(page.getByTestId("switcher-project")).toHaveText("Order management");
});
