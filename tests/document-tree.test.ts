// The content tree of a generated document (slice 25, step 3; S25-09): every section built on the demo model (the seed
// with the star and its derivations, `addFullDemoData`) from a snapshot made of plain rows (`workspaceSnapshotOf`), so
// no store is read; the document's title page, contents, frame and skipped sections; the scope, the coverage line by
// the app's rule whatever the mapping filter (Q-L3), and the labels in English, Polish and German, InfoCube's words
// given by InfoCube with its section (Q-L4). Here, not in a module, because it joins both modules through `src/compose/`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import type { DocNode, DocRow, DocRuns } from "@/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { CUBE_SECTION_TABLES, CUBE_SECTION_TYPE } from "@/modules/infocube/domain/document-section";
import { CUBE_DOC_WORDS } from "@/modules/infocube/domain/document-words";
import { buildDocument, type DocumentTree } from "@/modules/infodocumenter/domain/document";
import { LABELS } from "@/modules/infodocumenter/domain/labels";
import { defaultStyle, upgradeSection } from "@/modules/infodocumenter/domain/style";
import type { DocumentScope, DocumentSection, MappingFilter } from "@/modules/infodocumenter/domain/types";

const WS = SEED_IDS.wsRetailDwh;
let n = 0;
const sid = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;

function demo(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed();
  addFullDemoData(db);
  change?.(db);
  return db;
}

function snapshotOf(db: DevDb) {
  const modules = Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []]));
  return workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, modules as never)!;
}

const ALL_DICT = { entity: ["stereotype", "definition", "coverage", "requirements", "relationships"], columns: ["attribute", "type", "keys", "nullable", "pii", "definition", "mappedFrom", "calculation", "requirements"] };
const ALL_S2T = { columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck", "note", "requirements"], group: "entity", unmapped: true };
const ALL_CUBE = { facts: true, dimensions: true, dimensionDefinitions: true, measures: true, relationships: true, feeds: true };

function doc(
  sections: { type: string; options: Record<string, unknown>; on?: boolean }[],
  { db = demo(), scope = {}, mappings = "all" }: { db?: DevDb; scope?: Partial<DocumentScope>; mappings?: MappingFilter } = {},
): DocumentTree {
  const state = documentStateFor(snapshotOf(db));
  // slice 25's shape, read as the store reads it (Text's heading moves to the entry, slice 26's upgrade)
  const list: DocumentSection[] = sections.map((s) => upgradeSection({ id: sid(), type: s.type, on: s.on ?? true, options: s.options }));
  return buildDocument({
    definition: {
      name: "Retail Co – data dictionary",
      author_id: SEED_IDS.userLukasz,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings, ...scope },
      cover: { title: null, subtitle: "For the business", version: "1.0", status: "Draft for review", preparedBy: null },
      style: defaultStyle(),
      sections: list,
    },
    state,
    types: DOCUMENT_SECTION_TYPES,
    date: "2026-11-12",
  });
}

const words = (runs: DocRuns) => runs.map((r) => r.text).join("");
const headings = (nodes: readonly DocNode[], level: number) => nodes.flatMap((x) => (x.kind === "heading" && x.level === level ? [x.text] : []));
/** The nodes of an entity's (or a concept's) part: from its heading to the next heading of the same level or above. */
function part(nodes: readonly DocNode[], level: number, name: string): DocNode[] {
  const at = nodes.findIndex((x) => x.kind === "heading" && x.level === level && x.text === name);
  expect(at, name).toBeGreaterThanOrEqual(0);
  const end = nodes.findIndex((x, i) => i > at && x.kind === "heading" && x.level <= level);
  return nodes.slice(at, end < 0 ? undefined : end);
}
const tables = (nodes: readonly DocNode[]) => nodes.filter((x): x is Extract<DocNode, { kind: "table" }> => x.kind === "table");
const rowNamed = (rows: readonly DocRow[], name: string) => rows.find((r) => words(r.cells[0]!) === name)!;
const metaOf = (nodes: readonly DocNode[]) => nodes.flatMap((x) => (x.kind === "meta" ? [x.parts.map(words)] : []));

