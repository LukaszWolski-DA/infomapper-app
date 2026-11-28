// S39-04 (slice 39, step 6): the details drawer. A click on a result (or Enter) opens its details from the right, 560
// px; from 1,100 px the column moves left and the results stay clickable, narrower a light scrim covers them; ↑ ↓ (or j
// k) move through the results and the drawer follows; Esc closes it. Every item has its own address ("not found" for one
// the person may not read). The header (kind, name, path, workspace, marks, "From InfoMapper · read only"); the
// characteristics; the items one step away, each opening in the same drawer with "← Back"; the context (the canvases that
// show it, the documents that include it as the reader sees them, never someone's private one). No Lineage or Impact.

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { employeesFile, importKeys } from "../slice-10b/helpers";
import { expect, test } from "./fixtures";
import {
  catalogUrl,
  demoId,
  drawer,
  drawerIn,
  drawerLink,
  drawerName,
  expectDrawerAt,
  factOf,
  grantCatalogLicence,
  itemRef,
  openRow,
  renameEntity,
  resultRows,
  rowNamed,
  searchFor,
  showInCatalog,
  signInTo,
  workspaceWithoutAnna,
} from "./helpers";

test.beforeEach(async () => {
  await grantCatalogLicence();
});

test("S39-04: a click opens the drawer from the right; on 1,280 px the results move left and stay clickable; the header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "customer" }));
  const ref = await openRow(page, "entity", "Customer");
  await expect(drawerName(page)).toHaveText("Customer");
  const box = await drawerIn(page);
  expect(box.width).toBe(560);
  // the column keeps clear of the drawer; no scrim at this width
  const main = (await page.getByTestId("page-catalog").boundingBox())!;
  expect(main.x + main.width).toBeLessThanOrEqual(1280 - 560);
  await expect(page.getByTestId("drawer-catalog-scrim")).toBeHidden();
  // the header
  await expect(drawer(page).getByTestId("text-drawer-kind")).toHaveText("Entity");
  await expect(drawer(page).getByTestId("text-drawer-workspace")).toHaveText("Retail Co – DWH");
  await expect(drawer(page).getByTestId("text-drawer-source")).toHaveText("From InfoMapper · read only");
  await expect(drawer(page).getByTestId("text-drawer-path")).toContainText("Customer");
  await expect(factOf(page, "Level")).toHaveText("Logical");
  await expect(drawer(page).getByTestId("section-drawer-text").first()).toContainText("A person or organisation that buys from us.");
  // no Lineage or Impact sections
  await expect(drawer(page)).not.toContainText("Lineage");
  await expect(drawer(page)).not.toContainText("Impact");
  // the item's address; the row is the current one
  await expect(page).toHaveURL(new RegExp(`[?&]item=${encodeURIComponent(ref)}`));
  await expect(rowNamed(page, "entity", "Customer")).toHaveAttribute("aria-current", "true");
  // another result is clickable while the drawer is open
  await openRow(page, "source_table", "customers");
  await expect(drawerName(page)).toHaveText("customers");
  await expect(factOf(page, "System")).toHaveText("CRM");
  await expect(factOf(page, "Physical name")).toHaveText("CRM / crmprod.dbo.customers");
});

test("S39-04: narrower than 1,100 px a scrim covers the results and a click on it closes the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "customer" }));
  await openRow(page, "entity", "Customer");
  await expect(page.getByTestId("drawer-catalog-scrim")).toBeVisible();
  await page.mouse.click(100, 400);
  await expect(drawer(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]item=/);
});

