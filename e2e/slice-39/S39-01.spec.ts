// S39-01 (slice 39, C5, C6): the landing zone, only with the licence. Without it sign-in goes to InfoMapper as before,
// there is no "All apps" and `/catalog` is not found. With it (the person a member of a licensed organization): the
// greeting, the lead line and two tiles with their texts, counts and buttons; "All apps" in the top bar leads back; the
// organization-password sign-in follows the same rule. A guest never gets InfoCatalog's tile for that organization;
// with several organizations the landing zone shows when any one of them holds the licence, and the catalog opens only
// on a licensed one.

import { expect, test } from "./fixtures";
import {
  allApps,
  grantCatalogLicence,
  itemsOf,
  landing,
  makeMember,
  notFoundPage,
  RETAIL,
  SEED_IDS,
  signInTo,
  signInWithOrganization,
} from "./helpers";

const MAPPER_BULLETS = ["Entities, attributes, relationships and source tables on canvases", "Source-to-target mappings with review and approval", "Requirements, baselines and documentation"];
const CATALOG_BULLETS = ["Entities, attributes, mappings, sources, requirements and classifications", "From the source column to the attribute and the requirement", "Where each item is used, on canvases and in documents"];
const LEAD = "Two apps on one metadata repository: the model is built in InfoMapper and found, read and described in InfoCatalog. A change in one is seen in the other at once.";

test("S39-01: without the licence sign-in goes to InfoMapper, there is no All apps, and /catalog is not found", async ({ page }) => {
  await signInTo(page, "Łukasz");
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+/);
  await expect(allApps(page)).toHaveCount(0);
  for (const path of ["/catalog", `/catalog?org=${SEED_IDS.orgInfoMate}`, "/catalog/anything"]) {
    await page.goto(path);
    await expect(notFoundPage(page), path).toBeVisible();
    await expect(page.getByText("InfoCatalog")).toHaveCount(0);
  }
});

test("S39-01: with the licence the landing zone greets, explains and offers both apps; All apps leads back to it", async ({ page }) => {
  await grantCatalogLicence();
  await signInTo(page, "Łukasz");
  await expect(landing(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("text-platform-title")).toHaveText("InfoMate apps");
  await expect(page.getByTestId("text-greeting")).toHaveText(/^Good (morning|afternoon|evening), Łukasz$/);
  await expect(page.getByTestId("text-greeting")).toBeVisible();
  await expect(page.getByTestId("text-landing-lead")).toHaveText(LEAD);

  const mapper = page.getByTestId("tile-infomapper");
  await expect(mapper.getByRole("heading")).toHaveText("InfoMapper");
  await expect(mapper).toContainText("Model and map");
  await expect(mapper).toContainText("Build the conceptual, logical and physical model in one place, and map it to the sources.");
  await expect(mapper.locator("li")).toHaveText(MAPPER_BULLETS);
  // the dev sign-in unlocks every organization: Retail Co – DWH, Bank X (archived) and Sales analytics (a guest there)
  await expect(page.getByTestId("tile-infomapper-count")).toHaveText(/^3 workspaces you belong to · last: .+$/);

  const catalog = page.getByTestId("tile-infocatalog");
  await expect(catalog.getByRole("heading")).toHaveText("InfoCatalogNew");
  await expect(catalog).toContainText("Find and describe");
  await expect(catalog).toContainText("Search everything the modellers have built, across InfoMate or in one workspace, and see where each item comes from.");
  await expect(catalog.locator("li")).toHaveText(CATALOG_BULLETS);
  // Łukasz has a role in both InfoMate workspaces
  const items = await itemsOf(SEED_IDS.userLukasz, SEED_IDS.orgInfoMate);
  expect(items).toBeGreaterThan(100);
  await expect(page.getByTestId("tile-infocatalog-count")).toHaveText(`${items.toLocaleString("en")} items in 2 workspaces of InfoMate`);

  await page.getByTestId("button-open-infomapper").click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+/);
  // All apps: directly before the organization switcher, 28 px
  await expect(allApps(page)).toBeVisible();
  const [apps, org] = await Promise.all([allApps(page).boundingBox(), page.getByTestId("switcher-organization").boundingBox()]);
  expect(apps!.x + apps!.width).toBeLessThanOrEqual(org!.x);
  expect(Math.round(apps!.width)).toBe(28);
  await expect(allApps(page)).toHaveAttribute("aria-label", "All apps");
  await allApps(page).click();
  await expect(landing(page)).toBeVisible();

  await page.getByTestId("button-open-infocatalog").click();
  await expect(page.getByTestId("page-catalog")).toHaveAttribute("data-organization", SEED_IDS.orgInfoMate);
  await page.getByTestId("button-all-apps").click();
  await expect(landing(page)).toBeVisible();
});

test("S39-01: the organization-password sign-in follows the same rule", async ({ page }) => {
  await signInWithOrganization(page, "lukasz@infomate.pl", "InfoMate");
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(landing(page)).toHaveCount(0);

  await grantCatalogLicence();
  await page.context().clearCookies();
  await signInWithOrganization(page, "lukasz@infomate.pl", "InfoMate");
  await expect(landing(page)).toBeVisible();
  // only InfoMate is unlocked: InfoMapper's tile counts its two workspaces
  await expect(page.getByTestId("tile-infomapper-count")).toHaveText(/^2 workspaces you belong to · last: .+$/);
});

test("S39-01: a guest never gets InfoCatalog for that organization; All apps only where the person reads the catalog", async ({ page }) => {
  await grantCatalogLicence();
  // Kasia is a guest reader in InfoMate's Retail Co – DWH and a member of Retail Co, which has no licence
  await signInTo(page, "Kasia Zielińska");
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(landing(page)).toHaveCount(0);
  await expect(page.getByTestId("tile-infocatalog")).toHaveCount(0);
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(allApps(page)).toHaveCount(0);
  await page.goto("/catalog");
  await expect(notFoundPage(page)).toBeVisible();

  // Łukasz reads InfoMate's catalog: All apps in its workspaces, not in Sales analytics, where he is a guest of Retail Co
  await signInTo(page, "Łukasz");
  await page.goto(`/w/${RETAIL}`);
  await expect(allApps(page)).toBeVisible();
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(allApps(page)).toHaveCount(0);
});

test("S39-01: with several organizations the landing zone shows when any one holds the licence; the catalog opens on a licensed one only", async ({ page }) => {
  // Łukasz a member of Retail Co too; only Retail Co holds the licence
  await makeMember(SEED_IDS.userLukasz, SEED_IDS.orgRetailCo);
  await grantCatalogLicence(SEED_IDS.orgRetailCo);
  await signInTo(page, "Łukasz");
  await expect(landing(page)).toBeVisible();
  await expect(page.getByTestId("tile-infocatalog")).toContainText("across Retail Co or in one workspace");
  await expect(page.getByTestId("tile-infocatalog-count")).toHaveText(/ in 1 workspace of Retail Co$/);
  await page.getByTestId("button-open-infocatalog").click();
  await expect(page.getByTestId("page-catalog")).toHaveAttribute("data-organization", SEED_IDS.orgRetailCo);
  await page.goto(`/catalog?org=${SEED_IDS.orgInfoMate}`);
  await expect(notFoundPage(page)).toBeVisible();
  // All apps: in Retail Co's workspace, not in InfoMate's
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(allApps(page)).toBeVisible();
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(allApps(page)).toHaveCount(0);
});
