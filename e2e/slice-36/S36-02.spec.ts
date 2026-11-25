// S36-02 (slice 36, criterion 2): "+ Add section" offers "Changes since a baseline" in every document. "Compared with" is
// "Previous baseline: {name} ({time})" by default, or any baseline; the older state is the start. The heading names it
// in the document's language; Added, Changed and Removed as tables of Kind, Item and What changed by slice 35's rule (a
// rename is one change, on the renamed row); only the document's scope; "No changes." and "Nothing to compare with yet.";
// the same section in Markdown. The comparison is asked for again after each saved change it depends on.
import { test, expect } from "./fixtures";
import {
  exactPages,
  changeDb,
  changeDocument,
  changesRows,
  changesSection,
  chosenText,
  DEMO_BASELINE,
  documentFromBaseline,
  formUrl,
  liveEntity,
  minute,
  openMarkdown,
  preview,
  sectionText,
  signInAs,
  STAGE_1,
  storedDocument,
  takeBaseline,
} from "./helpers";
import { DEMO_DOCUMENT_NAMES } from "../slice-25/helpers";

test.use({ seed: "full" });

const HEADING = `Changes since “${STAGE_1}”`;
const SHARED = DEMO_DOCUMENT_NAMES.shared;

/** Opens a document's editor with real pages after every change. */
async function openExact(page: import("@playwright/test").Page, id: string) {
  await page.goto(formUrl(id));
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  await exactPages(page);
}

test("S36-02: added from + Add section, the previous baseline, its heading and tables, in Markdown too", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openExact(page, doc.id);
  await page.getByTestId("button-add-section").click();
  const type = page.locator('[data-testid="button-add-section-type"][data-type="changes"]');
  await expect(type).toContainText("Changes since a baseline");
  await expect(type).toContainText("What was added, changed and removed since a baseline you choose.");
  await type.click();

  // its options: the previous baseline first, then each baseline
  const against = page.getByTestId("select-changes-against");
  await expect(against).toBeVisible();
  await expect.poll(() => chosenText(against)).toBe(`Previous baseline: ${STAGE_1} (${minute(DEMO_BASELINE.at)})`);
  await expect(page.getByText("Compares that baseline with the document's own model state; the older one is always the starting point.")).toBeVisible();

  // slice 35's comparison of "Stage 1 sign-off" with Now (S35-04), asked for after the section's save
  await expect.poll(() => changesRows(page, HEADING), { timeout: 30_000 }).toEqual([
    "Attribute | Customer.segment_code |",
    expect.stringMatching(/^Requirement \| REQ-105 .+ \|$/),
    "Mapping | customers.cust_no → Customer.customer_number | status: Draft → Approved",
    "Source column | CRM · customers.cust_no | type: varchar(10) → varchar(20)",
  ]);
  const text = await sectionText(page, HEADING);
  expect(text).toContain("Added (2)");
  expect(text).toContain("Changed (2)");
  expect(text).not.toContain("Removed");
  expect(text).toContain("Kind");
  expect(text).toContain("What changed");

  // Markdown shows the same section
  const md = await openMarkdown(page);
  expect(md).toContain(`## ${HEADING}`);
  expect(md).toContain("| Kind | Item | What changed |");
  expect(md).toContain("customers.cust_no → Customer.customer_number");
});

test("S36-02: a rename of an entity with mappings is one change, on the entity", async ({ page }) => {
  const doc = (await storedDocument(SHARED))!;
  await changeDocument(doc.id, (d) => {
    d.sections = [changesSection()];
  });
  await changeDb((db) => {
    liveEntity(db, "Customer").name = "Client";
  });
  await signInAs(page, "Łukasz");
  await openExact(page, doc.id);
  await expect.poll(() => changesRows(page, HEADING), { timeout: 30_000 }).toEqual([
    "Attribute | Client.segment_code |",
    expect.stringMatching(/^Requirement \| REQ-105 .+ \|$/),
    "Entity | Client | name: Customer → Client",
    "Mapping | customers.cust_no → Client.customer_number | status: Draft → Approved",
    "Source column | CRM · customers.cust_no | type: varchar(10) → varchar(20)",
  ]);
  expect(await sectionText(page, HEADING)).toContain("Changed (3)");
});