test("S39-04: Enter opens a result; ↓ ↑ and j k move through the results and the drawer follows; Esc closes it", async ({ page }) => {
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "customer", kind: "attributes" }));
  await expect(resultRows(page).first()).toBeVisible();
  const refs = await resultRows(page).evaluateAll((rows) => rows.map((r) => r.getAttribute("data-ref")!));
  expect(refs.length).toBeGreaterThan(2);
  await resultRows(page).first().focus();
  await page.keyboard.press("Enter");
  await expectDrawerAt(page, refs[0]!);
  await page.keyboard.press("ArrowDown");
  await expectDrawerAt(page, refs[1]!);
  await page.keyboard.press("j");
  await expectDrawerAt(page, refs[2]!);
  await page.keyboard.press("k");
  await expectDrawerAt(page, refs[1]!);
  await page.keyboard.press("ArrowUp");
  await expectDrawerAt(page, refs[0]!);
  await expect(resultRows(page).first()).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]item=/);
  await expect(page).toHaveURL(/[?&]kind=attributes/);
});

test("S39-04: a connected item opens in the same drawer and ← Back returns; an attribute's entity, a mapping's source and target", async ({ page }) => {
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "customer" }));
  const customer = await openRow(page, "entity", "Customer");
  await expect(drawer(page).getByTestId("section-drawer-group").filter({ hasText: /^Attributes/ })).toBeVisible();
  await drawerLink(page, "email").first().click();
  await expectDrawerAt(page, itemRef("attribute", await demoId("attribute", "email", "Customer")), "email");
  await expect(factOf(page, "Personal data")).toHaveText("Yes");
  // the attribute's mapping, then its source column and target
  await drawer(page).getByTestId("section-drawer-group").filter({ hasText: /^Mappings/ }).getByTestId("button-drawer-link").first().click();
  await expect(drawer(page).getByTestId("details-catalog-item")).toHaveAttribute("data-kind", "mapping");
  await expect(factOf(page, "Target")).toHaveText("email");
  await expect(factOf(page, "Source")).toHaveText("email_addr");
  // ← Back, twice
  await drawer(page).getByTestId("button-drawer-back").click();
  await expect(drawerName(page)).toHaveText("email");
  await drawer(page).getByTestId("button-drawer-back").click();
  await expectDrawerAt(page, customer, "Customer");
  await expect(drawer(page).getByTestId("button-drawer-back")).toHaveCount(0);
});

test("S39-04: an item's address opens its drawer in a new page; an item the person may not read is not found", async ({ page, context }) => {
  const ws = await workspaceWithoutAnna("Lighthouse programme", "Lighthouse Beacon");
  await signInTo(page, "Anna Nowak");
  const column = itemRef("source_column", await demoId("source_column", "cust_no", "customers"));
  const other = await context.newPage();
  await other.goto(catalogUrl({ item: column }));
  await expectDrawerAt(other, column, "cust_no");
  await expect(factOf(other, "Table")).toHaveText("customers");
  // a workspace without a role and its switch off: not found, as an item that does not exist
  const entity = (await readDb(E2E_DB)).entity.find((e) => e.name === "Lighthouse Beacon")!.id;
  await other.goto(catalogUrl({ item: itemRef("entity", entity, ws) }));
  await expect(other.getByTestId("page-not-found")).toBeVisible();
  await other.goto(catalogUrl({ item: itemRef("entity", "01900000-0000-7000-8000-000000000000") }));
  await expect(other.getByTestId("page-not-found")).toBeVisible();
  await other.goto(catalogUrl({ item: "nonsense" }));
  await expect(other.getByTestId("page-not-found")).toBeVisible();
  // its switch on: found, read only
  await showInCatalog(ws, true);
  await other.goto(catalogUrl({ item: itemRef("entity", entity, ws) }));
  await expectDrawerAt(other, itemRef("entity", entity, ws), "Lighthouse Beacon");
});

test("S39-04: a source table shows its system's last import and its declared keys", async ({ page }) => {
  await importKeys(employeesFile({ manager: true }));
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "employees", kind: "tables" }));
  await openRow(page, "source_table", "employees");
  await expect(factOf(page, "Last import")).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} of ERP/);
  await expect(drawer(page).getByTestId("section-drawer-group").filter({ hasText: /^Declared foreign keys/ })).toContainText("FK_employees_manager");
  await expect(drawer(page).getByTestId("section-drawer-group").filter({ hasText: /^Columns/ }).getByTestId("button-drawer-link")).toHaveCount(3);
});

