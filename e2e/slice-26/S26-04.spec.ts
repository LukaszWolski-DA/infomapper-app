// S26-04 (slice 26, PRD section 2, D3, D4, D5): on the demo (the star, InfoCube on), the Model overview, Model readiness
// and Conventions and notation, each with its content in scope; readiness lists the model checks (D-75) and the
// definition's checks; the conventions name the workspace's stereotypes and classifications as the workspace calls them.

import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, laidOut, RETAIL, sectionsText, setSections, signInAs, storedDocument, viewUrl } from "./helpers";

test.use({ seed: "full" });

const SHARED = DEMO_DOCUMENT_NAMES.shared;

test("S26-04: the overview, readiness and conventions on the demo, each with its content in scope", async ({ page }) => {
  await changeDb((db) => {
    // a weak definition, a renamed stereotype and an own name for a classification, as the workspace's
    const customer = db.entity.find((e) => e.workspace_id === RETAIL && e.name === "Customer")!;
    db.attribute.find((a) => a.entity_id === customer.id && a.name === "email")!.definition_text = "E-mail.";
    db.stereotype.find((s) => s.workspace_id === RETAIL && s.code === "object")!.name = "Business object";
    db.classification.find((c) => c.workspace_id === RETAIL && c.code === "BK")!.name = "Natural key";
  });
  await setSections(SHARED, [{ type: "overview" }, { type: "ready" }, { type: "conv" }]);
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl((await storedDocument(SHARED))!.id));
  await laidOut(page);
  const t = await sectionsText(page, ["Model overview", "Model readiness", "Conventions and notation"]);

  // the overview: the description, the counts, the concepts with their entities (dimensional ones too: in scope)
  for (const part of ["Enterprise data warehouse for Retail Co", "Model contents", "Entities", "Source tables", "Mappings", "approved", "Requirements", "Customer Address", "Fact Sales"]) {
    expect(t["Model overview"], part).toContain(part);
  }
  // readiness: the definition's checks (the weak one, D5), the fed rule, the mappings, the requirements, the model checks
  const ready = t["Model readiness"]!;
  for (const part of [
    "Checks of the model state this document describes.",
    "Entities without a definition",
    "Definitions that repeat the name or have fewer than four words",
    "Customer.email",
    "Attributes with no mapping or feed",
    "Mappings with a type problem",
    "Mappings not approved yet",
    "Requirements not fully covered",
    "Model checks: InfoMapper's validator (D-75), as the project home shows it.",
    "Keys copied the wrong way",
    "Duplicate attribute names",
  ]) {
    expect(ready, part).toContain(part);
  }
  await expect(page.locator('[data-testid="document-host"] table.dt.ready').first()).toBeVisible();
  // the conventions: the notation's four ends, the statuses, the marks, the workspace's names
  const conv = t["Conventions and notation"]!;
  for (const part of ["Exactly one", "Zero or more", "Draft", "Agreed; counts towards requirement coverage.", "Business key in the source", "Business object", "Natural key", "Personal data", "Physical type"]) {
    expect(conv, part).toContain(part);
  }
  expect(conv).not.toContain("Object ");
  await expect(page.locator('[data-testid="document-host"] table.dt.conv svg').first()).toBeVisible();
});

test("S26-04: the overview's counts follow the scope", async ({ page }) => {
  await setSections(SHARED, [{ type: "overview", options: { concepts: false } }]);
  await changeDb((db) => {
    const concept = db.concept.find((c) => c.workspace_id === RETAIL && c.name === "Reference data")!;
    (db as unknown as { document_definition: { name: string; scope: { concepts: string[] } }[] }).document_definition.find((x) => x.name === SHARED)!.scope.concepts = [concept.id];
  });
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl((await storedDocument(SHARED))!.id));
  await laidOut(page);
  const rows = await page.locator('[data-testid="document-host"] table.dt.narrow tbody tr').allTextContents();
  // Reference data: Country and Dim Date
  expect(rows[0]).toBe("Entities2");
});
