// Slice 37 (S37-06, Q7): the demo's generated documents as text, to compare before and after the design system's tokens.
//
//   npx tsx scripts/document-texts.ts <label>     # writes .data/ui-check/documents-<label>/
//   diff -r .data/ui-check/documents-before .data/ui-check/documents-after
//
// For each of the demo's documents and a document of every section type (the slice 34 test documents,
// tests/lib/markdown-documents.ts): its Markdown, the HTML behind its PDF (`DocumentHtml`, as the page renders it) and
// the document's CSS (`documentCss` and the quick sheet's). It builds everything in memory from the seed; it reads no
// data file. A one-off compare, not a stored fixture.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentHtml } from "@/modules/infodocumenter/ui/document-html";
import { documentCss, quickSheetCss } from "@/modules/infodocumenter/ui/document-css";
import { documentMarkdown } from "@/modules/infodocumenter/domain/markdown";
import { GENERATED, demoDb, demoDocuments, everySection, treeOf } from "../tests/lib/markdown-documents";

const label = process.argv[2];
if (!label || !/^[\w-]+$/.test(label)) {
  console.error("Usage: npx tsx scripts/document-texts.ts <label>   (letters, digits, - and _)");
  process.exit(1);
}
const out = path.resolve(".data", "ui-check", `documents-${label}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const db = demoDb();
const documents = [
  ...demoDocuments(db).map((d) => ({ key: `demo-${d.name}`, definition: d })),
  { key: "every-section", definition: everySection(db) },
  { key: "every-section-pl-column", definition: everySection(db, { language: "pl", layout: "column", longTexts: "column" }) },
  { key: "every-section-de-cards", definition: everySection(db, { language: "de", layout: "cards", requirements: "table", trace: "matrix" }) },
];

for (const { key, definition } of documents) {
  const tree = treeOf(definition, db);
  const name = key.replace(/[^\w-]+/g, "_");
  writeFileSync(path.join(out, `${name}.md`), documentMarkdown({ tree, name: definition.name, generated: GENERATED }));
  writeFileSync(path.join(out, `${name}.html`), renderToStaticMarkup(createElement(DocumentHtml, { tree })));
  writeFileSync(path.join(out, `${name}.css`), documentCss(tree.frame, definition.style) + "\n/* quick sheet */\n" + quickSheetCss(definition.style));
}
console.log(`${documents.length} documents written to ${path.relative(process.cwd(), out)}`);
