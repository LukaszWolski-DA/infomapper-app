// S26-10 (slice 26, step 3): the content tree of the sections without figures, on the demo ("Retail Co – DWH" with the
// star, InfoCube on), in English, Polish and German: Model overview (D4), Model readiness (the model checks of D-75 in
// scope, D3; the weak-definition rule, D5), Conventions and notation, Source tables (with the Data Vault reading in the
// document's language, D3), the Classification register, Requirements and coverage, Traceability, Data quality rules,
// InfoCube's Bus matrix; the dictionary's three layouts and long definitions (D1); the long texts' three places; the
// source tables in scope (F13). Every builder reads the document's state only: the same state gives the same tree.

import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { longTextTable, mono, text } from "@/domain/document/blocks";
import type { DocNode, DocRuns } from "@/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { buildDocument, type DocumentTree } from "@/modules/infodocumenter/domain/document";
import { isWeakDefinition } from "@/modules/infodocumenter/domain/readiness";
import { sourceTablesInScope } from "@/modules/infodocumenter/domain/scope";
import { INFODOC_SECTION_KINDS } from "@/modules/infodocumenter/domain/sections";
import { defaultStyle } from "@/modules/infodocumenter/domain/style";
import type { DocumentScope, MappingFilter } from "@/modules/infodocumenter/domain/types";

const WS = SEED_IDS.wsRetailDwh;
let n = 0;
const sid = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;

function demo(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed();
  addFullDemoData(db);
  change?.(db);
  return db;
}
const snapshotOf = (db: DevDb) =>
  workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never)!;
const defaults = (type: string) => (INFODOC_SECTION_KINDS.find((k) => k.type === type) ?? DOCUMENT_SECTION_TYPES.get(type)!).defaults();

function doc(
  sections: { type: string; options?: Record<string, unknown> }[],
  { db = demo(), scope = {}, mappings = "all", language = null }: { db?: DevDb; scope?: Partial<DocumentScope>; mappings?: MappingFilter; language?: DocLanguage | null } = {},
): DocumentTree {
  return buildDocument({
    definition: {
      name: "D",
      author_id: SEED_IDS.userLukasz,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings, ...scope },
      cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null },
      style: defaultStyle({ language }),
      sections: sections.map((s) => ({ id: sid(), type: s.type, on: true, heading: null, newPage: true, options: { ...defaults(s.type), ...s.options } })),
    },
    state: documentStateFor(snapshotOf(db)),
    types: DOCUMENT_SECTION_TYPES,
    date: "2026-11-13",
  });
}
const one = (type: string, options?: Record<string, unknown>, rest?: Parameters<typeof doc>[1]) => doc([{ type, options }], rest).sections[0]!;

const words = (runs: DocRuns | undefined) => (runs ?? []).map((r) => r.text).join("");
const flat = (nodes: readonly DocNode[]): DocNode[] => nodes.flatMap((x) => (x.kind === "group" ? flat(x.nodes) : [x]));
const headings = (nodes: readonly DocNode[], level: number) => flat(nodes).flatMap((x) => (x.kind === "heading" && x.level === level ? [x.text] : []));
const tables = (nodes: readonly DocNode[]) => flat(nodes).filter((x): x is Extract<DocNode, { kind: "table" }> => x.kind === "table");
const lists = (nodes: readonly DocNode[]) => flat(nodes).filter((x): x is Extract<DocNode, { kind: "list" }> => x.kind === "list");
const firstColumn = (t: Extract<DocNode, { kind: "table" }>) => t.rows.map((r) => words(r.cells[0]));
const dv2 = (d: DevDb) => {
  for (const w of d.workspace) if (w.id === WS) w.dv2_mode = true;
};

