// Slice 34 (S34-04, F1, F2, F20): the PDF is unchanged. The content tree's three additions (a figure's `content`, a
// table's `long` and a row's `longCells`) are read by the Markdown only: the HTML of the demo's three documents and of a
// document of every section type, in every dictionary layout and long-text mode, is the same with them and without them.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocNode } from "@/domain/document/content";
import type { DocumentTree } from "@/modules/infodocumenter/domain/document";
import { DocumentHtml } from "@/modules/infodocumenter/ui/document-html";
import { demoDb, demoDocuments, everySection, framedDb, treeOf } from "./lib/markdown-documents";

/** The tree as it was before slice 34: none of the three additions. */
function withoutAdditions(tree: DocumentTree): DocumentTree {
  const strip = (nodes: readonly DocNode[]): DocNode[] =>
    nodes.map((n): DocNode => {
      if (n.kind === "group") return { ...n, nodes: strip(n.nodes) };
      if (n.kind === "figure") {
        const figure = { ...n.figure };
        delete figure.content;
        return { kind: "figure", figure };
      }
      if (n.kind === "table") {
        const table = { ...n, rows: n.rows.map((r) => ({ ...r })) };
        delete table.long;
        for (const r of table.rows) delete r.longCells;
        return table;
      }
      return n;
    });
  return { ...tree, sections: tree.sections.map((s) => ({ ...s, nodes: strip(s.nodes) })) };
}

const html = (tree: DocumentTree, quick = false) => renderToStaticMarkup(createElement(DocumentHtml, { tree, quick }));

describe("the PDF is unchanged by the tree's additions (S34-04)", () => {
  const demo = demoDb();
  const framed = framedDb();
  const trees: [string, DocumentTree][] = [
    ...demoDocuments(demo).map((d) => [d.name, treeOf(d, demo)] as [string, DocumentTree]),
    ...(["below", "column", "cards"] as const).flatMap((layout) => (["row", "after", "column"] as const).map((longTexts) => [`every section, ${layout}, ${longTexts}`, treeOf(everySection(demo, { layout, longTexts }), demo)] as [string, DocumentTree])),
    ["every section with frames", treeOf(everySection(framed), framed)],
  ];

  it.each(trees)("%s: the same HTML, pages and quick sheet", (_, tree) => {
    const before = withoutAdditions(tree);
    expect(JSON.stringify(before)).not.toBe(JSON.stringify(tree));
    expect(html(tree)).toBe(html(before));
    expect(html(tree, true)).toBe(html(before, true));
  }, 30_000);
});
