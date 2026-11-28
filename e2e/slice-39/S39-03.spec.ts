// S39-03 (slice 39, step 5): search across every layer. One field ("/" puts the cursor in it); every word must match,
// case and accents ignored; the ranking; the highlight; each result a plain row (name with its one-line definition,
// kind, details, the workspace when more than one is in scope, marks); the scope; the kind tabs with counts, "All"
// first, a kind with no result disabled, InfoCube's tabs only where it is on; the first 200 and "{n} more"; the empty
// field's examples and "Browse all …"; the state in the address, kept by a reload. Read only. The plain seed with
// InfoMate's licence (Łukasz has a role in both its workspaces).

import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import {
  addPerformanceTest,
  catalogUrl,
  grantCatalogLicence,
  kindTab,
  RETAIL,
  renameEntity,
  resultNames,
  resultRows,
  scopeSelect,
  searchField,
  searchFor,
  SEED_IDS,
  signInTo,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await grantCatalogLicence();
  await signInTo(page, "Łukasz");
});

test("S39-03: '/' focuses the field; a search finds every layer, the exact name first, highlighted; the address keeps it through a reload", async ({ page }) => {
  await page.goto(catalogUrl());
  await expect(page.getByTestId("box-catalog-empty")).toBeVisible();
  await page.getByTestId("box-catalog-empty").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  await expect(searchField(page)).toBeFocused();
  await page.keyboard.type("customer");
  await expect(page).toHaveURL(/[?&]q=customer(&|$)/);
  await expect(resultRows(page).first()).toBeVisible();

  const first = resultRows(page).first();
  await expect(first.getByTestId("text-result-name")).toHaveText("Customer");
  await expect(first.getByTestId("text-result-kind")).toHaveText("Entity");
  await expect(first.locator("mark").first()).toHaveText("Customer");
  // every layer: entities, attributes, source tables and columns, mappings
  const kinds = new Set(await resultRows(page).evaluateAll((rows) => rows.map((r) => r.getAttribute("data-kind"))));
  for (const k of ["entity", "attribute", "source_table", "source_column", "mapping"]) expect(kinds, k).toContain(k);
  // the ranking: the exact names first, then names that start with the words, before the rest
  const names = (await resultNames(page)).map((n) => n.toLowerCase());
  const exact = names.filter((n) => n === "customer").length;
  expect(names.slice(0, exact).every((n) => n === "customer")).toBe(true);
  const lastStart = names.map((n) => n.startsWith("customer")).lastIndexOf(true);
  const firstOther = names.findIndex((n) => !n.startsWith("customer"));
  expect(firstOther).toBeGreaterThan(0);
  expect(lastStart).toBeLessThan(firstOther);
  // the summary counts every result of the tab
  const all = Number((await kindTab(page, "all").textContent())!.replace(/\D/g, ""));
  await expect(page.getByTestId("text-catalog-summary")).toHaveText(`${all} results`);

  await page.reload();
  await expect(searchField(page)).toHaveValue("customer");
  await expect(resultRows(page).first().getByTestId("text-result-name")).toHaveText("Customer");
});

test("S39-03: every word must match, in any field, case and accents ignored; nothing found says so", async ({ page }) => {
  await page.goto(catalogUrl());
  await searchFor(page, "customer");
  const one = await resultRows(page).count();
  await searchFor(page, "CUSTOMER Number");
  const two = await resultRows(page).count();
  expect(two).toBeGreaterThan(0);
  expect(two).toBeLessThan(one);
  // a word from a definition: Customer's is "A person or organisation that buys from us."
  await searchFor(page, "organisation buys");
  await expect(resultRows(page).first().getByTestId("text-result-name")).toHaveText("Customer");
  await expect(resultRows(page).first().getByTestId("text-result-definition").locator("mark")).toHaveText(["organisation", "buys"]);
  await searchFor(page, "customer qqqq");
  await expect(page.getByTestId("box-catalog-nothing")).toContainText("Nothing found");
  await expect(page.getByTestId("box-catalog-nothing")).toContainText("No items match “customer qqqq” in InfoMate.");
});

