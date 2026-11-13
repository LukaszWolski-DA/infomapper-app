// S26-05 (slice 26, PRD section 2, D3, F13): Source tables print their classifications, notes, the columns that left the
// source and the Data Vault reading when the workspace is in Data Vault 2.0 mode (in the document's language); the
// Classification register prints each chosen classification's uses and the logical attributes with personal data.

import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, laidOut, RETAIL, sectionText, setSections, setWorkspace, signInAs, storedDocument, viewUrl } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;

async function open(page: import("@playwright/test").Page) {
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl((await storedDocument(SHARED))!.id));
  await laidOut(page);
}

test("S26-05: source tables with classifications, notes, columns that left the source and the Data Vault reading", async ({ page }) => {
  await changeDb((db) => {
    const customers = db.source_table.find((t) => t.workspace_id === RETAIL && t.name === "customers")!;
    customers.note_text = "One row per CRM customer.";
    const fname = db.source_column.find((c) => c.source_table_id === customers.id && c.name === "fname")!;
    fname.missing_since = "2026-11-01T00:00:00.000Z";
    db.source_column.find((c) => c.source_table_id === customers.id && c.name === "lname")!.note_text = "As the customer typed it.";
  });
  await setSections(SHARED, [{ type: "sources" }]);
  await open(page);
  let text = await sectionText(page, "Source tables");
  for (const part of ["customers", "CRM / crmprod.dbo", "One row per CRM customer.", "Business key", "Personal data", "Customer.customer_number", "missing from the source", "As the customer typed it."]) {
    expect(text, part).toContain(part);
  }
  // no Data Vault reading outside Data Vault 2.0 mode
  expect(text).not.toContain("Data Vault reading");

  await setWorkspace(RETAIL, { dv2_mode: true } as never);
  await open(page);
  text = await sectionText(page, "Source tables");
  for (const part of ["Data Vault reading", "Hub on cust_no", "Link to customers via cust_id", "Hints from the classifications and the source's keys; nothing is created."]) {
    expect(text, part).toContain(part);
  }

  // in the document's language (D3): German
  await changeDb((db) => {
    const doc = (db as unknown as { document_definition: { name: string; style: { language: string | null } }[] }).document_definition.find((d) => d.name === SHARED)!;
    doc.style.language = "de";
  });
  await open(page);
  text = await sectionText(page, "Quelltabellen");
  for (const part of ["Data-Vault-Lesart", "Hub auf cust_no", "Link zu customers über cust_id", "fehlt in der Quelle"]) expect(text, part).toContain(part);
});

test("S26-05: the classification register: each chosen classification's columns and their use, the attributes with personal data", async ({ page }) => {
  await setSections(SHARED, [{ type: "classreg", options: { classifications: ["PII", "BK"] } }]);
  await open(page);
  const text = await sectionText(page, "Classification register");
  for (const part of ["Personal data", "The column holds personal data", "customers.email_addr", "Customer.email", "Logical attributes marked personal data", "Business key", "customers.cust_no"]) {
    expect(text, part).toContain(part);
  }
  const headings = await page.locator('[data-testid="document-host"] h3.dh3').allTextContents();
  // in the workspace's list order, whatever the order they were chosen in; numbered (the style's default)
  expect(headings).toEqual(["1.1Business key", "1.2Personal data"]);
});
