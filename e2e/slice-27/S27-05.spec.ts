// S27-05 (slice 27, PRD section 6; Q5): the star diagram in the Dimensional model, drawn from InfoCube's index through
// the document sections' extension point: one per fact while InfoCube is on and the dimensional level is in scope, after
// the fact's type and grain, with its dimensions in scope around it; beyond "Dimensions drawn per star, at most" its
// caption says how many are shown and the fact's table lists them all; none while InfoCube is off.

import { uuidv7 } from "../../src/domain/ids";
import { expect, test, type Page } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, figureImages, formUrl, laidOut, openEditor, pageFigures, RETAIL, setSections, setWorkspace, signInAs, storedDocument, svgOf, viewUrl } from "./helpers";

test.use({ seed: "full" });

const DOC = DEMO_DOCUMENT_NAMES.shared;
const host = (page: Page) => page.getByTestId("document-host");

/** Test data: `n` more dimensions on Fact Sales, each a copy of Dim Customer with its key and relationship. */
async function moreDimensions(n: number) {
  await changeDb((db) => {
    const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => r.deleted_at === null);
    const dim = live(db.entity).find((e) => e.name === "Dim Customer" && e.workspace_id === RETAIL)!;
    const fact = live(db.entity).find((e) => e.name === "Fact Sales" && e.workspace_id === RETAIL)!;
    const rel = live(db.relationship).find((r) => (r.from_entity_id === dim.id && r.to_entity_id === fact.id) || (r.to_entity_id === dim.id && r.from_entity_id === fact.id))!;
    const cube = (db as unknown as { cube_entity: { entity_id: string; deleted_at: string | null; id: string }[] }).cube_entity;
    const cubeRow = cube.find((c) => c.entity_id === dim.id && c.deleted_at === null)!;
    for (let i = 1; i <= n; i++) {
      const id = uuidv7();
      db.entity.push({ ...dim, id, name: `Dim Extra ${i}`, alias: null });
      for (const a of live(db.attribute).filter((x) => x.entity_id === dim.id)) db.attribute.push({ ...a, id: uuidv7(), entity_id: id, alias: null, copied_from_attribute_id: null });
      cube.push({ ...cubeRow, id: uuidv7(), entity_id: id });
      db.relationship.push({ ...rel, id: uuidv7(), ...(rel.from_entity_id === dim.id ? { from_entity_id: id } : { to_entity_id: id }) });
    }
  });
}

test("S27-05: one star per fact after its type and grain, its dimensions around it; the limit and its note", async ({ page }) => {
  await setSections(DOC, [{ type: "cube.dim" }]);
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl(id));
  await laidOut(page);
  const captions = (await figureImages(page)).map((i) => i.caption);
  expect(captions).toEqual(["Figure 1. Star schema of Fact Orders", "Figure 2. Star schema of Fact Sales"]);
  // the star of Fact Sales: the fact and its three dimensions (Dim Date once, for both its roles), its role pills
  const svg = await svgOf(page, (await figureImages(page))[1]!.src);
  for (const name of ["Fact Sales", "Dim Customer", "Dim Product", "Dim Date"]) expect(svg, name).toContain(`>${name}</text>`);
  expect(svg.split(">Dim Date</text>").length - 1).toBe(1);
  expect(svg).toContain(">Order date</text>");
  // after the fact's type and grain, before its dimensions
  const order = await host(page).evaluate((root) => {
    const all = [...root.querySelectorAll("h4, h5, table, figure")];
    const at = all.findIndex((x) => x.tagName === "H4" && x.textContent === "Fact Sales");
    return all.slice(at, at + 4).map((x) => (x.tagName === "FIGURE" ? "figure" : x.tagName === "TABLE" ? "table" : x.textContent));
  });
  expect(order).toEqual(["Fact Sales", "table", "figure", "Dimensions"]);

  // ten dimensions, at most six drawn: the note in the caption, every one in the fact's table
  await moreDimensions(7);
  await setSections(DOC, [{ type: "cube.dim", options: { starMax: 6 } }]);
  await page.reload();
  await laidOut(page);
  const capped = (await figureImages(page)).find((i) => i.caption.includes("Fact Sales"))!;
  expect(capped.caption).toBe("Figure 2. Star schema of Fact Sales (6 of 10 dimensions shown; all are in the table below)");
  const drawn = await svgOf(page, capped.src);
  expect((drawn.match(/>Dim (Customer|Product|Date|Extra \d)<\/text>/g) ?? []).length).toBe(6);
  for (let i = 1; i <= 7; i++) await expect(host(page)).toContainText(`Dim Extra ${i}`);

  // the editor's line per fact under the section's options
  await openEditor(page, formUrl(id));
  await page.locator('[data-testid="editor-section"][data-section="cube.dim"]').click();
  await expect(page.getByTestId("text-placed-figure")).toHaveText([/^Fact Orders: 1 figure · names [\d.]+ pt/, /^Fact Sales: 1 figure · names [\d.]+ pt/]);
  // "Star diagram" off: no star
  const n = Number(await page.getByTestId("document-pages").getAttribute("data-layouts"));
  await page.getByTestId("check-cube.dim-star").uncheck();
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-layouts", String(n + 1));
  await expect(pageFigures(page)).toHaveCount(0);
});

test("S27-05: no star while InfoCube is off, nor while the dimensional level is out of scope", async ({ page }) => {
  await setSections(DOC, [{ type: "text", options: { body: "Intro." } }, { type: "cube.dim" }]);
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl(id));
  await laidOut(page);
  await expect(pageFigures(page)).toHaveCount(2);
  // the dimensional level out of the scope
  await changeDb((db) => {
    const doc = (db as unknown as { document_definition: { name: string; scope: { dimensional: boolean } }[] }).document_definition.find((d) => d.name === DOC)!;
    doc.scope.dimensional = false;
  });
  await page.reload();
  await laidOut(page);
  await expect(pageFigures(page)).toHaveCount(0);
  // InfoCube off: the section is skipped and named in a note
  await changeDb((db) => {
    const doc = (db as unknown as { document_definition: { name: string; scope: { dimensional: boolean } }[] }).document_definition.find((d) => d.name === DOC)!;
    doc.scope.dimensional = true;
  });
  await setWorkspace(RETAIL, { infocube: false });
  await page.reload();
  await laidOut(page);
  await expect(pageFigures(page)).toHaveCount(0);
  await expect(page.getByTestId("document-host").getByTestId("document-skipped")).toHaveText("Skipped while InfoCube is off: Dimensional model.");
});
