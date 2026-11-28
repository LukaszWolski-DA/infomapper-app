// InfoCatalog's items, search and documents on the full demo (slice 39, S39-03, S39-04's documents, C2 to C4): InfoMapper's
// kinds (`coreCatalogItems`), InfoCube's (`cubeCatalogItems`), the composed search (`catalogSearch`) and InfoDocumenter's
// documents that include an item (`catalogDocuments`), over a workspace's snapshot as the catalog read builds it.

import { describe, expect, it } from "vitest";
import { CATALOG_TABLES, CATALOG_TABS, catalogDocuments, catalogIndexOf, workspaceCatalogItems } from "@/compose/catalog";
import { addSeedDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { coreCatalogItems, type CatalogItem } from "@/domain/catalog/items";
import { workspaceSnapshotOf, type StoredRows, type WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable, WorkspaceMember } from "@/domain/types";
import { DEMO_DOCUMENT_NAMES } from "@/modules/infodocumenter/data/demo";
import { ALL_TAB, RESULT_LIMIT, searchCatalog } from "@/modules/infocatalog/domain/search";

const AT = new Date("2026-11-27T10:00:00.000Z");
const db = buildSeed(AT);
addSeedDemoData(db, AT.toISOString());
const rows = db as unknown as Record<string, unknown[]>;
const modules = Object.fromEntries(CATALOG_TABLES.map((t) => [t, rows[t] ?? []])) as never;
const snapshotOf = (ws: string, data: DevDb = db) => workspaceSnapshotOf<ModuleTable>(data as unknown as StoredRows, ws, modules)!;
const retail = snapshotOf(SEED_IDS.wsRetailDwh);
const read = (snapshots: WorkspaceSnapshot<ModuleTable>[]) => ({ organization: { id: SEED_IDS.orgInfoMate, name: "InfoMate", workspaces: [] }, snapshots });
const kinds = (items: readonly CatalogItem[]) => items.reduce<Record<string, number>>((n, i) => ({ ...n, [i.kind]: (n[i.kind] ?? 0) + 1 }), {});

describe("InfoMapper's kinds (C2, C3)", () => {
  const items = coreCatalogItems(retail);
  const m = retail.model;

  it("holds the logical level only, every kind in its model order", () => {
    const logical = m.entities.filter((e) => e.deleted_at === null && e.model_level === "logical");
    expect(m.entities.some((e) => e.model_level === "dimensional")).toBe(true);
    expect(items.filter((i) => i.kind === "entity").map((i) => i.id)).toEqual(logical.map((e) => e.id));
    const logicalIds = new Set(logical.map((e) => e.id));
    expect(items.filter((i) => i.kind === "attribute").map((i) => i.id)).toEqual(m.attributes.filter((a) => a.deleted_at === null && logicalIds.has(a.entity_id)).map((a) => a.id));
    for (const k of ["concept", "source_table", "source_column", "requirement"]) {
      expect(items.filter((i) => i.kind === k).map((i) => i.order)).toEqual(items.filter((i) => i.kind === k).map((_, n) => n));
    }
    expect(kinds(items).source_column).toBe(m.sourceColumns.length);
    expect(kinds(items).requirement).toBe(retail.requirements.length);
  });

  it("names what has no name, and gives a column its full physical name", () => {
    const rel = items.find((i) => i.kind === "relationship")!;
    expect(rel.name).toMatch(/ – |\S/);
    const mapping = items.find((i) => i.kind === "mapping")!;
    expect(mapping.name).toContain(" → ");
    const column = items.find((i) => i.kind === "source_column")!;
    const c = m.sourceColumns.find((x) => x.id === column.id)!;
    const t = m.sourceTables.find((x) => x.id === c.source_table_id)!;
    expect(column.fields.other[0]).toBe(`${m.sourceSystems.find((s) => s.id === t.source_system_id)!.name} / ${t.database_name}.${t.schema_name}.${t.name}.${c.name}`);
  });

  it("marks Personal data: an attribute's flag, a column's classification", () => {
    const pii = m.attributes.find((a) => a.is_pii && a.deleted_at === null && logicalOf(a.entity_id));
    if (pii) expect(items.find((i) => i.id === pii.id)!.marks).toContainEqual({ t: "pii" });
    const piiClass = m.classifications.find((c) => c.code === "PII")!;
    const link = m.classificationLinks.find((l) => l.classification_id === piiClass.id && l.source_column_id);
    expect(link).toBeTruthy();
    expect(items.find((i) => i.id === link!.source_column_id)!.marks).toContainEqual({ t: "pii" });
  });

  it("puts no classification on an entity or an attribute; classifications carry their links' count", () => {
    for (const i of items.filter((x) => x.kind === "entity" || x.kind === "attribute")) expect(i.fields.other.some((o) => o === "Personal data")).toBe(false);
    expect(items.filter((i) => i.kind === "classification").length).toBe(m.classifications.filter((c) => c.deleted_at === null).length);
  });

  const logicalOf = (id: string) => m.entities.find((e) => e.id === id)?.model_level === "logical";
});

describe("InfoCube's kinds (C2)", () => {
  it("are searched only where InfoCube is on, each in a tab of its own after InfoMapper's", () => {
    expect(retail.workspace.infocube).toBe(true);
    const k = kinds(workspaceCatalogItems(retail));
    expect(k.fact).toBeGreaterThan(0);
    expect(k.dimension).toBeGreaterThan(0);
    expect(k.measure).toBeGreaterThan(0);
    expect(k.key).toBeGreaterThan(0);
    expect(k.cube_mapping).toBeGreaterThan(0);
    const off = snapshotOf(SEED_IDS.wsRetailDwh, { ...db, workspace: db.workspace.map((w) => (w.id === SEED_IDS.wsRetailDwh ? { ...w, infocube: false } : w)) });
    expect(Object.keys(kinds(workspaceCatalogItems(off))).filter((x) => ["fact", "dimension", "measure", "key", "cube_mapping"].includes(x))).toEqual([]);
    expect(CATALOG_TABS.map((t) => t.label)).toEqual([
      "Entities", "Attributes", "Relationships", "Concepts", "Source tables", "Source columns", "Mappings", "Requirements",
      "Classifications and stereotypes", "Facts", "Dimensions", "Measures", "Keys", "Dimensional mappings",
    ]);
  });
});

describe("the search (S39-03)", () => {
  const index = catalogIndexOf(read([retail, snapshotOf(SEED_IDS.wsBankX)]));

  it("ranks the exact name first, counts every tab before the tab's filter, and highlights", () => {
    const answer = searchCatalog(index, "customer");
    expect(answer.results[0]!.item.name).toBe("Customer");
    expect(answer.results[0]!.tier).toBe(1);
    expect(answer.results[0]!.nameRanges).toEqual([[0, 8]]);
    const tiers = answer.results.map((r) => r.tier!);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    expect(answer.counts[ALL_TAB]).toBe(answer.results.length + answer.more);
    expect(Object.entries(answer.counts).filter(([k]) => k !== ALL_TAB).reduce((n, [, v]) => n + v, 0)).toBe(answer.counts[ALL_TAB]);
    const tab = searchCatalog(index, "customer", "attributes");
    expect(tab.results.every((r) => r.item.kind === "attribute")).toBe(true);
    expect(tab.results.length).toBe(answer.counts.attributes);
    expect(tab.counts).toEqual(answer.counts);
  });

  it("needs every word, ignoring case and accents", () => {
    const one = searchCatalog(index, "customer");
    const two = searchCatalog(index, "CUSTÓMER address");
    expect(two.counts[ALL_TAB]).toBeGreaterThan(0);
    expect(two.counts[ALL_TAB]).toBeLessThan(one.counts[ALL_TAB]!);
    expect(searchCatalog(index, "customer qqqq").counts[ALL_TAB]).toBe(0);
  });

  it("orders ties by tab, workspace and model order; an empty query browses a tab, never All", () => {
    expect(searchCatalog(index, "").results).toEqual([]);
    const browse = searchCatalog(index, "  ", "entities");
    expect(browse.results.length).toBe(browse.counts.entities);
    expect(browse.results.every((r) => r.tier === null)).toBe(true);
    // the scope's workspaces in their order: within each kind of a tab, Retail's items come first
    const both = CATALOG_TABS.flatMap((t) => t.kinds)
      .map((k) => index.items.length && searchCatalog(index, "", CATALOG_TABS.find((t) => t.kinds.includes(k))!.key).results.filter((r) => r.item.kind === k).map((r) => r.item.workspaceId))
      .filter((ws): ws is string[] => Array.isArray(ws) && ws.includes(SEED_IDS.wsBankX) && ws.includes(SEED_IDS.wsRetailDwh));
    expect(both.length).toBeGreaterThan(0);
    for (const ws of both) expect(ws.indexOf(SEED_IDS.wsBankX)).toBeGreaterThan(ws.lastIndexOf(SEED_IDS.wsRetailDwh));
  });

  it("answers the first 200 and how many more", () => {
    const answer = searchCatalog(index, "", "columns", 5);
    expect(answer.results).toHaveLength(5);
    expect(answer.more).toBe(answer.counts.columns! - 5);
    expect(RESULT_LIMIT).toBe(200);
  });
});

describe("the documents that include an item (C4)", () => {
  const member = (userId: string): WorkspaceMember => retail.members.find((x) => x.user_id === userId)!;
  const customer = coreCatalogItems(retail).find((i) => i.kind === "entity" && i.name === "Customer")!;
  const viewer = (userId: string) => ({ userId, member: member(userId) });

  it("shows the shared documents and the reader's own, never another's private one", () => {
    expect(catalogDocuments(retail, customer, viewer(SEED_IDS.userLukasz)).map((d) => d.name).sort()).toEqual([DEMO_DOCUMENT_NAMES.s2t, DEMO_DOCUMENT_NAMES.shared].sort());
    expect(catalogDocuments(retail, customer, viewer(SEED_IDS.userAnna)).map((d) => d.name).sort()).toEqual([DEMO_DOCUMENT_NAMES.anna, DEMO_DOCUMENT_NAMES.shared].sort());
    expect(catalogDocuments(retail, customer, viewer(SEED_IDS.userPiotr)).map((d) => d.name)).toEqual([DEMO_DOCUMENT_NAMES.shared]);
  });

  it("shows none to a reader without a role, and none while InfoDocumenter is off", () => {
    expect(catalogDocuments(retail, customer, { userId: SEED_IDS.userMarek, member: null })).toEqual([]);
    const off = snapshotOf(SEED_IDS.wsRetailDwh, { ...db, workspace: db.workspace.map((w) => (w.id === SEED_IDS.wsRetailDwh ? { ...w, infodoc: false } : w)) });
    expect(catalogDocuments(off, customer, viewer(SEED_IDS.userLukasz))).toEqual([]);
  });

  it("reads the document's scope: an item outside a project-scoped document is not in it", () => {
    const s2tProject = (rows.document_definition as { name: string; scope: { projects: string[] } }[]).find((d) => d.name === DEMO_DOCUMENT_NAMES.s2t)!.scope.projects;
    expect(s2tProject.length).toBe(1);
    const onCanvases = new Set(retail.canvasItems.filter((c) => retail.projectCanvases.some((l) => l.project_id === s2tProject[0] && l.canvas_id === c.canvas_id)).map((c) => c.entity_id));
    const outside = coreCatalogItems(retail).find((i) => i.kind === "entity" && !onCanvases.has(i.id));
    if (outside) expect(catalogDocuments(retail, outside, viewer(SEED_IDS.userLukasz)).map((d) => d.name)).not.toContain(DEMO_DOCUMENT_NAMES.s2t);
  });
});
