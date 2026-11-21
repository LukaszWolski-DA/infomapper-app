// S34-02 (slice 34, D-86, MT1 to MT3, D2, D3): the dialog's text on the demo's three documents, a sample of what the unit
// tests check fully (`tests/document-markdown.test.ts`): the front matter names the document, workspace, organization,
// language, source and time; the title and the line on Mermaid; the same sections in the same order as the PDF; no
// cover, page numbers or watermark; tables valid (each row as many cells as its header); headings never skip a level.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, openDocument, openMarkdown, pdfHeadings, sectionHeadings, signInAs } from "./helpers";

const cellsOf = (line: string) => line.slice(1, -1).split(/(?<!\\)\|/).length;

function frontMatter(md: string): Record<string, string> {
  const lines = md.split("\n");
  expect(lines[0]).toBe("---");
  const end = lines.indexOf("---", 1);
  return Object.fromEntries(lines.slice(1, end).map((l) => [l.slice(0, l.indexOf(":")), JSON.parse(l.slice(l.indexOf(":") + 2)) as string]));
}

async function checkDocument(page: Page, name: string) {
  await openDocument(page, name);
  const md = await openMarkdown(page);

  const front = frontMatter(md);
  expect(front).toMatchObject({ document: name, workspace: "Retail Co – DWH", organization: "InfoMate", language: "en", source: "live model", generator: "InfoMapper (InfoDocumenter)" });
  expect(front.generated).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/);

  expect(md).toContain(`\n# ${name}\n`);
  expect(md).toContain("Diagrams are Mermaid code blocks: open the file in any Markdown tool that renders Mermaid (VS Code, Obsidian, GitLab, mermaid.live).");

  // the PDF's sections, in its order (the preview's source), without its numbers
  const pdf = await pdfHeadings(page);
  expect(pdf.length).toBeGreaterThan(2);
  expect(sectionHeadings(md)).toEqual(pdf);

  // what serves printing only stays out
  expect(md).not.toMatch(/\bPage \d+ of \d+\b/);
  expect(md).not.toContain("<section");

  // outside the code blocks: tables valid, headings one level at a time
  const text = md.replace(/```[\s\S]*?```/g, "");
  const lines = text.split("\n");
  let level = 1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const h = /^(#{1,6}) /.exec(l);
    if (h) {
      expect(h[1]!.length, l).toBeLessThanOrEqual(level + 1);
      level = h[1]!.length;
    }
    if (l.startsWith("|") && lines[i + 1]?.startsWith("| ---")) {
      const n = cellsOf(l);
      for (let j = i + 1; j < lines.length && lines[j]!.startsWith("|"); j++) expect(cellsOf(lines[j]!), lines[j]).toBe(n);
    }
  }
  return md;
}

test("S34-02: the shared data dictionary: front matter, the PDF's sections, valid tables, no skipped heading", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const md = await checkDocument(page, DEMO_DOCUMENT_NAMES.shared);
  // D3: the cover's fields that are set
  expect(md).toContain('subtitle: "For the business"\n');
  expect(md).toContain('version: "1.0"\n');
  expect(md).toContain('status: "Draft for review"\n');
});

test("S34-02: the S2T document: the same rules, the mappings' statuses as words", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const md = await checkDocument(page, DEMO_DOCUMENT_NAMES.s2t);
  expect(md).toMatch(/\| (Approved|In review|Draft) \|/);
});

test("S34-02: Anna's working dictionary: the same rules", async ({ page }) => {
  await signInAs(page, "Anna Nowak");
  await checkDocument(page, DEMO_DOCUMENT_NAMES.anna);
});
