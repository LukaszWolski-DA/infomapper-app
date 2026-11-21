// S34-03 (slice 34, D-86, Q3, Q4, D4): the figures as Mermaid. On the demo with the star, every figure of the documents'
// Diagrams is one `erDiagram` block under its heading, with its names as on the canvas, and every block of the dialog's
// text parses on Mermaid 9.4.3, 10.9.5 and 12.3.0 (the unit tests parse every block of every section type).

import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, MERMAID_VERSIONS, mermaidBlocks, openDocument, openMarkdown, parsedOnEvery, signInAs } from "./helpers";

test.use({ seed: "full" });

test("S34-03: the dictionary's diagrams: one erDiagram block a figure, the entities by their names, every block parsing on old and new Mermaid", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.shared);
  const md = await openMarkdown(page);
  const blocks = mermaidBlocks(md);
  // one block a figure of the PDF (the preview's source)
  const figures = new Set(await page.getByTestId("document-source").getByTestId("figure").evaluateAll((fs) => fs.map((f) => f.getAttribute("data-figure")))).size;
  expect(figures).toBeGreaterThan(0);
  expect(blocks).toHaveLength(figures);
  for (const b of blocks) expect(b.startsWith("erDiagram\n")).toBe(true);
  // names as on the canvas, quoted, spaces kept (rule 8)
  expect(md).toContain('"Sales Order"');
  const ok = Object.fromEntries(MERMAID_VERSIONS.map((v) => [v, "ok"]));
  for (const b of blocks) expect(await parsedOnEvery(b), b.slice(0, 200)).toEqual(ok);
});

test("S34-03: the S2T document's blocks parse on old and new Mermaid", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.s2t);
  const md = await openMarkdown(page);
  const ok = Object.fromEntries(MERMAID_VERSIONS.map((v) => [v, "ok"]));
  for (const b of mermaidBlocks(md)) expect(await parsedOnEvery(b), b.slice(0, 200)).toEqual(ok);
});
