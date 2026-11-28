// S39-05 (slice 39, step 6): Open in InfoMapper. It opens the item's workspace and a canvas that shows it, the item
// selected and centred (a mapping: a canvas with both ends; a relationship: both entities, the relationship selected; a
// column: its table's card; a requirement: its card when it has one); the canvas is the first in the Context list, and
// each canvas there opens itself. An item on no canvas opens the workspace's home with "{name} is not on any canvas".
// InfoMapper's navigation row then shows "← Back to InfoCatalog", back to the same search, scope, kind tab and item. A
// person without a role sees no button but who to ask (S39-04's spec). The plain seed with InfoMate's licence.

import type { Page } from "@playwright/test";
import { expectSelected } from "../slice-06b/helpers";
import { expect, test } from "./fixtures";
import { catalogUrl, demoId, drawer, expectDrawerAt, grantCatalogLicence, itemRef, openRow, RETAIL, SEED_IDS, signInTo } from "./helpers";

const back = (page: Page) => page.getByTestId("button-back-to-catalog");
const open = (page: Page) => drawer(page).getByTestId("button-open-in-infomapper");
const CANVAS = `/w/${RETAIL}/p/${SEED_IDS.projCustomer360}/c/${SEED_IDS.canvasCustomerOrders}`;

/** The card's centre lies in the canvas's view (it was brought there). */
async function expectInView(page: Page, name: string) {
  const card = page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText(name, { exact: true }) }).first();
  await expect(card).toBeVisible();
  const pane = (await page.locator(".react-flow").boundingBox())!;
  const box = (await card.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  expect(cx).toBeGreaterThan(pane.x);
  expect(cx).toBeLessThan(pane.x + pane.width);
  expect(cy).toBeGreaterThan(pane.y);
  expect(cy).toBeLessThan(pane.y + pane.height);
}

test.beforeEach(async ({ page }) => {
  await grantCatalogLicence();
  await signInTo(page, "Łukasz");
});

test("S39-05: an entity opens on the first canvas that shows it, selected and centred; ← Back to InfoCatalog returns to the search and the item", async ({ page }) => {
  await page.goto(catalogUrl({ q: "customer", kind: "entities" }));
  const ref = await openRow(page, "entity", "Customer");
  // the first canvas of the Context list is Open's target
  await expect(drawer(page).getByTestId("link-drawer-canvas").first()).toContainText("Customer 360 › Customer & orders");
  await open(page).click();
  await expect(page).toHaveURL(new RegExp(`${CANVAS}$`));
  await expectSelected(page, "entity:Customer");
  await expectInView(page, "Customer");
  await expect(back(page)).toBeVisible();
  // another page of the same workspace keeps the way back
  await page.getByTestId("breadcrumb").filter({ hasText: "Retail Co – DWH" }).click();
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect(back(page)).toBeVisible();
  await back(page).click();
  await expect(page).toHaveURL(/\/catalog\?/);
  await expect(page).toHaveURL(/[?&]q=customer(&|$)/);
  await expect(page).toHaveURL(/[?&]kind=entities(&|$)/);
  await expectDrawerAt(page, ref, "Customer");
  // the catalog is open again: the way back ends
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect(back(page)).toHaveCount(0);
});

test("S39-05: a mapping opens on a canvas with both ends, the mapping selected; a relationship with both entities, selected", async ({ page }) => {
  await page.goto(catalogUrl({ q: "email_addr", kind: "mappings" }));
  await openRow(page, "mapping", "customers.email_addr → Customer.email");
  await open(page).click();
  await expect(page).toHaveURL(new RegExp(`${CANVAS}$`));
  await expectSelected(page, "mapping");

  await page.goto(catalogUrl({ kind: "relationships", scope: RETAIL }));
  await page.getByTestId("row-catalog-result").first().click();
  await expect(drawer(page).getByTestId("details-catalog-item")).toHaveAttribute("data-kind", "relationship");
  await open(page).click();
  await expect(page).toHaveURL(/\/c\//);
  await expectSelected(page, "relationship");
});

test("S39-05: a column opens on its table's card with its row; a requirement on its card", async ({ page }) => {
  await page.goto(catalogUrl({ q: "cust_no", kind: "columns" }));
  const column = itemRef("source_column", await demoId("source_column", "cust_no", "customers"));
  await page.locator(`[data-testid="row-catalog-result"][data-ref="${column}"]`).click();
  await expectDrawerAt(page, column, "cust_no");
  await open(page).click();
  await expect(page).toHaveURL(/\/c\//);
  await expect(page.getByTestId("panel-inspector").getByTestId("panel-source-column")).toBeVisible();
  await expectInView(page, "customers");

  // REQ-104 has its card on "Customer & orders"
  await page.goto(catalogUrl({ q: "REQ-104" }));
  await openRow(page, "requirement", "REQ-104 Order total equals the sum of its lines");
  await expect(drawer(page).getByTestId("link-drawer-canvas").first()).toContainText("Customer & orders");
  await open(page).click();
  await expect(page).toHaveURL(new RegExp(`${CANVAS}$`));
  await expectSelected(page, "req:REQ-104");
  const card = page.locator(`.react-flow__node-req`).first();
  await expect(card).toBeInViewport();
});

test("S39-05: an item on no canvas opens the workspace's home with '{name} is not on any canvas'", async ({ page }) => {
  await page.goto(catalogUrl({ q: "REQ-101" }));
  await openRow(page, "requirement", "REQ-101 Single view of the customer");
  await expect(drawer(page).getByTestId("link-drawer-canvas")).toHaveCount(0);
  await open(page).click();
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect(page.getByTestId("toast")).toContainText("REQ-101 Single view of the customer is not on any canvas.");
  await expect(page).toHaveURL(new RegExp(`/w/${RETAIL}$`));
  await expect(back(page)).toBeVisible();
});

test("S39-05: each canvas of the Context list opens itself; a classification opens the Metadata conventions tab", async ({ page }) => {
  await page.goto(catalogUrl({ q: "customer", kind: "entities" }));
  await openRow(page, "entity", "Customer");
  const canvases = drawer(page).getByTestId("link-drawer-canvas");
  await expect(canvases).toHaveText([/Customer 360 › Customer & orders/, /Order management › Customer & orders/]);
  await canvases.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/w/${RETAIL}/p/${SEED_IDS.projOrderManagement}/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expectSelected(page, "entity:Customer");

  await page.goto(catalogUrl({ q: "personal data", kind: "classes", scope: RETAIL }));
  await page.getByTestId("row-catalog-result").first().click();
  await expect(drawer(page).getByTestId("details-catalog-item")).toHaveAttribute("data-kind", "classification");
  await open(page).click();
  await expect(page).toHaveURL(new RegExp(`/w/${RETAIL}\\?tab=conventions$`));
});