describe("the sections' headings in three languages (S26-10)", () => {
  const ALL = ["overview", "ready", "conv", "sources", "classreg", "reqs", "trace", "dq", "cube.bus"];
  it.each([
    ["en", ["Model overview", "Model readiness", "Conventions and notation", "Source tables", "Classification register", "Requirements and coverage", "Traceability", "Data quality rules", "Bus matrix"]],
    ["pl", ["Przegląd modelu", "Gotowość modelu", "Konwencje i notacja", "Tabele źródłowe", "Rejestr klasyfikacji", "Wymagania i pokrycie", "Śledzenie wymagań (traceability)", "Reguły jakości danych", "Macierz bus matrix"]],
    ["de", ["Modellübersicht", "Modellreife", "Konventionen und Notation", "Quelltabellen", "Klassifikationsverzeichnis", "Anforderungen und Abdeckung", "Rückverfolgbarkeit", "Datenqualitätsregeln", "Bus-Matrix"]],
  ] as const)("in %s, by the document's own language (Q8)", (language, expected) => {
    expect(doc(ALL.map((type) => ({ type })), { language }).sections.map((s) => s.heading)).toEqual(expected);
  });

  it("builds every type from the document's state only: the same state, the same tree", () => {
    const db = demo(dv2);
    const a = doc(ALL.map((type) => ({ type })), { db });
    const b = doc(ALL.map((type) => ({ type })), { db });
    expect(JSON.stringify(b.sections.map((x) => x.nodes))).toBe(JSON.stringify(a.sections.map((x) => x.nodes)));
  });
});

