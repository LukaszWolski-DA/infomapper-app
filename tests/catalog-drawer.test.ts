// InfoCatalog's drawer on the full demo (slice 39, step 6, S39-04, S39-05): the canvases that show an item, the best
// first, with the parameters that select it (`canvasesShowing`), and each kind's details: characteristics, texts and the
// items one step away, every link naming an item the catalog has (`coreCatalogDetails`, InfoCube's `cubeCatalogDetails`).

import { describe, expect, it } from "vitest";
import { CATALOG_TABLES, workspaceCatalogItems } from "@/compose/catalog";
import { addSeedDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { canvasesShowing } from "@/domain/catalog/canvases";
import { coreCatalogDetails, GROUP_LIMIT, type CatalogDetails } from "@/domain/catalog/details";
import type { CatalogItem } from "@/domain/catalog/items";
import { relationshipSentences } from "@/domain/model/relationship-sentences";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { cubeCatalogDetails } from "@/modules/infocube/domain/catalog";

const AT = new Date("2026-11-27T10:00:00.000Z");
const db = buildSeed(AT);
addSeedDemoData(db, AT.toISOString());
const rows = db as unknown as Record<string, unknown[]>;
const modules = Object.fromEntries(CATALOG_TABLES.map((t) => [t, rows[t] ?? []])) as never;
const retail = workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, SEED_IDS.wsRetailDwh, modules)!;
const items = workspaceCatalogItems(retail);
const byKey = new Map(items.map((i) => [`${i.kind}:${i.id}`, i]));
const input = { item: (kind: string, id: string) => byKey.get(`${kind}:${id}`), lastImports: {} };
const find = (kind: string, name: string) => items.find((i) => i.kind === kind && i.name === name)!;
const details = (i: CatalogItem): CatalogDetails => (coreCatalogDetails(retail, i, input) ?? cubeCatalogDetails(retail, i, input))!;
const fact = (d: CatalogDetails, label: string) => d.facts.find((f) => f.label === label);
const group = (d: CatalogDetails, title: string) => d.groups.find((g) => g.title.startsWith(`${title} (`));

describe("the canvases that show an item (S39-05, Q9)", () => {
  it("lists every project's canvases with the item's card, projects in the order made, each in tab order", () => {
    const shown = canvasesShowing(retail, find("entity", "Customer"));
    const names = shown.map((c) => `${c.projectName} › ${c.canvasName}`);
    expect(names.slice(0, 2)).toEqual(["Customer 360 › Customer & orders", "Order management › Customer & orders"]);
    expect(new Set(names).size).toBe(names.length);
    expect(shown[0]!.query).toEqual({ entity: find("entity", "Customer").id });
  });

  it("puts a canvas with both ends first; selects a mapping, a row, a requirement by its own parameter", () => {
    const mapping = find("mapping", "customers.email_addr → Customer.email");
    const [first] = canvasesShowing(retail, mapping);
    expect(first!.whole).toBe(true);
    expect(first!.query).toEqual({ map: mapping.id });
    expect(canvasesShowing(retail, find("source_column", "cust_no"))[0]!.query).toEqual({ row: find("source_column", "cust_no").id });
    const req = find("requirement", "REQ-104 Order total equals the sum of its lines");
    expect(canvasesShowing(retail, req).map((c) => c.canvasName)).toContain("Customer & orders");
    expect(canvasesShowing(retail, req)[0]!.query).toEqual({ req: req.id });
  });

  it("finds none for an item on no card, and none for a classification (its home tab)", () => {
    expect(canvasesShowing(retail, find("requirement", "REQ-101 Single view of the customer"))).toEqual([]);
    const pii = items.find((i) => i.kind === "classification")!;
    expect(pii.open).toEqual({ tab: "conventions" });
    expect(canvasesShowing(retail, pii)).toEqual([]);
  });

  it("selects a concept through the first of its entities' cards", () => {
    const concept = items.find((i) => i.kind === "concept" && canvasesShowing(retail, i).length > 0)!;
    expect(canvasesShowing(retail, concept)[0]!.query.card).toMatch(/^entity:/);
  });
});