describe("the document (title page, contents, frame)", () => {
  it("prints the title page from the workspace and the definition, lists the sections that are on, and names the frame's texts", () => {
    const tree = doc([
      { type: "text", options: { heading: "Scope", body: "One.\n\nTwo" } },
      { type: "dict", options: ALL_DICT, on: false },
      { type: "s2t", options: ALL_S2T },
    ]);
    expect(tree.cover).toEqual({
      organization: "InfoMate",
      title: "Retail Co – data dictionary",
      subtitle: "For the business",
      rows: [
        { key: "client", label: "Client", value: "Retail Co" },
        { key: "workspace", label: "Workspace", value: "Retail Co – DWH" },
        { key: "state", label: "Model state", value: "Live model on 2026-11-12" },
        { key: "version", label: "Version", value: "1.0" },
        { key: "status", label: "Status", value: "Draft for review" },
        // D11: empty "Prepared by" is the author's name, never the reader's
        { key: "preparedBy", label: "Prepared by", value: "Łukasz" },
      ],
    });
    expect(tree.contents.heading).toBe("Contents");
    expect(tree.contents.entries.map((e) => e.text)).toEqual(["Scope", "Source-to-target mapping"]);
    expect(tree.sections.map((s) => s.anchor)).toEqual(tree.contents.entries.map((e) => e.anchor));
    expect(tree.frame).toEqual({
      headerLeft: "InfoMate · Retail Co – data dictionary",
      headerRight: "",
      footerLeft: "Retail Co – DWH · Live model on 2026-11-12",
      footerRight: "Page {page} of {pages}",
      watermark: "DRAFT · live model",
    });
    expect(tree.skipped).toEqual([]);
  });

  it("skips a section while its module is off and one whose type no module knows, each with its note, outside the contents", () => {
    const off = demo((db) => {
      for (const w of db.workspace) if (w.id === WS) w.infocube = false;
    });
    const tree = doc([{ type: "text", options: { heading: null, body: "" } }, { type: CUBE_SECTION_TYPE, options: ALL_CUBE }, { type: "acme.figures", options: { any: 1 } }], { db: off });
    expect(tree.contents.entries.map((e) => e.text)).toEqual(["Introduction"]);
    expect(tree.skipped.map((s) => s.text)).toEqual(["Skipped while InfoCube is off: Dimensional model.", "Skipped: this section's module is not installed (acme.figures)."]);
    // an empty Text has its heading and no paragraph
    expect(tree.sections[0]!.nodes).toEqual([]);
  });

  it("keeps the title's and the prepared-by's own text when written", () => {
    const db = demo();
    const state = documentStateFor(snapshotOf(db));
    const tree = buildDocument({
      definition: {
        name: "Name",
        author_id: SEED_IDS.userAnna,
        scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" },
        cover: { title: "Own title", subtitle: null, version: null, status: null, preparedBy: "Data office" },
        style: defaultStyle(),
        sections: [],
      },
      state,
      types: DOCUMENT_SECTION_TYPES,
      date: "2026-11-12",
    });
    expect(tree.cover.title).toBe("Own title");
    expect(tree.cover.rows.map((r) => r.value)).toEqual(["Retail Co", "Retail Co – DWH", "Live model on 2026-11-12", "–", "–", "Data office"]);
    expect(tree.frame.headerLeft).toBe("InfoMate · Own title");
  });
});

describe("Text (D8)", () => {
  it("keeps paragraphs and line breaks as plain text", () => {
    const [s] = doc([{ type: "text", options: { heading: null, body: "**not bold**\n- not a list\n\n\nSecond\n" } }]).sections;
    expect(s!.heading).toBe("Introduction");
    expect(s!.nodes).toEqual([
      { kind: "paragraph", runs: [{ text: "**not bold**" }, { text: "- not a list", lineBreak: true }] },
      { kind: "paragraph", runs: [{ text: "Second" }] },
    ]);
  });
});

