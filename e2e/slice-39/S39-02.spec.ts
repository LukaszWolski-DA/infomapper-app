// S39-02 in the catalog (slice 39, step 5, C9): who finds what. A member with a role finds her workspaces; a member
// without a role in a workspace finds it only while its switch "Shown in InfoCatalog" is on, and not at all while it is
// off (not in the results, not in the scope list, not by its address); a guest finds nothing of the organization. The
// workspace without a role is test data made through the domain (Łukasz's new InfoMate workspace with one entity).

import { expect, test } from "./fixtures";
import { catalogUrl, grantCatalogLicence, kindTab, landing, resultRows, scopeSelect, searchFor, SEED_IDS, showInCatalog, signInTo, workspaceWithoutAnna } from "./helpers";

const OPEN = "Lighthouse programme";
const ENTITY = "Lighthouse Beacon";

test.beforeEach(async () => {
  await grantCatalogLicence();
});

test("S39-02: Anna finds the workspaces she has a role in", async ({ page }) => {
  await signInTo(page, "Anna Nowak");
  await expect(landing(page)).toBeVisible();
  await page.goto(catalogUrl());
  const options = await scopeSelect(page).locator("option").allTextContents();
  expect(options).toEqual(["Whole organization (2 workspaces)", "Workspace: Bank X – Risk DWH · Archived", "Workspace: Retail Co – DWH"]);
  await searchFor(page, "customer");
  await expect(resultRows(page).first().getByTestId("text-result-name")).toHaveText("Customer");
});

test("S39-02: a member without a role finds a workspace only while its switch is on", async ({ page }) => {
  const ws = await workspaceWithoutAnna(OPEN, ENTITY);
  await signInTo(page, "Anna Nowak");

  // off (the default): nowhere
  await page.goto(catalogUrl());
  expect(await scopeSelect(page).locator("option").allTextContents()).not.toContain(`Workspace: ${OPEN}`);
  await searchFor(page, "lighthouse");
  await expect(page.getByTestId("box-catalog-nothing")).toBeVisible();
  await page.goto(catalogUrl({ scope: ws }));
  await expect(page.getByTestId("page-not-found")).toBeVisible();
  // the landing tile does not count it
  await page.goto("/");
  await expect(page.getByTestId("tile-infocatalog-count")).toHaveText(/ in 2 workspaces of InfoMate$/);

  // on: found, read only, in the scope list and by its address; the tile counts it
  await showInCatalog(ws, true);
  await page.reload();
  await expect(page.getByTestId("tile-infocatalog-count")).toHaveText(/ in 3 workspaces of InfoMate$/);
  await page.goto(catalogUrl());
  expect(await scopeSelect(page).locator("option").allTextContents()).toContain(`Workspace: ${OPEN}`);
  await searchFor(page, "lighthouse");
  const row = resultRows(page).filter({ hasText: ENTITY }).first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId("text-result-workspace")).toHaveText(OPEN);
  await page.goto(catalogUrl({ scope: ws, q: "beacon" }));
  await expect(resultRows(page).first().getByTestId("text-result-name")).toHaveText(ENTITY);
  await expect(kindTab(page, "all")).toHaveText(/All\s*1$/);

  // off again: gone
  await showInCatalog(ws, false);
  await page.goto(catalogUrl({ q: "lighthouse" }));
  await expect(page.getByTestId("box-catalog-nothing")).toBeVisible();
  await page.goto(catalogUrl({ scope: ws }));
  await expect(page.getByTestId("page-not-found")).toBeVisible();
});

test("S39-02: Kasia, a guest in InfoMate, finds nothing of it", async ({ page }) => {
  await workspaceWithoutAnna(OPEN, ENTITY).then((ws) => showInCatalog(ws, true));
  await signInTo(page, "Kasia Zielińska");
  await expect(landing(page)).toHaveCount(0);
  for (const params of [{}, { q: "customer" }, { scope: SEED_IDS.wsRetailDwh }] as Record<string, string>[]) {
    await page.goto(catalogUrl(params));
    await expect(page.getByTestId("page-not-found")).toBeVisible();
  }
});