describe("each kind's details (S39-04)", () => {
  it("an entity: its concept as a link, its level, its attributes, relationships and requirements", () => {
    const d = details(find("entity", "Customer"));
    expect(fact(d, "Concept")!.links!.map((l) => l.name)).toEqual(["Customer"]);
    expect(fact(d, "Level")!.text).toBe("Logical");
    expect(group(d, "Attributes")!.links.map((l) => l.name)).toContain("email");
    expect(group(d, "Requirements")!.links.map((l) => l.name)).toContain("REQ-101 Single view of the customer");
    expect(d.texts[0]).toEqual({ title: "Definition", text: "A person or organisation that buys from us." });
  });

  it("an attribute: its personal data and mappings; a mapping: its source and target", () => {
    const d = details(find("attribute", "email"));
    expect(fact(d, "Personal data")!.text).toBe("Yes");
    expect(group(d, "Mappings")!.links).toHaveLength(2);
    const m = details(find("mapping", "customers.email_addr → Customer.email"));
    expect(fact(m, "Source")!.links!.map((l) => l.name)).toEqual(["email_addr"]);
    expect(fact(m, "Target")!.links!.map((l) => l.name)).toEqual(["email"]);
  });

  it("a relationship reads as the panel's sentences", () => {
    const rel = items.find((i) => i.kind === "relationship")!;
    const r = retail.model.relationships.find((x) => x.id === rel.id)!;
    const name = (id: string) => retail.model.entities.find((e) => e.id === id)!.name;
    expect(details(rel).texts[0]!.text).toBe(relationshipSentences(r, name(r.from_entity_id), name(r.to_entity_id)).join(" "));
  });

  it("a requirement: its owner from InfoMapper, what it traces to; a classification: what carries it, at most 50 listed", () => {
    const d = details(find("requirement", "REQ-102 Contact data for every active customer"));
    expect(fact(d, "Owner")).toMatchObject({ text: "Data owner CRM", note: "from InfoMapper" });
    expect(group(d, "Traced to")!.links.map((l) => l.name)).toEqual(["first_name", "last_name", "email"]);
    const pii = items.find((i) => i.kind === "classification" && i.name === "Personal data")!;
    const g = group(details(pii), "Carried by")!;
    expect(g.links.length).toBeLessThanOrEqual(GROUP_LIMIT);
    expect(g.links.every((l) => l.ref.kind === "source_column" || l.ref.kind === "source_table")).toBe(true);
  });

  it("a source table: its columns, the entities it feeds, its system's last import", () => {
    const t = find("source_table", "customers");
    const system = retail.model.sourceTables.find((x) => x.id === t.id)!.source_system_id;
    const d = coreCatalogDetails(retail, t, { ...input, lastImports: { [system]: AT.toISOString() } })!;
    expect(fact(d, "Physical name")!.text).toBe("CRM / crmprod.dbo.customers");
    expect(fact(d, "Last import")).toMatchObject({ time: AT.toISOString(), note: "of CRM" });
    expect(group(d, "Columns")!.links).toHaveLength(9);
    expect(group(d, "Entities it feeds")!.links.map((l) => l.name)).toContain("Customer");
    expect(fact(details(find("source_table", "web_users")), "Last import")!.text).toBe("Not imported");
  });

  it("every link of every item names an item the catalog has; InfoCube's kinds have their own details", () => {
    for (const i of items) {
      const d = details(i);
      expect(d, `${i.kind} ${i.name}`).toBeTruthy();
      for (const l of [...d.facts.flatMap((f) => f.links ?? []), ...d.groups.flatMap((g) => g.links)]) expect(byKey.has(`${l.ref.kind}:${l.ref.id}`), `${i.name} → ${l.name}`).toBe(true);
    }
    const fact1 = items.find((i) => i.kind === "fact")!;
    expect(group(details(fact1), "Measures")!.links.length).toBeGreaterThan(0);
  });
});
