// S27-04 (slice 27, PRD section 6): the sections with figures. Diagrams, made with one whole canvas per canvas of the
// document's scope in tab order (D9), each canvas's name before its figures, the legend under them in the section's
// notation, a figure unticked left out; a Figure section placed between two others, on the same page as the one before
// it (F7); Model overview's figures right after the description or below its content (D5).

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import {
  canvasId,
  changeDb,
  DEMO_DOCUMENT_NAMES,
  expectLayouts,
  figureImages,
  formUrl,
  layouts,
  newFigure,
  openEditor,
  pageFigures,
  RETAIL,
  setSections,
  signInAs,
  storedDocument,
  svgOf,
} from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;
const host = (page: Page) => page.getByTestId("document-host");
/** The scope's canvases (every live project's), the projects in the order they were made, each in its tab order. */
async function scopeCanvases(): Promise<string[]> {
  const db = await readDb(E2E_DB);
  const live = new Set(db.canvas.filter((c) => c.deleted_at === null).map((c) => c.id));
  const out: string[] = [];
  for (const p of db.project.filter((x) => x.workspace_id === RETAIL && x.deleted_at === null).sort((a, b) => a.created_at.localeCompare(b.created_at)))
    for (const l of db.project_canvas.filter((x) => x.project_id === p.id && live.has(x.canvas_id)).sort((a, b) => a.sort_order - b.sort_order || a.added_at.localeCompare(b.added_at)))
      if (!out.includes(l.canvas_id)) out.push(l.canvas_id);
  return out;
}
const canvasName = async (id: string) => (await readDb(E2E_DB)).canvas.find((c) => c.id === id)!.name;

test("S27-04: Diagrams is made with the scope's canvases; their names, the legend, the notation; a figure unticked is left out", async ({ page }) => {
  await setSections(DOC, [{ type: "text", options: { body: "Before the diagrams." } }]);
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl(id));
  await page.getByTestId("select-preview-mode").selectOption("exact");
  const n = await layouts(page);
  await page.getByTestId("button-add-section").click();
  await page.locator('[data-testid="button-add-section-type"][data-type="diagrams"]').click();
  await expectLayouts(page, n + 1);

  // made with one whole canvas, as on the canvas, per canvas of the scope, in tab order (D9)
  const canvases = await scopeCanvases();
  expect(canvases.length).toBeGreaterThan(1);
  const section = (await storedDocument(DOC))!.sections.find((s) => s.type === "diagrams")!;
  const figures = section.options.figures as { canvasId: string; frameId: string | null; view: string; size: string; on: boolean }[];
  expect(figures.map((f) => f.canvasId)).toEqual(canvases);
  expect(figures.every((f) => f.frameId === null && f.view === "canvas" && f.size === "auto" && f.on)).toBe(true);
  await expect(page.getByTestId("figure-entry")).toHaveCount(canvases.length);

  // in the pages: each canvas's name as a subsection before its figure, the figures numbered, the legend under them
  await expect(pageFigures(page)).toHaveCount(canvases.length);
  const names = await Promise.all(canvases.map(canvasName));
  await expect(host(page).locator("h3.dh3")).toHaveText(names.map((x, i) => new RegExp(`^2\\.${i + 1}\\s*${x.replace(/[&]/g, "\\$&")}$`)));
  expect((await figureImages(page)).map((i) => i.caption)).toEqual(names.map((x, i) => `Figure ${i + 1}. ${x}`));
  const legend = host(page).getByTestId("figure-legend");
  await expect(legend).toHaveCount(1);
  await expect(legend).toContainText("Legend");
  await expect(legend).toContainText("Relationship (crow's foot: many; bar: one; circle: optional)");
  await expect(legend).toContainText("Foreign key between source tables");
  // InfoCube is off in this seed: no dimensional mapping in the legend
  await expect(legend).not.toContainText("Dimensional mapping");

  // the section's own notation: UML in its figures and in its legend
  const k = await layouts(page);
  await page.getByTestId("seg-diagrams-notation").getByRole("button", { name: "UML" }).click();
  await expectLayouts(page, k + 1);
  await expect(legend).toContainText("Relationship (UML multiplicities)");
  expect(await svgOf(page, (await figureImages(page))[0]!.src)).toContain('class="mult"');

  // the legend off, and the first figure unticked: it leaves the document, the next one is Figure 1
  const m = await layouts(page);
  await page.getByTestId("check-diagrams-legend").uncheck();
  await expectLayouts(page, m + 1);
  await expect(host(page).getByTestId("figure-legend")).toHaveCount(0);
  const j = await layouts(page);
  await page.getByTestId("check-figure-on").first().uncheck();
  await expectLayouts(page, j + 1);
  await expect(pageFigures(page)).toHaveCount(canvases.length - 1);
  expect((await figureImages(page))[0]!.caption).toBe(`Figure 1. ${names[1]}`);
  await expect(page.getByTestId("figure-entry").first()).toContainText("Not in the document.");
});

test("S27-04: a Figure section between two others starts on the same page; Model overview's figures go where chosen", async ({ page }) => {
  const canvas = await canvasId("Customer & orders");
  await setSections(DOC, [
    { type: "text", heading: "Before", options: { body: "A short introduction." } },
    { type: "figure", options: { figures: [{ ...newFigure("f1", canvas), size: "page" }] } },
    { type: "text", heading: "After", options: { body: "The next part." } },
    { type: "overview", options: { figures: [{ ...newFigure("f2", canvas), caption: "The logical model" }], figuresAt: "start" } },
  ]);
  // the Figure section as "+ Add section" makes it: on the same page (F7)
  await changeDb((db) => {
    const doc = (db as unknown as { document_definition: { name: string; sections: { type: string; newPage: boolean }[] }[] }).document_definition.find((d) => d.name === DOC)!;
    doc.sections.find((s) => s.type === "figure")!.newPage = false;
  });
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl(id));
  await page.getByTestId("select-preview-mode").selectOption("exact");
  await expect(pageFigures(page)).toHaveCount(2);

  // the Figure section follows "Before" on its page; "After" starts a new page after it
  const pageOf = (heading: string) =>
    page.evaluate((h) => {
      const pages = [...document.querySelectorAll('[data-testid="document-host"] .pagedjs_page')];
      return pages.findIndex((p) => [...p.querySelectorAll("h2")].some((x) => x.textContent!.replace(/^\d+\s*/, "") === h));
    }, heading);
  const before = await pageOf("Before");
  expect(await pageOf("Figures")).toBe(before);
  expect(await pageOf("After")).toBeGreaterThan(before);
  // its figure in the document's order: Figure 1, then the overview's Figure 2
  expect((await figureImages(page)).map((i) => i.caption)).toEqual(["Figure 1. Customer & orders", "Figure 2. The logical model"]);

  // Model overview: right after the description, before the counts; then below the section's content
  const order = () =>
    page.evaluate(() => {
      const sec = [...document.querySelectorAll('[data-testid="document-host"] [data-section="overview"]')];
      const all = sec.flatMap((s) => [...s.querySelectorAll("figure, table, ul, ol")]);
      return all.map((x) => x.tagName.toLowerCase());
    });
  expect((await order())[0]).toBe("figure");
  await page.locator('[data-testid="editor-section"][data-section="overview"]').click();
  const n = await layouts(page);
  await page.getByTestId("seg-overview-figuresAt").getByRole("button", { name: "Below the section's content" }).click();
  await expectLayouts(page, n + 1);
  expect((await order()).at(-1)).toBe("figure");
  expect((await order())[0]).not.toBe("figure");
});