test("S36-02: a long list, scrolled to its end in the preview", async ({ page }) => {
  const doc = (await storedDocument(SHARED))!;
  await changeDocument(doc.id, (d) => {
    d.sections = [changesSection()];
  });
  // every live logical attribute's definition changed: one row each, "definition (changed)"
  let changed = 0;
  await changeDb((db) => {
    const ws = liveEntity(db, "Customer").workspace_id;
    const logical = new Set(db.entity.filter((e) => e.workspace_id === ws && e.model_level === "logical" && e.deleted_at === null).map((e) => e.id));
    for (const a of db.attribute) {
      if (a.deleted_at !== null || !logical.has(a.entity_id)) continue;
      a.definition_html = `<p>Changed for S36-02 (${changed}).</p>`;
      a.definition_text = `Changed for S36-02 (${changed}).`;
      changed += 1;
    }
    // and every live source column's comment: about seventy rows in all
    for (const c of db.source_column) {
      if (c.deleted_at !== null || c.workspace_id !== liveEntity(db, "Customer").workspace_id) continue;
      c.comment = `Changed for S36-02 (${changed}).`;
      changed += 1;
    }
  });
  expect(changed).toBeGreaterThan(50);
  await signInAs(page, "Łukasz");
  await openExact(page, doc.id);
  await expect.poll(async () => (await changesRows(page, HEADING)).length, { timeout: 30_000 }).toBeGreaterThan(changed);
  const rows = await changesRows(page, HEADING);
  expect(rows.filter((r) => r.endsWith("| definition (changed)") || r.endsWith("| comment (changed)")).length).toBeGreaterThanOrEqual(changed - 2);
  // the preview scrolled to its end: the section's last row is on the screen
  // the preview scrolled down to the list's end: its last row is on the screen, below where the list began
  const last = page.locator('[data-testid="document-host"] .pagedjs_page tbody tr').last();
  await last.evaluate((tr) => tr.scrollIntoView({ block: "end" }));
  await expect(last).toBeInViewport();
  expect(await preview(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
  await expect(last).toContainText(rows.at(-1)!.split(" | ")[1]!);
});

test("S36-02: a chosen baseline, the document's language, its scope, and nothing older", async ({ page }) => {
  // a baseline taken after a change: compared with it, only what came after shows
  await changeDb((db) => {
    liveEntity(db, "Product").name = "Article";
  });
  const second = await takeBaseline("Stage 2 sign-off");
  await changeDb((db) => {
    liveEntity(db, "Article").name = "Item";
  });
  const doc = (await storedDocument(SHARED))!;
  await changeDocument(doc.id, (d) => {
    d.sections = [changesSection()];
    d.style.language = "pl";
  });
  await signInAs(page, "Łukasz");
  await openExact(page, doc.id);
  // the previous baseline of the live model is now Stage 2, in Polish
  await expect.poll(() => changesRows(page, "Zmiany od “Stage 2 sign-off”"), { timeout: 30_000 }).toEqual(["Encja | Item | nazwa: Article → Item"]);

  // Stage 1 chosen: the older state is the start, every change since it
  await page.locator('[data-testid="editor-section"][data-section="changes"]').click();
  await page.getByTestId("select-changes-against").selectOption(DEMO_BASELINE.id);
  await expect.poll(() => changesRows(page, `Zmiany od “${STAGE_1}”`), { timeout: 30_000 }).toContain("Encja | Item | nazwa: Product → Item");

  // only the document's scope: a concept without Customer leaves its changes out
  await changeDb((db) => {
    const customer = liveEntity(db, "Customer");
    const other = db.concept.find((c) => c.workspace_id === customer.workspace_id && c.id !== customer.concept_id && c.deleted_at === null)!;
    const d = (db as unknown as { document_definition: { id: string; scope: { concepts: string[] }; version: number }[] }).document_definition.find((x) => x.id === doc.id)!;
    d.scope.concepts = [other.id];
    d.version += 1;
  });
  await page.reload();
  await exactPages(page);
  const scoped = (await changesRows(page, `Zmiany od “${STAGE_1}”`)).join("\n");
  expect(scoped).not.toContain("Customer");
  expect(scoped).not.toContain("cust_no");

  // a document from the oldest baseline has nothing older; the same baseline chosen has no changes
  const fromStage1 = await documentFromBaseline(DEMO_BASELINE.id);
  await changeDocument(fromStage1, (d) => {
    d.sections = [changesSection(), { ...changesSection(DEMO_BASELINE.id), heading: "Against itself" }];
  });
  await openExact(page, fromStage1);
  expect(await sectionText(page, "Changes since …")).toContain("Nothing to compare with yet.");
  expect(await sectionText(page, "Against itself")).toContain("No changes.");
  expect(second).toBeTruthy();
});