describe("the data dictionary", () => {
  const dict = (options = ALL_DICT, rest?: Parameters<typeof doc>[1]) => doc([{ type: "dict", options }], rest).sections[0]!.nodes;

  it("lists the logical entities only, by concept in the concepts' order, then by name", () => {
    const nodes = dict();
    expect(headings(nodes, 2)).toEqual(["Customer", "Sales", "Product", "Reference data"]);
    expect(headings(part(nodes, 2, "Customer"), 3)).toEqual(["Customer", "Customer Address"]);
    expect(headings(nodes, 3).some((x) => x.startsWith("Fact ") || x.startsWith("Dim "))).toBe(false);
  });

  it("prints the chosen fields above an entity's table, the chosen columns in their order, the definition under the row and the relationships after", () => {
    // the demo's attributes have no definitions: one written as test data
    const db = demo((d) => {
      const customer = d.entity.find((e) => e.workspace_id === WS && e.name === "Customer")!;
      for (const a of d.attribute) if (a.entity_id === customer.id && a.name === "email") a.definition_text = "Where we write to the customer.";
    });
    const customer = part(dict(ALL_DICT, { db }), 3, "Customer");
    expect(metaOf(customer)).toEqual([["Object", "7 of 9 attributes mapped", "REQ-101"]]);
    expect(customer[2]).toEqual({ kind: "paragraph", runs: [{ text: "A person or organisation that buys from us." }] });
    const [attributes, relationships] = tables(customer);
    expect(attributes!.columns.map((c) => c.label)).toEqual(["Attribute", "Type", "Keys", "Nullable", "Personal data", "Mapped from", "Calculation", "Requirements"]);
    const email = rowNamed(attributes!.rows, "email");
    expect(email.cells.map(words)).toEqual(["email", "string(120)", "", "Yes", "PII", "customers.email_addrweb_users.email Draft", "", "REQ-102, REQ-103, REQ-105"]);
    // two mappings, the second on its own line, its status marked while the document shows drafts
    expect(email.cells[5]![1]).toEqual({ text: "web_users.email", mono: true, lineBreak: true });
    expect(email.cells[5]![3]).toEqual({ text: "Draft", pill: true, status: "draft" });
    expect(words(rowNamed(attributes!.rows, "customer_id").cells[2]!)).toBe("PK");
    expect(words(rowNamed(attributes!.rows, "customer_id").cells[3]!)).toBe("No");
    expect(rowNamed(attributes!.rows, "segment_code").cells[5]).toEqual([{ text: "Not mapped", muted: true }]);
    expect(email.below).toEqual([[{ text: "Where we write to the customer." }]]);
    expect(attributes!.rows.filter((r) => r.below)).toEqual([email]);
    // the definition column off: nothing under the rows
    const without = tables(part(dict({ ...ALL_DICT, columns: ALL_DICT.columns.filter((c) => c !== "definition") }, { db }), 3, "Customer"))[0]!;
    expect(without.rows.some((r) => r.below)).toBe(false);
    expect(relationships!.columns.map((c) => c.label)).toEqual(["Related entity", "Relationship", "Cardinality (this : related)"]);
    expect(relationships!.rows.map((r) => r.cells.map(words))).toEqual([
      ["Sales Order", "places", "1 : 0..*"],
      ["Customer Address", "lives at", "1 : 0..*"],
    ]);
  });

  it("counts the coverage line by the app's rule whatever the mapping filter, and hides drafts and reviews only in the rows (Q-L3)", () => {
    const all = part(dict(ALL_DICT, { mappings: "all" }), 3, "Customer");
    const approved = part(dict(ALL_DICT, { mappings: "approved" }), 3, "Customer");
    expect(metaOf(approved)).toEqual(metaOf(all));
    const rows = tables(approved)[0]!.rows;
    expect(words(rowNamed(rows, "email").cells[5]!)).toBe("customers.email_addr");
    expect(rowNamed(rows, "birth_date").cells[5]).toEqual([{ text: "Not mapped", muted: true }]);
    // Approved only marks no status
    expect(rows.flatMap((r) => r.cells.flat()).some((x) => x.pill)).toBe(false);
  });

  it("prints a calculated attribute's rule, and names its inputs when it has no mapping shown", () => {
    const db = demo();
    const rows = tables(part(dict(ALL_DICT, { db }), 3, "Sales Order"))[0]!.rows;
    expect(words(rowNamed(rows, "total_amount").cells[6]!)).toBe("Sum of its order lines' net amounts");
    // a calculated attribute with an input and no mapping of its own
    const order = db.entity.find((e) => e.workspace_id === WS && e.name === "Sales Order")!;
    const [total, input] = ["total_amount", "order_id"].map((name) => db.attribute.find((a) => a.entity_id === order.id && a.name === name)!);
    for (const m of db.mapping) if (m.attribute_id === total!.id) m.deleted_at = "2026-11-12T00:00:00.000Z";
    for (const i of db.attribute_input) if (i.attribute_id === total!.id) i.deleted_at = "2026-11-12T00:00:00.000Z";
    const at = "2026-11-12T00:00:00.000Z";
    db.attribute_input.push({ id: sid(), workspace_id: WS, version: 1, created_at: at, created_by: SEED_IDS.userLukasz, updated_at: at, updated_by: SEED_IDS.userLukasz, deleted_at: null, attribute_id: total!.id, input_attribute_id: input!.id, sort_order: 0 });
    const after = tables(part(dict(ALL_DICT, { db }), 3, "Sales Order"))[0]!.rows;
    expect(rowNamed(after, "total_amount").cells[5]).toEqual([{ text: "= order_id", muted: true }]);
  });

  it("prints a renamed stereotype by its new name (D-79)", () => {
    const db = demo((d) => {
      for (const s of d.stereotype) if (s.workspace_id === WS && s.code === "object") s.name = "Business object";
    });
    expect(metaOf(part(dict(ALL_DICT, { db }), 3, "Customer"))[0]![0]).toBe("Business object");
  });

  it("narrows to a project's canvases and to the chosen concepts; ids deleted since are ignored (F7)", () => {
    const byProject = dict(ALL_DICT, { scope: { projects: [SEED_IDS.projCustomer360] } });
    // by concept (Customer, then Sales), then by name
    expect(headings(byProject, 3)).toEqual(["Customer", "Order Line", "Sales Order"]);
    const db = demo();
    const sales = db.concept.find((c) => c.workspace_id === WS && c.name === "Sales")!.id;
    expect(headings(dict(ALL_DICT, { db, scope: { concepts: [sales] } }), 2)).toEqual(["Sales"]);
    expect(headings(dict(ALL_DICT, { scope: { projects: ["01a0f9e9-0000-7000-8000-000000000000"] } }), 2)).toEqual(["Customer", "Sales", "Product", "Reference data"]);
    // with a concept outside the chosen ones, a relationship's other end is marked
    const rel = tables(part(dict(ALL_DICT, { db, scope: { concepts: [sales] } }), 3, "Sales Order")).at(-1)!;
    expect(rel.rows.some((r) => words(r.cells[0]!).endsWith(" (outside this document)"))).toBe(true);
  });

  it("is empty with the logical level out of scope", () => {
    expect(dict(ALL_DICT, { scope: { logical: false } })).toEqual([{ kind: "paragraph", runs: [{ text: "None.", muted: true }] }]);
  });
});

