// S25-04 (slice 25, PRD section 2, Q-L3, D-79): the data dictionary on the demo: logical entities grouped by concept, the
// chosen columns, the definition under the row, the coverage line by the app's rule whatever the mapping filter; a renamed
// stereotype prints with its new name; the scope by project and by concept narrows it. Every text from the model is
// escaped: a definition holding markup prints as text and runs nothing.

import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, laidOut, RETAIL, SEED_IDS, signInAs, storedDocument, updateDocumentAs, viewUrl } from "./helpers";

const MARKUP = `<img src=x onerror="window.__imXss=1"><b>bold</b> where we write to the customer`;

/** The dictionary's concept and entity headings on the laid-out pages, in order. */
const headings = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-testid="document-host"]')!;
    return {
      concepts: [...host.querySelectorAll("h3.dh3")].map((h) => h.textContent),
      entities: [...host.querySelectorAll("h4")].map((h) => h.textContent),
    };
  });

/** The meta line above an entity's table. */
const metaOf = (page: Page, entity: string) =>
  page.evaluate((name) => {
    const h = [...document.querySelectorAll('[data-testid="document-host"] h4')].find((x) => x.textContent === name);
    let el = h?.nextElementSibling;
    while (el && !el.classList.contains("dmeta")) el = el.nextElementSibling;
    return el?.textContent ?? null;
  }, entity);

async function openDictionary(page: Page) {
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
}

/** Customer's attributes with a live mapping of any status (the app's rule; the plain seed has no calculation). */
async function customerCoverage(): Promise<string> {
  const db = await readDb(E2E_DB);
  const customer = db.entity.find((e) => e.workspace_id === RETAIL && e.name === "Customer" && e.deleted_at === null)!;
  const attributes = db.attribute.filter((a) => a.entity_id === customer.id && a.deleted_at === null);
  const mapped = attributes.filter((a) => db.mapping.some((m) => m.attribute_id === a.id && m.deleted_at === null));
  return `${mapped.length} of ${attributes.length} attributes mapped`;
}

test("S25-04: logical entities by concept, the chosen columns, the definition under the row, a renamed stereotype, markup as text", async ({ page }) => {
  const db = await readDb(E2E_DB);
  const customer = db.entity.find((e) => e.workspace_id === RETAIL && e.name === "Customer")!;
  db.attribute.find((a) => a.entity_id === customer.id && a.name === "email")!.definition_text = MARKUP;
  db.stereotype.find((s) => s.workspace_id === RETAIL && s.code === "object")!.name = "Business object";
  await writeDb(E2E_DB, db);
  await updateDocumentAs(SEED_IDS.userLukasz, DEMO_DOCUMENT_NAMES.shared, { section: { id: (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!.sections[1]!.id, options: { entity: ["stereotype", "definition", "coverage"] } } });

  await signInAs(page, "Łukasz");
  await openDictionary(page);
  const { concepts, entities } = await headings(page);
  expect(concepts).toEqual(["Customer", "Sales", "Product", "Reference data"]);
  expect(entities.slice(0, 2)).toEqual(["Customer", "Customer Address"]);
  expect(entities.some((e) => e?.startsWith("Fact ") || e?.startsWith("Dim "))).toBe(false);
  expect(await metaOf(page, "Customer")).toBe(`Business object · ${await customerCoverage()}`);

  const host = page.getByTestId("document-host");
  const table = host.locator("table.dt").first();
  await expect(table.locator("thead th")).toHaveText(["Attribute", "Type", "Personal data"]);
  // the definition is under its row, as text: the markup is printed, nothing of it is an element or runs
  const below = host.locator("tr.ddr td").filter({ hasText: "where we write to the customer" });
  await expect(below).toHaveText(MARKUP);
  await expect(host.locator("img")).toHaveCount(0);
  await expect(host.locator("tr.ddr b")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __imXss?: number }).__imXss)).toBeUndefined();
});

test("S25-04: the coverage line counts by the app's rule whatever the mapping filter (Q-L3)", async ({ page }) => {
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await updateDocumentAs(SEED_IDS.userLukasz, DEMO_DOCUMENT_NAMES.shared, { section: { id: doc.sections[1]!.id, options: { entity: ["coverage"], columns: ["attribute", "mappedFrom"] } } });
  await signInAs(page, "Łukasz");
  const expected = await customerCoverage();
  // Approved only: drafts and reviews are hidden in the rows, the line counts them
  await openDictionary(page);
  expect(await metaOf(page, "Customer")).toBe(expected);
  const host = page.getByTestId("document-host");
  await expect(host.locator(".dst")).toHaveCount(0);
  await updateDocumentAs(SEED_IDS.userLukasz, DEMO_DOCUMENT_NAMES.shared, { scope: { mappings: "all" } });
  await openDictionary(page);
  expect(await metaOf(page, "Customer")).toBe(expected);
  await expect(host.locator(".dst.draft").first()).toBeVisible();
});

test("S25-04: the scope by project and by concept narrows the dictionary", async ({ page }) => {
  await updateDocumentAs(SEED_IDS.userLukasz, DEMO_DOCUMENT_NAMES.shared, { scope: { projects: [SEED_IDS.projCustomer360] } });
  await signInAs(page, "Łukasz");
  await openDictionary(page);
  expect((await headings(page)).entities).toEqual(["Customer", "Order Line", "Sales Order"]);

  const db = await readDb(E2E_DB);
  const sales = db.concept.find((c) => c.workspace_id === RETAIL && c.name === "Sales")!;
  await updateDocumentAs(SEED_IDS.userLukasz, DEMO_DOCUMENT_NAMES.shared, { scope: { projects: [], concepts: [sales.id] } });
  await openDictionary(page);
  const { concepts, entities } = await headings(page);
  expect(concepts).toEqual(["Sales"]);
  expect(entities).toEqual(["Order Line", "Sales Order"]);
});
