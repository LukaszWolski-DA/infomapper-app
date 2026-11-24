// fix/pdf-s2t-not-mapped: in the PDF and the preview an unmapped attribute in Source-to-target keeps its target type,
// with "Not mapped" under Source column (else the first other short column; with only Target and Target type after the
// type), in every long-text mode, on the pages and on the quick sheet.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentHtml } from "@/modules/infodocumenter/ui/document-html";
import { demoDb, documentOf, treeOf } from "./lib/markdown-documents";

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

/** Every table of the HTML whose header holds Target and Target type: its header and its rows' cells as text. */
function s2tTables(html: string): { head: string[]; rows: string[][] }[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)]
    .map((m) => {
      const head = [...(m[1]!.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((h) => strip(h[1]!));
      const rows = [...m[1]!.matchAll(/<tr(?: class="hasdef")?>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1]!)));
      return { head, rows };
    })
    .filter((t) => t.head.includes("Target") && t.head.includes("Target type"));
}

const demo = demoDb();
const htmlOf = (columns: string[], longTexts: "row" | "after" | "column", quick = false) =>
  renderToStaticMarkup(createElement(DocumentHtml, { tree: treeOf(documentOf([{ type: "s2t", options: { columns, unmapped: true, longTexts } }]), demo), quick }));
const rowOf = (html: string, name: string) =>
  s2tTables(html)
    .flatMap((t) => t.rows.map((r) => Object.fromEntries(t.head.map((h, i) => [h, r[i]]))))
    .find((r) => r.Target === name)!;

const ALL = ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck", "note"];

describe("the PDF's Source-to-target keeps an unmapped attribute's target type", () => {
  it.each([
    ["row", false],
    ["after", false],
    ["column", false],
    ["row", true],
  ] as const)("long texts %s, quick sheet %s", (longTexts, quick) => {
    const html = htmlOf(ALL, longTexts, quick);
    expect(rowOf(html, "segment_code")).toMatchObject({ Target: "segment_code", "Target type": "string(3)", System: "", "Source column": "Not mapped" });
    for (const t of s2tTables(html)) for (const r of t.rows) expect(r[t.head.indexOf("Target type")], r.join(" | ")).not.toBe("Not mapped");
  });

  it("without Source column: the first other short column; with only the target's two: after the type", () => {
    expect(rowOf(htmlOf(["target", "targetType", "system", "status"], "row"), "segment_code")).toMatchObject({ "Target type": "string(3)", System: "Not mapped", Status: "" });
    expect(rowOf(htmlOf(["target", "targetType"], "row"), "segment_code")).toMatchObject({ "Target type": "string(3) · Not mapped" });
  });
});