describe("the source-to-target mapping", () => {
  const s2t = (options: Record<string, unknown> = ALL_S2T, mappings: MappingFilter = "all") => doc([{ type: "s2t", options }], { mappings }).sections[0]!.nodes;

  it("prints the chosen columns, the rule and the note under the row, grouped by target entity, with the attributes that have no mapping", () => {
    const customer = tables(part(s2t(), 2, "Customer"))[0]!;
    expect(customer.columns.map((c) => c.label)).toEqual(["Target", "Target type", "System", "Source column", "Source type", "Status", "Type check", "Requirements"]);
    const second = customer.rows.filter((r) => words(r.cells[0]!) === "email")[1]!;
    expect(second.cells.map(words)).toEqual(["email", "string(120)", "WEB", "web_users.email", "varchar(255)", "Draft", "varchar(255) does not fit string(120): values can be longer than 120 characters.", ""]);
    expect(second.below!.map(words)).toEqual(["Rule: Direct copy", "Note: Second source for e-mail. Decide the priority rule with the data owner."]);
    expect(rowNamed(customer.rows, "segment_code").cells.map(words)).toEqual(["segment_code", "Not mapped", "", "", "", "", "", ""]);
  });

  it("labels nothing under the row when only one long text is chosen, and shows a transformation's rule", () => {
    const nodes = s2t({ columns: ["target", "rule"], group: "entity", unmapped: false });
    const rows = tables(nodes).flatMap((t) => t.rows);
    expect(rows.every((r) => r.below?.length === 1 && !r.below[0]![0]!.strong)).toBe(true);
    expect(rows.some((r) => words(r.below![0]!).startsWith("Transformation: "))).toBe(true);
  });

  it("groups by source system, the systems by name", () => {
    const nodes = s2t({ ...ALL_S2T, group: "system" });
    expect(headings(nodes, 2)).toEqual(["CRM", "ERP", "WEB"].filter((s) => headings(nodes, 2).includes(s)));
    expect(headings(nodes, 2)).toContain("WEB");
    expect(tables(part(nodes, 2, "WEB"))[0]!.rows.map((r) => words(r.cells[3]!))).toContain("web_users.email");
  });

  it("hides drafts and reviews with Approved only, and drafts with all but drafts", () => {
    const statuses = (filter: MappingFilter) => tables(s2t(ALL_S2T, filter)).flatMap((t) => t.rows.map((r) => words(r.cells[5]!))).filter(Boolean);
    expect(new Set(statuses("all"))).toEqual(new Set(["Approved", "In review", "Draft"]));
    expect(new Set(statuses("notdraft"))).toEqual(new Set(["Approved", "In review"]));
    expect(new Set(statuses("approved"))).toEqual(new Set(["Approved"]));
  });
});