test("S39-03: Polish letters are found without their accents, and highlighted as written", async ({ page }) => {
  await renameEntity("Customer Address", "Źródło adresów klienta", "Adres zamieszkania, pochodzący ze źródła CRM; łączy się z klientem.");
  await page.goto(catalogUrl());
  for (const q of ["zrodlo", "ŹRÓDŁO", "zrodło adresow"]) {
    await searchFor(page, q);
    const row = resultRows(page).filter({ hasText: "Źródło adresów klienta" }).first();
    await expect(row, q).toBeVisible();
    await expect(row.getByTestId("text-result-name").locator("mark").first()).toHaveText("Źródło");
  }
  await searchFor(page, "laczy klientem");
  await expect(resultRows(page).first().getByTestId("text-result-name")).toHaveText("Źródło adresów klienta");
  await expect(resultRows(page).first().getByTestId("text-result-definition").locator("mark")).toHaveText(["łączy", "klientem"]);
});

test("S39-03: long names wrap in their row, the definition stays on one line, and the page does not scroll sideways", async ({ page }) => {
  const long = "Customer postal address for billing, delivery, returns and every service visit across all sales channels";
  await renameEntity("Customer Address", long, `${"A long definition that goes on and on, ".repeat(12)}the end.`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(catalogUrl({ q: "postal" }));
    const row = resultRows(page).and(page.locator('[data-kind="entity"]')).filter({ hasText: long });
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    expect(box.x + box.width, `${width}: the row fits`).toBeLessThanOrEqual(width);
    const def = row.getByTestId("text-result-definition");
    expect(await def.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("nowrap");
    expect(await def.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}: no sideways scroll`).toBeLessThanOrEqual(0);
  }
});

test("S39-03: the kind tabs: All first with every count, a tab narrows the rows, a kind with no result is disabled, InfoCube's only where it is on", async ({ page }) => {
  await page.goto(catalogUrl({ q: "customer" }));
  await expect(resultRows(page).first()).toBeVisible();
  const labels = await page.getByTestId("tab-catalog-kind").evaluateAll((tabs) => tabs.map((t) => t.firstChild!.textContent));
  expect(labels).toEqual(["All", "Entities", "Attributes", "Relationships", "Concepts", "Source tables", "Source columns", "Mappings", "Requirements", "Classifications and stereotypes"]);
  await expect(kindTab(page, "all")).toHaveAttribute("aria-selected", "true");
  const attributes = Number((await kindTab(page, "attributes").textContent())!.replace(/\D/g, ""));
  expect(attributes).toBeGreaterThan(0);
  await kindTab(page, "attributes").click();
  await expect(page).toHaveURL(/[?&]kind=attributes(&|$)/);
  await expect(resultRows(page)).toHaveCount(attributes);
  expect(new Set(await resultRows(page).evaluateAll((rows) => rows.map((r) => r.getAttribute("data-kind"))))).toEqual(new Set(["attribute"]));
  // the active tab again goes back to All
  await kindTab(page, "attributes").click();
  await expect(kindTab(page, "all")).toHaveAttribute("aria-selected", "true");
  // a kind with no result is disabled
  const zero = await page.getByTestId("tab-catalog-kind").evaluateAll((tabs) => tabs.filter((t) => t.textContent!.endsWith(" 0") || /\D0$/.test(t.textContent!)).map((t) => t.getAttribute("data-kind")));
  expect(zero.length).toBeGreaterThan(0);
  for (const k of zero) await expect(kindTab(page, k!)).toBeDisabled();

  // InfoCube on in Retail Co – DWH: its five tabs appear after InfoMapper's
  const db = await readDb(E2E_DB);
  db.workspace.find((w) => w.id === RETAIL)!.infocube = true;
  await writeDb(E2E_DB, db);
  await page.reload();
  await expect(kindTab(page, "facts")).toBeVisible();
  for (const k of ["dimensions", "measures", "keys", "cube-mappings"]) await expect(kindTab(page, k)).toBeVisible();
  // only where it is on: Bank X alone has no InfoCube tabs
  await scopeSelect(page).selectOption(SEED_IDS.wsBankX);
  await expect(page).toHaveURL(new RegExp(`[?&]scope=${SEED_IDS.wsBankX}`));
  await expect(kindTab(page, "facts")).toHaveCount(0);
});

test("S39-03: the scope: the whole organization with a Workspace column, or one workspace; archived ones marked", async ({ page }) => {
  await page.goto(catalogUrl({ q: "customer" }));
  await expect(resultRows(page).first()).toBeVisible();
  const options = await scopeSelect(page).locator("option").allTextContents();
  expect(options).toEqual(["Whole organization (2 workspaces)", "Workspace: Bank X – Risk DWH · Archived", "Workspace: Retail Co – DWH"]);
  await expect(page.getByRole("columnheader", { name: "Workspace" })).toBeVisible();
  await expect(resultRows(page).first().getByTestId("text-result-workspace")).toHaveText(/Retail Co – DWH|Bank X – Risk DWH/);
  // Bank X's rows carry "Archived"
  const bank = resultRows(page).and(page.locator(`[data-workspace="${SEED_IDS.wsBankX}"]`)).first();
  if (await bank.count()) await expect(bank.getByTestId("text-result-marks")).toContainText("Archived");

  await scopeSelect(page).selectOption(RETAIL);
  await expect(page).toHaveURL(new RegExp(`[?&]scope=${RETAIL}`));
  await expect(page.getByRole("columnheader", { name: "Workspace" })).toHaveCount(0);
  await expect(resultRows(page).first().getByTestId("text-result-workspace")).toHaveCount(0);
  expect(new Set(await resultRows(page).evaluateAll((rows) => rows.map((r) => r.getAttribute("data-workspace"))))).toEqual(new Set([RETAIL]));
  await page.reload();
  await expect(scopeSelect(page)).toHaveValue(RETAIL);
});

test("S39-03: marks: Personal data and a status; the empty field offers examples and Browse all", async ({ page }) => {
  await page.goto(catalogUrl());
  const empty = page.getByTestId("box-catalog-empty");
  await expect(empty).toContainText("What are you looking for?");
  await expect(page.getByTestId("button-catalog-example")).toHaveText(["customer", "personal data", "cust_no", "email", "REQ-102", "order status"]);
  await page.getByTestId("button-catalog-browse").and(page.locator('[data-kind="mappings"]')).click();
  await expect(kindTab(page, "mappings")).toHaveAttribute("aria-selected", "true");
  await expect(resultRows(page).first()).toBeVisible();
  await expect(resultRows(page).first().getByTestId("text-result-marks")).toHaveText(/Approved|In review|Draft/);

  await kindTab(page, "mappings").click();
  await page.getByTestId("button-catalog-example").filter({ hasText: "personal data" }).click();
  await expect(searchField(page)).toHaveValue("personal data");
  await expect(resultRows(page).first()).toBeVisible();
  await expect(page.getByTestId("text-result-marks").filter({ hasText: "Personal data" }).first()).toBeVisible();
});

test("S39-03: the first 200 results, then how many more", async ({ page }) => {
  await addPerformanceTest();
  await page.goto(catalogUrl({ q: "a" }));
  await expect(resultRows(page)).toHaveCount(200);
  const all = Number((await kindTab(page, "all").textContent())!.replace(/\D/g, ""));
  expect(all).toBeGreaterThan(200);
  await expect(page.getByTestId("text-catalog-more")).toHaveText(`${(all - 200).toLocaleString("en")} more: narrow the search`);
  await expect(page.getByRole("columnheader", { name: "Workspace" })).toBeVisible();
});