test("S39-04: long names wrap in the drawer, which never scrolls sideways, at 1,280 and 390 px", async ({ page }) => {
  const long = "Customer postal address for billing, delivery, returns and every service visit across all sales channels";
  await renameEntity("Customer Address", long, `${"A long definition that goes on and on, ".repeat(12)}the end.`);
  await signInTo(page, "Łukasz");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(catalogUrl({ q: "postal", kind: "entities" }));
    await openRow(page, "entity", long);
    await expect(drawerName(page)).toHaveText(long);
    const box = await drawerIn(page);
    expect(box.x, `${width}: inside the screen`).toBeGreaterThanOrEqual(0);
    expect(await drawer(page).evaluate((e) => e.scrollWidth - e.clientWidth), `${width}: no sideways scroll`).toBeLessThanOrEqual(0);
    expect(await drawerName(page).evaluate((e) => e.getBoundingClientRect().height), `${width}: the name wraps`).toBeGreaterThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}: the page`).toBeLessThanOrEqual(0);
  }
});

test.describe("documents", () => {
  test.use({ seed: "docs" });

  test("S39-04: the context: the canvases that show it, and the documents as the reader sees them, never another's private one", async ({ page }) => {
    await signInTo(page, "Anna Nowak");
    await page.goto(catalogUrl({ q: "customer" }));
    await openRow(page, "entity", "Customer");
    const context = drawer(page).getByTestId("section-drawer-context");
    await expect(context.getByTestId("link-drawer-canvas").first()).toContainText("Customer & orders");
    const docs = context.getByTestId("link-drawer-document");
    await expect(docs.filter({ hasText: "Retail Co – data dictionary" })).toHaveCount(1);
    await expect(docs.filter({ hasText: "Anna's working dictionary" })).toContainText("Private, yours");
    // Łukasz's private S2T is never shown to Anna
    await expect(docs.filter({ hasText: "S2T" })).toHaveCount(0);
  });

  test("S39-04: Łukasz sees his own private document and not Anna's", async ({ page }) => {
    await signInTo(page, "Łukasz");
    await page.goto(catalogUrl({ q: "customer" }));
    await openRow(page, "entity", "Customer");
    const docs = drawer(page).getByTestId("link-drawer-document");
    await expect(docs.filter({ hasText: "Order management – S2T for the ETL team" })).toHaveCount(1);
    await expect(docs.filter({ hasText: "Anna's working dictionary" })).toHaveCount(0);
  });

  test("S39-04: a reader without a role sees no documents and no button, but who to ask", async ({ page }) => {
    const ws = await workspaceWithoutAnna("Lighthouse programme", "Lighthouse Beacon");
    await showInCatalog(ws, true);
    await signInTo(page, "Anna Nowak");
    await page.goto(catalogUrl({ q: "beacon" }));
    await openRow(page, "entity", "Lighthouse Beacon");
    await expect(drawer(page).getByTestId("button-open-in-infomapper")).toHaveCount(0);
    await expect(drawer(page).getByTestId("text-drawer-no-role")).toHaveText("You have no role in Lighthouse programme. Ask its owner for access: Łukasz.");
    await expect(drawer(page).getByTestId("link-drawer-document")).toHaveCount(0);
  });
});

test("S39-04: a search typed while the drawer is open keeps it and its address", async ({ page }) => {
  await signInTo(page, "Łukasz");
  await page.goto(catalogUrl({ q: "customer" }));
  const ref = await openRow(page, "entity", "Customer");
  await searchFor(page, "order");
  await expect(page).toHaveURL(new RegExp(`[?&]item=${encodeURIComponent(ref)}`));
  await expectDrawerAt(page, ref, "Customer");
});
