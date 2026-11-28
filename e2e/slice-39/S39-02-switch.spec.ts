// S39-02 (slice 39, A2.3): the workspace's switch "Shown in InfoCatalog to everyone in the organization" in its settings:
// hidden while the organization has no InfoCatalog licence; off by default; set by the workspace's owners and admins,
// with its line under it and a change event; read only for other roles and in an archived workspace. (What the switch
// does in the catalog is S39-02's search and drawer specs, steps 5 and 6.)

import { expect, test } from "./fixtures";
import { catalogBox, catalogCheck, catalogEvents, expectToast, grantCatalogLicence, RETAIL, SEED_IDS, settingsUrl, signInTo, storedWorkspace } from "./helpers";

test("S39-02: without the licence the settings show no InfoCatalog box", async ({ page }) => {
  await signInTo(page, "Łukasz");
  await page.goto(settingsUrl());
  await expect(page.getByTestId("box-infodoc")).toBeVisible();
  await expect(catalogBox(page)).toHaveCount(0);
  await expect(page.getByText("InfoCatalog")).toHaveCount(0);
});

test("S39-02: with the licence an owner turns it on and off, with its line and a change event each time", async ({ page }) => {
  await grantCatalogLicence();
  await signInTo(page, "Łukasz");
  await page.goto(settingsUrl());
  // below InfoDocumenter's box
  const [doc, box] = await Promise.all([page.getByTestId("box-infodoc").boundingBox(), catalogBox(page).boundingBox()]);
  expect(box!.y).toBeGreaterThan(doc!.y);
  await expect(catalogCheck(page)).not.toBeChecked();
  await expect(catalogCheck(page)).toBeEnabled();
  await expect(page.getByLabel("Shown in InfoCatalog to everyone in the organization")).toBeVisible();
  await expect(page.getByTestId("text-catalog-shown-line")).toHaveText(
    "Members of Retail Co – DWH always find it in InfoCatalog. With this on, everyone in InfoMate can find and read it there, but not change it.",
  );
  expect((await storedWorkspace()).catalog_shown).toBe(false);

  await catalogCheck(page).check();
  await expectToast(page, "Retail Co – DWH is shown in InfoCatalog to everyone in InfoMate.");
  await expect.poll(async () => (await storedWorkspace()).catalog_shown).toBe(true);
  await page.reload();
  await expect(catalogCheck(page)).toBeChecked();

  await catalogCheck(page).uncheck();
  await expectToast(page, "Retail Co – DWH is shown in InfoCatalog to its members only.");
  await expect.poll(async () => (await storedWorkspace()).catalog_shown).toBe(false);
  const events = await catalogEvents();
  expect(events.map((e) => [e.operation, e.user_id, (e.after_image as { catalog_shown: boolean }).catalog_shown])).toEqual([
    ["update", SEED_IDS.userLukasz, true],
    ["update", SEED_IDS.userLukasz, false],
  ]);
});

test("S39-02: a modeler sees the switch read only; in an archived workspace the owner does too", async ({ page }) => {
  await grantCatalogLicence();
  await signInTo(page, "Anna Nowak");
  await page.goto(settingsUrl());
  await expect(catalogCheck(page)).toBeVisible();
  await expect(catalogCheck(page)).toBeDisabled();

  // Bank X – Risk DWH is the seed's archived workspace, Łukasz its owner
  await signInTo(page, "Łukasz");
  await page.goto(settingsUrl(SEED_IDS.wsBankX));
  await expect(catalogCheck(page)).toBeVisible();
  await expect(catalogCheck(page)).toBeDisabled();
  expect((await storedWorkspace(SEED_IDS.wsBankX)).catalog_shown).toBe(false);
});

test("S39-02: an organization's licence shows the box in its workspaces only", async ({ page }) => {
  await grantCatalogLicence(SEED_IDS.orgRetailCo);
  await signInTo(page, "Łukasz");
  await page.goto(settingsUrl(RETAIL));
  await expect(page.getByTestId("box-infodoc")).toBeVisible();
  await expect(catalogBox(page)).toHaveCount(0);
  // Sales analytics is Retail Co's; Łukasz is a guest reviewer there and sees the box read only
  await page.goto(settingsUrl(SEED_IDS.wsSales));
  await expect(catalogBox(page)).toBeVisible();
  await expect(catalogCheck(page)).toBeDisabled();
});