describe("InfoCube's Dimensional model (through the extension point)", () => {
  const cube = (rest?: Parameters<typeof doc>[1], options: Record<string, unknown> = ALL_CUBE) => doc([{ type: CUBE_SECTION_TYPE, options }], rest).sections[0]!;

  it("reads only the tables it registers, which are the snapshot's", () => {
    expect(DOCUMENT_SECTION_TYPES.get(CUBE_SECTION_TYPE)!.tables).toEqual(CUBE_SECTION_TABLES);
    expect(new Set(DOCUMENT_TABLES)).toEqual(new Set(CUBE_SECTION_TABLES));
  });

  it("prints the facts and then the dimensions, each with its role, definition, type, grain, keys, unknown member, measures and feeds", () => {
    const { heading, nodes } = cube();
    expect(heading).toBe("Dimensional model");
    expect(headings(nodes, 2)).toEqual(["Facts", "Dimensions"]);
    const sales = part(nodes, 3, "Fact Sales");
    expect(metaOf(sales)).toEqual([["Transaction fact"]]);
    const [type, dims, measures, fed] = tables(sales);
    expect(type!.rows[0]!.cells.map(words)).toEqual(["Transaction", "One order line"]);
    expect(dims!.columns.map((c) => c.label)).toEqual(["Dimension", "Role", "Key", "No match →"]);
    expect(dims!.rows.map((r) => r.cells.map(words)).some(([, role, , noMatch]) => role !== "" && noMatch === "-1")).toBe(true);
    expect(dims!.rows.some((r) => r.below?.length === 1)).toBe(true);
    expect(measures!.columns.map((c) => c.label)).toEqual(["Attribute", "Additivity", "Note"]);
    expect(measures!.rows.length).toBeGreaterThan(0);
    expect(fed!.columns.map((c) => c.label)).toEqual(["Attribute", "Type", "Fed from", "Rule"]);
    const date = part(nodes, 3, "Dim Date");
    expect(tables(date)[0]!.rows[0]!.cells.map(words)[0]).toMatch(/^SCD \d$/);
    expect(headings(date, 4)).toContain("Unknown member");
    const product = part(nodes, 3, "Dim Product");
    expect(words(tables(product)[0]!.rows[0]!.cells[0]!)).toBe("Snapshot · Month-end");
    expect(metaOf(product)[0]![0]).toBe("Dimension, snapshot (Month-end)");
    expect(metaOf(part(nodes, 3, "Fact Orders"))[0]![0]).toBe("Transaction fact, aggregate of Fact Sales");
    expect(metaOf(part(nodes, 3, "Dim Order Flags"))[0]![0]).toBe("Junk dimension");
    expect(metaOf(part(nodes, 3, "Dim Category"))[0]![0]).toBe("Dimension, outrigger of Dim Product");
  });

  it("says when a dimension has no unknown member", () => {
    const db = demo((d) => {
      const date = d.entity.find((e) => e.workspace_id === WS && e.name === "Dim Date")!;
      for (const c of (d as unknown as { cube_entity: { entity_id: string; has_unknown_member: boolean | null }[] }).cube_entity) if (c.entity_id === date.id) c.has_unknown_member = false;
    });
    const date = part(cube({ db }).nodes, 3, "Dim Date");
    expect(metaOf(date)).toContainEqual(["This dimension has no unknown member."]);
    expect(headings(date, 4)).not.toContain("Unknown member");
  });

  it("has no content with the dimensional level out of scope, and leaves out what its options turn off", () => {
    expect(cube({ scope: { dimensional: false } }).nodes).toEqual([{ kind: "paragraph", runs: [{ text: "There are no facts or dimensions in this model state.", muted: true }] }]);
    const facts = cube(undefined, { ...ALL_CUBE, dimensions: false, measures: false, feeds: false, dimensionDefinitions: false }).nodes;
    expect(headings(facts, 2)).toEqual(["Facts"]);
    expect(headings(facts, 4)).not.toContain("Measures");
    expect(headings(facts, 4)).not.toContain("Fed from");
    expect(tables(part(facts, 3, "Fact Sales"))[1]!.rows.every((r) => !r.below)).toBe(true);
  });

  it("narrows to a project's canvases", () => {
    expect(headings(cube({ scope: { projects: [SEED_IDS.projCustomer360] } }).nodes, 3)).toEqual([]);
  });
});

