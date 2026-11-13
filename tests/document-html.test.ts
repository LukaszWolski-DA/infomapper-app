// The document's HTML (slice 25, step 4): the content tree rendered by React, so every text from the model, a definition
// or a recipe is escaped. A definition, a name and a title holding markup come out as text; nothing in the output is an
// element the model wrote. The page frame's texts go into CSS strings escaped by `cssString`.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { buildDocument } from "@/modules/infodocumenter/domain/document";
import { defaultStyle } from "@/modules/infodocumenter/domain/style";
import { cssString, documentCss } from "@/modules/infodocumenter/ui/document-css";
import { DocumentHtml } from "@/modules/infodocumenter/ui/document-html";

const MARKUP = `<img src=x onerror="alert(1)"><script>alert(2)</script><b>bold</b>`;

function html(title: string) {
  const db = buildSeed();
  addFullDemoData(db);
  const customer = db.entity.find((e) => e.workspace_id === SEED_IDS.wsRetailDwh && e.name === "Customer")!;
  customer.definition_text = MARKUP;
  db.attribute.find((a) => a.entity_id === customer.id && a.name === "email")!.definition_text = MARKUP;
  db.attribute.find((a) => a.entity_id === customer.id && a.name === "email")!.name = "<i>email</i>";
  const modules = Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []]));
  const snapshot = workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, SEED_IDS.wsRetailDwh, modules as never)!;
  const tree = buildDocument({
    definition: {
      name: title,
      author_id: SEED_IDS.userLukasz,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" },
      cover: { title: null, subtitle: MARKUP, version: null, status: null, preparedBy: null },
      style: defaultStyle(),
      sections: [
        { id: "00000000-0000-7000-8000-000000000001", type: "text", on: true, heading: MARKUP, newPage: true, options: { body: MARKUP } },
        { id: "00000000-0000-7000-8000-000000000002", type: "dict", on: true, heading: null, newPage: true, options: { entity: ["definition"], columns: ["attribute", "definition"] } },
      ],
    },
    state: documentStateFor(snapshot),
    types: DOCUMENT_SECTION_TYPES,
    date: "2026-11-12",
  });
  return { tree, out: renderToStaticMarkup(createElement(DocumentHtml, { tree })) };
}

describe("the document's HTML", () => {
  it("prints markup from the model and the recipe as text: no element of it, escaped", () => {
    const { out } = html(MARKUP);
    expect(out).not.toMatch(/<img|<script|<b>bold|<i>email/);
    // the title, the subtitle, the Text's heading and body, the entity's and the attribute's definitions, a name
    expect(out.split("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;").length - 1).toBeGreaterThanOrEqual(6);
    expect(out).toContain("&lt;i&gt;email&lt;/i&gt;");
  });

  it("draws the title page, the contents and each section as the prototype's classes", () => {
    const { out, tree } = html("Dictionary");
    expect(out).toContain('<section class="dsheet dcover"');
    expect(out).toContain('<section class="dsheet dtoc"');
    expect(out.match(/<section class="dsheet dsec"/g)).toHaveLength(tree.sections.length);
    // the definition under its row, across the row's columns (HTML reads the attribute's name in any case)
    expect(out).toMatch(/<tr class="ddr"><td colspan="1">/i);
    for (const e of tree.contents.entries) expect(out).toContain(`<a href="#${e.anchor}">`);
  });

  it("escapes the frame's texts in the CSS strings", () => {
    expect(cssString(`a "b" \\ c\nd`)).toBe(`"a \\"b\\" \\\\ c d"`);
    const css = documentCss({ headerLeft: `Org"}*{display:none} · T`, headerRight: "", footerLeft: "W · Live", footerRight: "Page {page} of {pages}", watermark: "DRAFT" });
    expect(css).toContain(`@top-left{content:"Org\\"}*{display:none} · T"`);
    expect(css).toContain(`@top-right{content:none`);
    expect(css).toContain(`@bottom-right{content:"Page " counter(page) " of " counter(pages)`);
  });
});
