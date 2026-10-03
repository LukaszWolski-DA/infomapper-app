import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  ids,
  mapping,
  mappingInput,
  relationship,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { indexModel } from "./model-index";
import { canvasStatus, cardsPerCanvas, coverage, projectStats, workspaceStats } from "./stats";

// Customer (customer_id, email): email ← email (approved, fits); customer_id ← first_name (draft, a type problem).
// Sales Order has no attributes and is only on canvas 2.
const typeProblem = "01900000-0000-7000-8000-00000000a002";
const model: WorkspaceModel = {
  concepts: [concept()],
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email)],
  relationships: [relationship()],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping({ status: "approved" }), mapping({ id: typeProblem, attribute_id: ids.customerId, status: "draft" })],
  mappingInputs: [
    mappingInput(),
    mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: typeProblem, source_column_id: ids.colFirstName }),
  ],
};
const items = [
  canvasItem(ids.itemCustomer),
  canvasItem(ids.itemCrmCustomer),
  canvasItem("01900000-0000-7000-8000-00000000c003", { canvas_id: ids.canvas2, entity_id: ids.salesOrder }),
];
const ix = indexModel(model);

describe("counts around the model", () => {
  it("covers each entity on the canvas: attributes and how many are mapped", () => {
    expect(coverage(ix, [ids.customer, ids.salesOrder]).map((c) => [c.entity.name, c.mapped, c.attributes])).toEqual([
      ["Customer", 2, 2],
      ["Sales Order", 0, 0],
    ]);
  });

  it("fills the status bar: mapped on this canvas, mappings, drafts, type problems, relationships", () => {
    expect(canvasStatus(ix, [ids.customer])).toEqual({ attributes: 2, mapped: 2, mappings: 2, drafts: 1, typeProblems: 1, relationships: 1 });
    expect(canvasStatus(ix, [])).toMatchObject({ attributes: 0, mapped: 0, mappings: 2 });
  });

  it("counts the workspace: entities, tables, approved mappings, type problems", () => {
    expect(workspaceStats(model)).toEqual({ entities: 2, sourceTables: 1, mappings: 2, approved: 1, typeProblems: 1 });
  });

  it("counts a project by what is on its canvases", () => {
    expect(projectStats(model, items, [ids.canvas1])).toEqual({ entities: 1, sourceTables: 1, attributes: 2, mapped: 2 });
    expect(projectStats(model, items, [ids.canvas2])).toEqual({ entities: 1, sourceTables: 0, attributes: 0, mapped: 0 });
  });

  it("counts the cards of each canvas", () => {
    expect(Object.fromEntries(cardsPerCanvas(items))).toEqual({ [ids.canvas1]: 2, [ids.canvas2]: 1 });
  });
});