describe("the labels in three languages (S25-08)", () => {
  const inLanguage = (language: DocLanguage) =>
    doc(
      [
        { type: "text", options: { heading: null, body: "x" } },
        { type: "dict", options: ALL_DICT },
        { type: "s2t", options: ALL_S2T },
        { type: CUBE_SECTION_TYPE, options: ALL_CUBE },
      ],
      {
        db: demo((d) => {
          for (const w of d.workspace) if (w.id === WS) w.doc_language = language;
        }),
      },
    );

  it("prints headings and labels in Polish and German, and names and definitions as the model has them", () => {
    const pl = inLanguage("pl");
    expect(pl.contents.heading).toBe("Spis treści");
    expect(pl.sections.map((s) => s.heading)).toEqual(["Wprowadzenie", "Słownik danych", "Mapowanie źródło–cel", "Model wymiarowy"]);
    expect(pl.cover.rows.map((r) => r.label)).toEqual(["Klient", "Workspace", "Stan modelu", "Wersja", "Status", "Przygotował(a)"]);
    expect(pl.frame.watermark).toBe("WERSJA ROBOCZA · model bieżący");
    const customer = part(pl.sections[1]!.nodes, 3, "Customer");
    expect(metaOf(customer)[0]![1]).toBe("7 z 9 atrybutów zmapowanych");
    expect(customer[2]).toEqual({ kind: "paragraph", runs: [{ text: "A person or organisation that buys from us." }] });
    expect(tables(customer)[0]!.columns[0]!.label).toBe("Atrybut");
    const plCube = pl.sections[3]!.nodes;
    expect(headings(plCube, 2)).toEqual(["Fakty", "Wymiary"]);
    expect(metaOf(part(plCube, 3, "Fact Orders"))[0]![0]).toBe("Fakt transakcyjny, agregat faktu Fact Sales");
    expect(words(tables(part(plCube, 3, "Dim Product"))[0]!.rows[0]!.cells[0]!)).toBe("Migawka · Month-end");

    const de = inLanguage("de");
    expect(de.sections.map((s) => s.heading)).toEqual(["Einleitung", "Datenkatalog", "Quelle-Ziel-Mapping", "Dimensionales Modell"]);
    expect(de.cover.rows[2]!.value).toBe("Aktuelles Modell vom 2026-11-12");
    const deCube = de.sections[3]!.nodes;
    expect(tables(part(deCube, 3, "Fact Sales"))[0]!.columns.map((c) => c.label)).toEqual(["Fakttyp", "Granularität"]);
    expect(words(tables(part(deCube, 3, "Fact Sales"))[0]!.rows[0]!.cells[0]!)).toBe("Transaktion");
    expect(metaOf(part(deCube, 3, "Dim Order Flags"))[0]![0]).toBe("Junk-Dimension");
  });

  it("has every label in every language, and InfoCube's words for every fact type, additivity and status", () => {
    for (const language of ["pl", "de"] as const) {
      expect(Object.keys(LABELS[language]).sort()).toEqual(Object.keys(LABELS.en).sort());
      for (const v of Object.values(LABELS[language])) expect(v.trim()).not.toBe("");
      const w = CUBE_DOC_WORDS[language];
      expect(Object.keys(w).sort()).toEqual(Object.keys(CUBE_DOC_WORDS.en).sort());
      expect(Object.keys(w.factTypes).sort()).toEqual(["accumulating", "periodic", "transaction"]);
      expect(Object.keys(w.additivities).sort()).toEqual(["additive", "non", "semi"]);
    }
  });
});

describe("no section reads a store (S25-09)", () => {
  it("builds from a snapshot of plain rows, and the builders import nothing of the data layer", () => {
    // every test above builds from `workspaceSnapshotOf` over an in-memory seed: no file, no store
    const files = [
      "src/domain/document/state.ts",
      "src/domain/document/blocks.ts",
      "src/modules/infodocumenter/domain/builders.ts",
      "src/modules/infodocumenter/domain/document.ts",
      "src/modules/infodocumenter/domain/scope.ts",
      "src/modules/infocube/domain/document-section.ts",
    ];
    for (const f of files) {
      const source = readFileSync(path.join(process.cwd(), f), "utf8");
      expect(source, f).not.toMatch(/from "@\/data|from "\.\.\/\.\.\/data|getDataStore|DataStore/);
    }
    // InfoDocumenter names no module and no module's table
    for (const f of files.filter((x) => x.includes("infodocumenter"))) expect(readFileSync(path.join(process.cwd(), f), "utf8"), f).not.toMatch(/infocube|cube_/i);
  });
});
