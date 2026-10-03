import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  ids,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { allGroups, buildTree, filterConcepts, filterSystems, isOpen, type TreeFilter } from "./tree-data";

// Customer (customer_id, email) on canvas 1; Sales Order on canvas 2 only; concept Sales holds Sales Order.
// CRM: crmprod.dbo.customer on canvas 1, crmprod.stage.orders nowhere.
const ordersTable = "01900000-0000-7000-8000-000000008002";
const model: WorkspaceModel = {
  concepts: [concept(), concept(ids.conceptSales)],
  entities: [entity(ids.customer), entity(ids.salesOrder, { concept_id: ids.conceptSales, stereotype: "link" })],
  attributes: [attribute(ids.customerId), attribute(ids.email)],
  relationships: [],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable(), sourceTable({ id: ordersTable, schema_name: "stage", name: "orders" })],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [],
  mappingInputs: [],
};
const items = [
  canvasItem(ids.itemCustomer),
  canvasItem(ids.itemCrmCustomer),
  canvasItem("01900000-0000-7000-8000-00000000c003", { canvas_id: ids.canvas2, entity_id: ids.salesOrder }),
];
// Customer 360 (project A) has canvas 1 only.
const tree = buildTree(model, items, ids.canvas1, [ids.canvas1]);
const all: TreeFilter = { q: "", canvasOnly: false };

describe("buildTree", () => {
  it("lists concepts with their entities, stereotypes and on-canvas state", () => {
    expect(tree.concepts.map((c) => [c.name, c.entities.map((e) => [e.name, e.stereotype, e.presence, e.cardId])])).toEqual([
      ["Customer", [["Customer", "Object", "here", ids.itemCustomer]]],
      ["Sales", [["Sales Order", "Link", "elsewhere", null]]],
    ]);
    expect(tree.concepts[0]!.entities[0]!.fields).toEqual(["customer_id", "email"]);
  });

  it("groups source tables by system and database.schema", () => {
    expect(tree.systems).toHaveLength(1);
    expect(tree.systems[0]!.schemas.map((s) => [s.name, s.tables.map((t) => [t.name, t.presence, t.fields.length])])).toEqual([
      ["crmprod.dbo", [["customer", "here", 3]]],
      ["crmprod.stage", [["orders", "none", 0]]],
    ]);
  });
});

describe("filtering the tree", () => {
  it("shows everything, empty concepts included, when not filtering", () => {
    const empty = { ...tree.concepts[1]!, id: "x", entities: [] };
    expect(filterConcepts([...tree.concepts, empty], all).map((g) => g.items.length)).toEqual([1, 1, 0]);
  });

  it("searches names and attribute names, and says which attribute matched", () => {
    const shown = filterConcepts(tree.concepts, { q: "EMAIL", canvasOnly: false });
    expect(shown).toHaveLength(1);
    expect(shown[0]!.items).toEqual([{ item: tree.concepts[0]!.entities[0], hint: "attribute email" }]);
    expect(filterConcepts(tree.concepts, { q: "order", canvasOnly: false })[0]!.items[0]!.hint).toBeNull();
  });

  it("searches table and column names", () => {
    const shown = filterSystems(tree.systems, { q: "first", canvasOnly: false });
    expect(shown[0]!.total).toBe(1);
    expect(shown[0]!.schemas[0]!.items[0]!.hint).toBe("column first_name");
    expect(filterSystems(tree.systems, { q: "nothing like this", canvasOnly: false })).toEqual([]);
  });

  it("“Only on this canvas” keeps what has a card here", () => {
    expect(filterConcepts(tree.concepts, { q: "", canvasOnly: true }).map((g) => g.concept.name)).toEqual(["Customer"]);
    const systems = filterSystems(tree.systems, { q: "", canvasOnly: true });
    expect(systems[0]!.schemas.map((s) => s.name)).toEqual(["crmprod.dbo"]);
  });

  it("“Only what this project uses” keeps what has a card on a canvas of the project", () => {
    expect(filterConcepts(tree.concepts, { q: "", canvasOnly: false, projectOnly: true }).map((g) => g.concept.name)).toEqual(["Customer"]);
    const wider = buildTree(model, items, ids.canvas1, [ids.canvas1, ids.canvas2]);
    expect(filterConcepts(wider.concepts, { q: "", canvasOnly: false, projectOnly: true }).map((g) => g.concept.name)).toEqual(["Customer", "Sales"]);
    expect(filterSystems(tree.systems, { q: "", canvasOnly: false, projectOnly: true })[0]!.total).toBe(1);
  });

  it("lists every group of a tab for collapse all and expand all", () => {
    expect(allGroups(tree, "model")).toEqual([`model:${ids.conceptCustomer}`, `model:${ids.conceptSales}`]);
    expect(allGroups(tree, "sources")).toEqual([`src:${ids.crm}`, `src:${ids.crm}/crmprod.dbo`, `src:${ids.crm}/crmprod.stage`]);
  });

  it("opens every group while searching, without forgetting which were folded", () => {
    const shut = new Set(["model:a"]);
    expect(isOpen(shut, "model:a", "")).toBe(false);
    expect(isOpen(shut, "model:a", "cust")).toBe(true);
    expect(isOpen(shut, "model:b", "")).toBe(true);
  });
});