describe("Model overview (D4)", () => {
  it("prints the description, the counts in scope and the concepts with their entities", () => {
    const s = one("overview");
    expect(s.nodes[0]).toEqual({ kind: "paragraph", runs: [{ text: "Enterprise data warehouse for Retail Co: customers, orders and products from CRM, web shop and ERP." }] });
    const [counts] = tables(s.nodes);
    expect(counts!.style).toBe("narrow");
    expect(firstColumn(counts!)).toEqual(["Entities", "Source tables", "Mappings", "Requirements"]);
    expect(words(counts!.rows[2]!.cells[1])).toMatch(/^\d+ \(\d+ approved\)$/);
    const concepts = lists(s.nodes)[0]!;
    expect(concepts.plain).toBe(true);
    expect(concepts.items.map((i) => words(i.runs).split("  ")[0])).toEqual(["Customer", "Sales", "Product", "Reference data"]);
    expect(concepts.items[0]!.runs[0]!.swatch).toMatch(/^#[0-9A-F]{6}$/i);
    // Polish
    expect(firstColumn(tables(one("overview", {}, { language: "pl" }).nodes)[0]!)).toEqual(["Encje", "Tabele źródłowe", "Mapowania", "Wymagania"]);
  });

  it("narrows the counts to a concept", () => {
    const db = demo();
    const customer = db.concept.find((c) => c.workspace_id === WS && c.name === "Customer")!;
    const s = one("overview", { concepts: false }, { db, scope: { concepts: [customer.id] } });
    expect(words(tables(s.nodes)[0]!.rows[0]!.cells[1])).toBe("3");
  });
});

describe("Model readiness (D3, D5)", () => {
  it("the weak definition rule: fewer than four words, or the name itself", () => {
    expect(isWeakDefinition("customer_id", "The customer id")).toBe(true);
    expect(isWeakDefinition("order_total", "Order total.")).toBe(true);
    expect(isWeakDefinition("customer id", "Customer_id;")).toBe(true);
    expect(isWeakDefinition("email", "Where we write to the customer.")).toBe(false);
    expect(isWeakDefinition("email", null)).toBe(false);
    expect(isWeakDefinition("email", "   ")).toBe(false);
  });

  it("lists each check with its count or ✓, then the open items; the model checks' groups in scope, in English (D3)", () => {
    const db = demo((d) => {
      const customer = d.entity.find((e) => e.workspace_id === WS && e.name === "Customer")!;
      for (const a of d.attribute) if (a.entity_id === customer.id && a.name === "email") a.definition_text = "E-mail.";
    });
    const s = one("ready", { max: 5 }, { db });
    const [result] = tables(s.nodes);
    expect(result!.style).toBe("checks");
    const labels = firstColumn(result!);
    expect(labels.slice(0, 7)).toEqual([
      "Entities without a definition",
      "Attributes without a definition",
      "Definitions that repeat the name or have fewer than four words",
      "Attributes with no mapping or feed",
      "Mappings with a type problem",
      "Mappings not approved yet",
      "Requirements not fully covered",
    ]);
    // the model checks (D-75), each group by its own title, English in any document
    // a High group carries its pill
    expect(labels).toContain("Keys copied the wrong way High");
    expect(labels).toContain("Duplicate attribute names");
    expect(words(result!.rows[2]!.cells[1])).toBe("1");
    const weak = lists(s.nodes).find((l) => words(l.items[0]!.runs) === "Customer.email");
    expect(weak).toBeDefined();
    // at most 5 items, then "… and {n} more"
    const many = lists(s.nodes).find((l) => l.items.length === 6)!;
    expect(words(many.items[5]!.runs)).toMatch(/^… and \d+ more$/);
    expect(many.columns).toBe(2);
    // German: the section's words translated, the model checks' groups in English
    const de = tables(one("ready", {}, { language: "de" }).nodes)[0]!;
    expect(firstColumn(de)[0]).toBe("Entitäten ohne Definition");
    expect(firstColumn(de)).toContain("Keys copied the wrong way Hoch");
  });

  it("checks the scope only, and says every check passes when nothing is open", () => {
    const s = one("ready", { checks: ["typeProblems"] }, { scope: { concepts: [demo().concept.find((c) => c.workspace_id === WS && c.name === "Reference data")!.id] } });
    expect(flat(s.nodes).some((x) => x.kind === "paragraph" && words(x.runs) === "Every check passes.")).toBe(true);
  });
});

describe("Conventions and notation", () => {
  it("prints the notation's ends, the statuses, the marks, the stereotypes and classifications in use, the types and the naming", () => {
    const db = demo((d) => {
      for (const w of d.workspace) if (w.id === WS) {
        w.four_eyes = true;
        w.naming_conventions = "Attributes in snake_case.";
      }
    });
    const s = one("conv", { naming: "Dates end in _date." }, { db });
    expect(headings(s.nodes, 2)).toEqual([
      "Relationship notation",
      "Mapping statuses",
      "Marks in diagrams and tables",
      "Entity stereotypes",
      "Classifications used",
      "Physical types in the sources and their logical types",
      "Naming conventions",
    ]);
    const [notation, statuses, marks, stereotypes, classes, types] = tables(s.nodes);
    expect(notation!.rows.map((r) => r.cells[0]![0]!.end)).toEqual([
      { notation: "ie", min: 1, many: false },
      { notation: "ie", min: 0, many: false },
      { notation: "ie", min: 1, many: true },
      { notation: "ie", min: 0, many: true },
    ]);
    expect(statuses!.rows.map((r) => r.cells[0]![0]!.line)).toEqual(["draft", "review", "approved"]);
    expect(flat(s.nodes).some((x) => x.kind === "paragraph" && words(x.runs) === "Four-eyes approval applies: the author of a change does not approve it.")).toBe(true);
    expect(marks!.rows).toHaveLength(8);
    // the workspace's stereotypes (D-79) used by the scope's logical entities, their definitions under the row
    expect(firstColumn(stereotypes!)).toEqual(["Object", "Link", "Dictionary"]);
    expect(stereotypes!.rows[0]!.below).toBeDefined();
    expect(firstColumn(classes!)).toEqual(["Business key", "Personal data"]);
    expect(firstColumn(types!)).toContain("char(2), char(3)");
    const naming = flat(s.nodes).filter((x) => x.kind === "paragraph").map((x) => words((x as { runs: DocRuns }).runs));
    expect(naming.slice(-2)).toEqual(["Attributes in snake_case.", "Dates end in _date."]);
  });
});

describe("Source tables and the classification register", () => {
  it("prints each table in scope with its path, columns, classifications, use, and the Data Vault reading in Data Vault 2.0 mode", () => {
    const off = one("sources");
    expect(headings(off.nodes, 3)).toEqual(["customer_addresses", "customers", "items", "order_header", "order_line", "web_users"]);
    expect(headings(off.nodes, 4)).toEqual([]);
    const s = one("sources", {}, { db: demo(dv2) });
    expect(headings(s.nodes, 4).every((h) => h === "Data Vault reading")).toBe(true);
    const customers = tables(s.nodes)[1]!;
    expect(customers.columns.map((c) => c.label)).toEqual(["Column", "Type", "Keys", "Classifications", "Used by"]);
    expect(customers.rows.find((r) => words(r.cells[0]) === "cust_no")!.cells.map(words)).toEqual(["cust_no", "varchar(20)", "", "Business key BK", "Customer.customer_number"]);
    expect(lists(s.nodes).map((l) => words(l.items[0]!.runs))).toContain("Hub on cust_no");
    // the reading in the document's language (D3)
    const pl = one("sources", {}, { db: demo(dv2), language: "pl" });
    expect(headings(pl.nodes, 4)[0]).toBe("Odczyt Data Vault");
    expect(lists(pl.nodes).map((l) => words(l.items[0]!.runs))).toContain("Hub na cust_no");
    const de = one("sources", {}, { db: demo(dv2), language: "de" });
    expect(lists(de.nodes).map((l) => words(l.items[0]!.runs))).toContain("Hub auf cust_no");
  });

  it("marks a column that left the source, and prints the modeller's notes", () => {
    const db = demo((d) => {
      const col = d.source_column.find((c) => c.name === "fname")!;
      col.missing_since = "2026-11-01T00:00:00.000Z";
      col.note_text = "Given name as typed.";
      d.source_table.find((t) => t.name === "customers")!.note_text = "One row per CRM customer.";
    });
    const s = one("sources", {}, { db });
    const customers = flat(s.nodes);
    expect(customers.some((x) => x.kind === "paragraph" && words(x.runs) === "One row per CRM customer.")).toBe(true);
    const fname = tables(s.nodes)[1]!.rows.find((r) => words(r.cells[0]).startsWith("fname"))!;
    expect(words(fname.cells[0])).toBe("fname missing from the source");
    expect(words(fname.below?.[0])).toBe("Given name as typed.");
  });

  it("the register: each chosen classification's definition, its columns with their use, the attributes with personal data", () => {
    const s = one("classreg");
    expect(headings(s.nodes, 2)).toEqual(["Personal data"]);
    const [columns, attributes] = tables(s.nodes);
    expect(firstColumn(columns!)).toContain("customers.email_addr");
    expect(headings(s.nodes, 4)).toEqual(["Logical attributes marked personal data"]);
    expect(firstColumn(attributes!)).toContain("Customer.email");
    const bk = one("classreg", { classifications: ["BK"], attributes: false });
    expect(headings(bk.nodes, 2)).toEqual(["Business key"]);
    expect(headings(bk.nodes, 4)).toEqual([]);
    expect(one("classreg", { classifications: [] }).nodes).toEqual([{ kind: "paragraph", runs: [{ text: "None.", muted: true }] }]);
  });
});

describe("Requirements, traceability, data quality", () => {
  it("one block per requirement with its properties and coverage bar, or one table; only those touching the scope", () => {
    const s = one("reqs");
    const cards = flat(s.nodes).find((x): x is Extract<DocNode, { kind: "cards" }> => x.kind === "cards")!;
    expect(cards.variant).toBe("requirement");
    const req102 = cards.cards.find((c) => words(c.title).startsWith("REQ-102"))!;
    expect(req102.props.map(words)).toEqual(["Kind: Data requirement", "Status: Agreed", "Priority: Must", "Coverage:  3/3"]);
    expect(req102.props[3]!.some((r) => r.bar?.ok === 3)).toBe(true);
    expect(req102.lines.map((l) => words(l.runs))).toEqual(["REQ-101 Single view of the customer"]);
    const table = tables(one("reqs", { layout: "table" }).nodes)[0]!;
    expect(table.columns.map((c) => c.label)).toEqual(["Key", "Name", "Kind", "Status", "Priority", "Coverage"]);
    // Polish: the kinds' words (new: the prototype prints them in English)
    const pl = flat(one("reqs", {}, { language: "pl" }).nodes).find((x): x is Extract<DocNode, { kind: "cards" }> => x.kind === "cards")!;
    expect(words(pl.cards.find((c) => words(c.title).startsWith("REQ-102"))!.props[0])).toBe("Rodzaj: Wymaganie dotyczące danych");
  });

  it("traceability: per requirement its attributes, where they come from, what they feed and whether they are covered", () => {
    const s = one("trace");
    const req104 = tables(s.nodes)[2]!;
    expect(req104.columns.map((c) => c.label)).toEqual(["Attribute", "Mapped from", "Feeds", "Covered"]);
    const total = req104.rows.find((r) => words(r.cells[0]) === "Sales Order.total_amount")!;
    expect(total.cells.map(words)).toEqual(["Sales Order.total_amount", "order_header.ord_total", "Fact Orders.total_amount", "✓"]);
    const matrix = tables(one("trace", { layout: "matrix" }).nodes);
    expect(matrix).toHaveLength(1);
    expect(matrix[0]!.columns[0]!.label).toBe("Requirement");
    // without the dimensional level the Feeds column goes
    expect(tables(one("trace", {}, { scope: { dimensional: false } }).nodes)[0]!.columns.map((c) => c.label)).toEqual(["Attribute", "Mapped from", "Covered"]);
  });

  it("data quality rules: one table, the rule and the description under the row", () => {
    const s = one("dq");
    const [table] = tables(s.nodes);
    expect(table!.columns.map((c) => c.label)).toEqual(["Key", "Name", "On failure", "Owner", "Applies to"]);
    expect(table!.rows[0]!.cells.map(words)).toEqual(["REQ-103", "E-mail is unique per customer", "Warn", "Data steward", "Customer.email"]);
    expect(table!.rows[0]!.below!.map(words)).toEqual(["Rule: COUNT(DISTINCT customer_id) per lower(email) = 1", "Description: No two active customers share an e-mail address."]);
    expect(firstColumn(tables(one("dq", {}, { language: "de" }).nodes)[0]!)).toEqual(["REQ-103"]);
    expect(tables(one("dq", {}, { language: "de" }).nodes)[0]!.columns[2]!.label).toBe("Bei Verstoß");
  });

  it("the bus matrix: facts against dimensions, and how many facts use each; nothing while InfoCube is off", () => {
    const [matrix] = tables(one("cube.bus").nodes);
    expect(matrix!.style).toBe("matrix");
    expect(matrix!.columns.every((c, i) => !i || c.vertical)).toBe(true);
    expect(firstColumn(matrix!).slice(0, 2)).toEqual(["Fact Orders", "Fact Sales"]);
    const off = demo((d) => {
      for (const w of d.workspace) if (w.id === WS) w.infocube = false;
    });
    expect(doc([{ type: "cube.bus" }], { db: off }).skipped.map((s) => s.text)).toEqual(["Skipped while InfoCube is off: Bus matrix."]);
  });
});

describe("the dictionary's layouts and long definitions (D1)", () => {
  const db = () =>
    demo((d) => {
      const customer = d.entity.find((e) => e.workspace_id === WS && e.name === "Customer")!;
      for (const a of d.attribute)
        if (a.entity_id === customer.id && a.name === "email") a.definition_text = `Where we write to the customer. ${"It is checked when it is entered and kept up to date by the service team. ".repeat(6)}`;
    });
  const customer = (options: Record<string, unknown>) => {
    const nodes = flat(one("dict", { columns: ["attribute", "type", "definition", "mappedFrom"], entity: [], ...options }, { db: db(), scope: { dimensional: false } }).nodes);
    const at = nodes.findIndex((x) => x.kind === "heading" && x.level === 3 && x.text === "Customer");
    return { nodes, block: nodes.slice(at, nodes.findIndex((x, i) => i > at && x.kind === "heading")) };
  };

  it("under each row, as a column with its width, one block per attribute", () => {
    const below = tables(customer({}).block)[0]!;
    expect(below.columns.map((c) => c.label)).toEqual(["Attribute", "Type", "Mapped from"]);
    expect(words(below.rows.find((r) => words(r.cells[0]) === "email")!.below?.[0])).toMatch(/^Where we write/);
    const column = tables(customer({ layout: "column", definitionWidth: 50 }).block)[0]!;
    expect(column.style).toBe("fixed");
    expect(column.columns.map((c) => [c.label, c.width])).toEqual([
      // the prototype's weights share what the definition leaves: 2, 1.2 and 2.3 of 50 %
      ["Attribute", 18.2],
      ["Type", 10.9],
      ["Definition", 50],
      ["Mapped from", 20.9],
    ]);
    const cards = customer({ layout: "cards" }).block.find((x): x is Extract<DocNode, { kind: "cards" }> => x.kind === "cards")!;
    const email = cards.cards.find((c) => words(c.title) === "email")!;
    expect(email.props.map(words)).toEqual(["string(120)"]);
    expect(words(email.text)).toMatch(/^Where we write/);
    expect(email.lines.map((l) => l.label)).toEqual(["Mapped from"]);
  });

  it("moves a definition over the chosen length to the section's end, with a numbered reference in its place", () => {
    const { nodes, block } = customer({ longDefinitions: 300 });
    const email = tables(block)[0]!.rows.find((r) => words(r.cells[0]) === "email")!;
    expect(email.below![0]![0]).toEqual({ text: "→ note 1", ref: true });
    expect(headings(nodes, 2).at(-1)).toBe("Definitions in full");
    const notes = lists(nodes).at(-1)!;
    expect(notes.ordered).toBe(true);
    expect(words(notes.items[0]!.label)).toBe("Customer.email ");
    expect(customer({ longDefinitions: 600 }).nodes.some((x) => x.kind === "heading" && x.text === "Definitions in full")).toBe(false);
    // Polish: "przypis", "Pełne definicje"
    const pl = flat(one("dict", { longDefinitions: 300 }, { db: db(), language: "pl", scope: { dimensional: false } }).nodes);
    expect(pl.some((x) => x.kind === "heading" && x.text === "Pełne definicje")).toBe(true);
  });

  it("groups by concept or not, a concept on a new page when chosen", () => {
    const grouped = one("dict", { conceptPage: true }, { scope: { dimensional: false } }).nodes;
    expect(grouped.filter((x) => x.kind === "pageBreak")).toHaveLength(3);
    expect(headings(one("dict", { byConcept: false }, { scope: { dimensional: false } }).nodes, 2)).toEqual([]);
  });

  it("lists the dimensional entities with their role in InfoCube's words and their feeds (PRD item 8)", () => {
    const nodes = flat(one("dict").nodes);
    const at = nodes.findIndex((x) => x.kind === "heading" && x.text === "Fact Sales");
    const meta = nodes.slice(at).find((x): x is Extract<DocNode, { kind: "meta" }> => x.kind === "meta")!;
    expect(words(meta.parts[0])).toBe("Transaction fact");
    const fed = tables(nodes.slice(at))[0]!.rows.find((r) => words(r.cells[0]) === "quantity")!;
    expect(words(fed.cells[4])).toBe("Order Line.quantity");
    const pl = flat(one("dict", {}, { language: "pl" }).nodes);
    const plAt = pl.findIndex((x) => x.kind === "heading" && x.text === "Fact Sales");
    expect(words((pl[plAt + 1] as Extract<DocNode, { kind: "meta" }>).parts[0])).toBe("Fakt transakcyjny");
  });
});

describe("long texts: under each row, after the table, as a column (D1)", () => {
  const columns = [
    { key: "a", label: "Key" },
    { key: "b", label: "Rule", long: true },
    { key: "c", label: "Note", long: true },
  ];
  const rows: DocRuns[][] = [
    [[mono("R1")], [text("x > 0")], [text("Checked daily.")]],
    [[mono("R2")], [], [text("Manual.")]],
  ];
  it("under each row, labelled with several long columns", () => {
    const [t] = longTextTable(columns, rows, "row", "None.") as [Extract<DocNode, { kind: "table" }>];
    expect(t.columns.map((c) => c.label)).toEqual(["Key"]);
    expect(t.rows[0]!.below!.map(words)).toEqual(["Rule: x > 0", "Note: Checked daily."]);
    expect(t.rows[1]!.below!.map(words)).toEqual(["Note: Manual."]);
  });
  it("after the table, numbered, the row carrying the numbers", () => {
    const [t, notes] = longTextTable(columns, rows, "after", "None.") as [Extract<DocNode, { kind: "table" }>, Extract<DocNode, { kind: "list" }>];
    expect(t.rows.map((r) => words(r.cells.at(-1)))).toEqual(["R1 → 1, 2", "R2 → 3"]);
    expect(notes.ordered).toBe(true);
    expect(notes.items.map((i) => `${words(i.label)} ${words(i.runs)}`)).toEqual(["Rule: x > 0", "Note: Checked daily.", "Note: Manual."]);
  });
  it("as a column; no rows: the text for none", () => {
    expect((longTextTable(columns, rows, "column", "None.")[0] as Extract<DocNode, { kind: "table" }>).columns).toHaveLength(3);
    expect(longTextTable(columns, [], "row", "None.")).toEqual([{ kind: "paragraph", runs: [{ text: "None.", muted: true }] }]);
  });
  it("in a section: S2T's rule after the table", () => {
    const s = one("s2t", { longTexts: "after" });
    expect(flat(s.nodes).some((x) => x.kind === "list" && x.ordered)).toBe(true);
  });
});

describe("the source tables in scope (F13)", () => {
  const ids = (db: DevDb, names: string[]) => names.map((n) => db.source_table.find((t) => t.name === n)!.id);
  const names = (db: DevDb, set: ReadonlySet<string>) => db.source_table.filter((t) => set.has(t.id)).map((t) => t.name).sort();
  it("every table without a project or a concept; mapped and placed ones with a project; mapped ones only with a concept", () => {
    const db = demo();
    const snap = snapshotOf(db);
    const all = sourceTablesInScope(snap, new Set(snap.model.entities.map((e) => e.id)), new Set(), { projects: false, concepts: false, mappings: "all" });
    expect(all.size).toBe(snap.model.sourceTables.length);
    const customer = snap.model.entities.find((e) => e.name === "Customer")!;
    const mapped = sourceTablesInScope(snap, new Set([customer.id]), new Set(), { projects: false, concepts: true, mappings: "all" });
    expect(names(db, mapped)).toEqual(["customers", "web_users"]);
    // only approved mappings: web_users' mapping is a draft
    expect(names(db, sourceTablesInScope(snap, new Set([customer.id]), new Set(), { projects: false, concepts: true, mappings: "approved" }))).toEqual(["customers"]);
    // with a project and no concept, the tables on its canvases too
    const canvases = new Set(snap.projectCanvases.filter((l) => l.project_id === SEED_IDS.projCustomer360).map((l) => l.canvas_id));
    const placed = sourceTablesInScope(snap, new Set([customer.id]), canvases, { projects: true, concepts: false, mappings: "all" });
    expect([...placed].sort()).toEqual([...new Set([...mapped, ...snap.canvasItems.filter((i) => i.source_table_id && canvases.has(i.canvas_id) && i.deleted_at === null).map((i) => i.source_table_id!)])].sort());
    expect(ids(db, ["customers"]).every((id) => placed.has(id))).toBe(true);
  });
});
