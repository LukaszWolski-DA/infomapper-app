// S27-03 (slice 27, PRD section 6): no working layer on a figure (C4: no notes, no labels' marks, no selection or
// highlights); objects outside the document's scope are left out (D3, Łukasz's answer: as the prototype, no muted look),
// and a figure with nothing left says so.

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { canvasId, DEMO_DOCUMENT_NAMES, figureImages, figuresOnly, formUrl, newFigure, openEditor, pageFigures, SEED_IDS, signInAs, storedDocument, svgOf, updateDocumentAs } from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;
const CANVAS = "Customer & orders";
/** The words the SVG's text nodes hold. */
const texts = (svg: string) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]!).join("\n");

test("S27-03: a figure draws no notes, label marks or selection; what is out of scope is left out", async ({ page }) => {
  const canvas = await canvasId(CANVAS);
  const db = await readDb(E2E_DB);
  // the canvas's working layer in the demo: its notes and the labels on its cards
  const notes = db.note.filter((n) => n.canvas_id === canvas && n.deleted_at === null);
  expect(notes.length).toBeGreaterThan(0);
  const items = db.canvas_item.filter((i) => i.canvas_id === canvas && i.deleted_at === null);
  const labelled = db.label_link.filter((l) => l.deleted_at === null && items.some((i) => (i.entity_id && i.entity_id === l.entity_id) || (i.source_table_id && i.source_table_id === l.source_table_id)));
  expect(labelled.length).toBeGreaterThan(0);
  const labels = db.label.filter((l) => labelled.some((x) => x.label_id === l.id));

  await figuresOnly(DOC, [newFigure("f1", canvas)]);
  const id = (await storedDocument(DOC))!.id;
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl(id));
  await expect(pageFigures(page)).toHaveCount(1);
  const svg = await svgOf(page, (await figureImages(page))[0]!.src);
  const words = texts(svg);
  // no note's text, no label's name, no selection or highlight, no HTML inside the SVG
  for (const n of notes) for (const line of (n.body_text ?? "").split("\n").filter((l) => l.trim().length > 8)) expect(words, line).not.toContain(line.trim().slice(0, 24));
  for (const l of labels) expect(words, l.name).not.toContain(l.name);
  expect(svg).not.toMatch(/foreignObject|class="[^"]*\b(sel|selected|lit|hover|lmark)\b/);
  expect(words).toContain("Customer");
  expect(words).toContain("Sales Order");

  // the scope narrowed to Customer's concept: the other concepts' cards are left out, not muted
  const customer = db.entity.find((e) => e.name === "Customer" && e.workspace_id === SEED_IDS.wsRetailDwh && e.deleted_at === null)!;
  await updateDocumentAs(SEED_IDS.userLukasz, DOC, { scope: { concepts: [customer.concept_id] } });
  await page.reload();
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  const narrowed = await svgOf(page, (await figureImages(page))[0]!.src);
  expect(narrowed).toContain(">Customer</text>");
  expect(narrowed).not.toContain(">Sales Order</text>");
  expect(narrowed).not.toContain(">Order Line</text>");
  expect(narrowed).not.toMatch(/muted|out-of-scope/);

  // nothing of the canvas in scope (Product's concept has no card and no mapped table there): the figure's place says so
  const product = db.entity.find((e) => e.name === "Product" && e.workspace_id === SEED_IDS.wsRetailDwh && e.deleted_at === null)!;
  await updateDocumentAs(SEED_IDS.userLukasz, DOC, { scope: { concepts: [product.concept_id] } });
  await page.reload();
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  await expect(pageFigures(page)).toHaveCount(0);
  await expect(page.getByTestId("document-host")).toContainText("Nothing from this canvas is in the document's scope.");
});
