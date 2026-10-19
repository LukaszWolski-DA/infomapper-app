import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  frame,
  ids,
  mapping,
  mappingInput,
  note,
  NOW,
  relationship,
  requirement,
  requirementLink,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { indexModel } from "./model-index";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { canvasStatus, cardsPerCanvas, coverage, projectOpenNotes, projectRequirements, projectStats, workspaceStats } from "./stats";

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

describe("open notes on the project home (slice 3a, item 12, S3A-05)", () => {
  const canvases = [
    { id: ids.canvas2, name: "Second" },
    { id: ids.canvas1, name: "Customer & orders" },
  ];
  const items = [canvasItem(ids.itemCustomer)];
  const frames = [frame(ids.frameA, { name: "Sales" })];
  const n2 = "01900000-0000-7000-8000-00000000d003";
  const n3 = "01900000-0000-7000-8000-00000000d004";
  const n4 = "01900000-0000-7000-8000-00000000d005";
  const notes = [
    note(ids.noteFree, { created_at: "2026-10-02T00:00:00.000Z" }),
    note(ids.notePinned, { created_at: "2026-10-01T00:00:00.000Z", body_text: "" }),
    note(n2, { canvas_id: ids.canvas2, pin_canvas_item_id: null, pin_frame_id: ids.frameA }),
    note(n3, { status: "resolved" }),
    note(n4, { deleted_at: NOW }),
    note("01900000-0000-7000-8000-00000000d006", { canvas_id: "01900000-0000-7000-8000-0000000000ff" }),
  ];

  it("lists the open notes canvas by canvas in tab order, oldest first, with what each is pinned to", () => {
    expect(projectOpenNotes(notes, canvases, items, frames, model)).toEqual([
      { id: n2, text: "Check the e-mail source", canvasId: ids.canvas2, canvasName: "Second", pinName: "Sales" },
      { id: ids.notePinned, text: "", canvasId: ids.canvas1, canvasName: "Customer & orders", pinName: "Customer" },
      { id: ids.noteFree, text: "Check the e-mail source", canvasId: ids.canvas1, canvasName: "Customer & orders", pinName: null },
    ]);
  });

  it("is empty when no canvas of the project has an open note", () => {
    expect(projectOpenNotes([note(n3, { status: "resolved" })], canvases, items, frames, model)).toEqual([]);
  });
});

describe("requirements on the project home (slice 4a, PRD item 30)", () => {
  const ordersOnly = "01900000-0000-7000-8000-000000008009";
  const reqs = [
    requirement(ids.req101, { kind: "need", status: "agreed" }),
    requirement(ids.req102, { kind: "data" }),
    requirement(ids.req103, { kind: "dq_rule" }),
    requirement(ids.req104, { kind: "business_rule" }),
  ];
  const links = [
    // Customer is on canvas 1, Sales Order only on canvas 2, the CRM table on canvas 1
    requirementLink(ids.reqLink1, { requirement_id: ids.req101, attribute_id: ids.email }),
    requirementLink(ids.reqLink2, { requirement_id: ids.req102, attribute_id: null, entity_id: ids.salesOrder }),
    requirementLink(ids.reqLink3, { requirement_id: ids.req103, attribute_id: null, source_column_id: ids.colEmail }),
    requirementLink("01900000-0000-7000-8000-00000000e204", { requirement_id: ids.req104, attribute_id: null, source_table_id: ordersOnly }),
  ];
  const withOrders = { ...model, sourceTables: [...model.sourceTables, sourceTable({ id: ordersOnly, name: "orders" })] };
  const index = buildRequirementIndex(reqs, links, withOrders);

  it("lists the requirements whose scope has an entity or table on the project's canvases, with coverage and status", () => {
    expect(projectRequirements(index, items, [ids.canvas1]).map((r) => [r.key, `${r.covered}/${r.total}`, r.status, r.done])).toEqual([
      ["REQ-101", "1/1", "agreed", true],
      ["REQ-103", "0/0", "draft", false],
    ]);
    expect(projectRequirements(index, items, [ids.canvas1, ids.canvas2]).map((r) => r.key)).toEqual(["REQ-101", "REQ-102", "REQ-103"]);
    expect(projectRequirements(index, items, [])).toEqual([]);
  });

  it("the canvas that shows most of each, ties to the earlier one; a card counts one and lists its requirement (slice 4b-2, item 23, K)", () => {
    const both = [ids.canvas1, ids.canvas2];
    const best = (list: ReturnType<typeof projectRequirements>) => Object.fromEntries(list.map((r) => [r.key, r.bestCanvasId]));
    expect(best(projectRequirements(index, items, both))).toEqual({ "REQ-101": ids.canvas1, "REQ-102": ids.canvas2, "REQ-103": ids.canvas1 });
    expect(best(projectRequirements(index, items, [ids.canvas2, ids.canvas1]))["REQ-101"]).toBe(ids.canvas1);
    // REQ-104's table is on no canvas: its card on canvas 2 lists it and sends it there; REQ-101's card there ties with
    // canvas 1 (Customer), so the earlier canvas in the project's order wins
    const cards = [
      canvasItem("01900000-0000-7000-8000-00000000c901", { canvas_id: ids.canvas2, entity_id: null, requirement_id: ids.req104 }),
      canvasItem("01900000-0000-7000-8000-00000000c902", { canvas_id: ids.canvas2, entity_id: null, requirement_id: ids.req101 }),
    ];
    expect(best(projectRequirements(index, [...items, ...cards], both))).toEqual({ "REQ-101": ids.canvas1, "REQ-102": ids.canvas2, "REQ-103": ids.canvas1, "REQ-104": ids.canvas2 });
    expect(best(projectRequirements(index, [...items, ...cards], [ids.canvas2, ids.canvas1]))["REQ-101"]).toBe(ids.canvas2);
  });
});
