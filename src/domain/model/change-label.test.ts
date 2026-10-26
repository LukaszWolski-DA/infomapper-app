import { describe, expect, it } from "vitest";
import { attribute, builtin, canvasItem, classificationLink, entity, frame, ids, makeCtx, mapping, mappingInput, ownClassification, requirement, requirementLink, sourceColumn, workspace } from "../__fixtures__/domain";
import { buildWriteSet, nextVersion, type Write } from "../changes";
import { changeCanvasId, changeLabel } from "./change-label";

const events = (writes: Write[]) => buildWriteSet(makeCtx(), ids.ws, writes).events;
const update = <T extends Write["table"]>(table: T, before: object, patch: object) =>
  ({ kind: "update", table, before, row: nextVersion(makeCtx(), before as never, patch as never) }) as unknown as Write;
const deleted = (table: Write["table"], before: object) => update(table, before, { deleted_at: "2026-10-02T12:00:00.000Z" });

describe("change labels for the undo history (slice 1b)", () => {
  it("names the thing acted on, not what came along", () => {
    expect(changeLabel(events([{ kind: "insert", table: "entity", row: entity() }, { kind: "insert", table: "canvas_item", row: canvasItem() }]))).toBe(
      "Create entity",
    );
    expect(changeLabel(events([deleted("mapping_input", mappingInput()), deleted("mapping", mapping()), deleted("attribute", attribute())]))).toBe(
      "Delete attribute",
    );
    expect(changeLabel(events([deleted("mapping_input", mappingInput()), deleted("mapping", mapping())]))).toBe("Delete mapping");
  });

  it("tells renames and other edits apart", () => {
    expect(changeLabel(events([update("entity", entity(), { name: "Client" })]))).toBe("Rename entity");
    expect(changeLabel(events([update("entity", entity(), { stereotype: "event" })]))).toBe("Change entity");
  });

  it("names layout changes of a card", () => {
    expect(changeLabel(events([update("canvas_item", canvasItem(), { x: 400, y: 80 })]))).toBe("Move card");
    expect(changeLabel(events([update("canvas_item", canvasItem(), { width: 320 })]))).toBe("Resize card");
    expect(changeLabel(events([update("canvas_item", canvasItem(), { collapsed: true })]))).toBe("Collapse card");
    expect(changeLabel(events([deleted("canvas_item", canvasItem())]))).toBe("Remove card");
    expect(
      changeLabel(events([{ kind: "insert", table: "canvas_item", row: canvasItem() }, { kind: "insert", table: "canvas_item", row: canvasItem(ids.itemCrmCustomer) }])),
    ).toBe("Place 2 cards");
  });

  it("names attribute order, mapping status, split and merge", () => {
    expect(changeLabel(events([update("attribute", attribute(), { sort_order: 3 }), update("attribute", attribute(ids.customerId), { sort_order: 7 })]))).toBe(
      "Reorder attributes",
    );
    expect(changeLabel(events([update("mapping", mapping(), { status: "approved" })]))).toBe("Set mapping status");
    expect(changeLabel(events([update("mapping", mapping(), { kind: "transform" }), { kind: "insert", table: "mapping", row: mapping({ id: ids.orderId }) }]))).toBe(
      "Split mapping",
    );
    expect(changeLabel(events([update("mapping", mapping(), { rule_expression: "x" }), deleted("mapping", mapping({ id: ids.orderId }))]))).toBe("Merge mappings");
  });
});

describe("the canvas of a change (slice 1b)", () => {
  it("is the canvas of its cards, or none for a model change", () => {
    expect(changeCanvasId(events([update("canvas_item", canvasItem(), { x: 400, y: 80 })]))).toBe(ids.canvas1);
    expect(changeCanvasId(events([{ kind: "insert", table: "entity", row: entity() }, { kind: "insert", table: "canvas_item", row: canvasItem() }]))).toBe(ids.canvas1);
    expect(changeCanvasId(events([update("entity", entity(), { name: "Client" })]))).toBeNull();
    expect(
      changeCanvasId(events([deleted("canvas_item", canvasItem()), deleted("canvas_item", canvasItem(ids.itemCrmCustomer, { canvas_id: ids.canvas2 }))])),
    ).toBeNull();
  });
});

describe("change labels for frames (slice 2b)", () => {
  const member = canvasItem(ids.itemCustomer, { frame_id: ids.frameA });
  const insert = (row: object) => ({ kind: "insert", table: "frame", row }) as unknown as Write;

  it("names frame steps", () => {
    expect(changeLabel(events([insert(frame()), update("canvas_item", canvasItem(), { frame_id: ids.frameA })]))).toBe("Create frame");
    expect(changeLabel(events([update("frame", frame(), { name: "Orders" })]))).toBe("Rename frame");
    expect(changeLabel(events([update("frame", frame(), { x: 8, y: 8 }), update("canvas_item", member, { x: 408, y: 128 })]))).toBe("Move frame");
    expect(changeLabel(events([update("frame", frame(), { width: 400 }), update("canvas_item", member, { frame_id: null })]))).toBe("Resize frame");
    expect(changeLabel(events([deleted("frame", frame()), update("canvas_item", member, { frame_id: null })]))).toBe("Delete frame");
    expect(changeLabel(events([insert(frame()), insert(frame(ids.frameB)), update("canvas_item", canvasItem(), { x: 32, y: 40, frame_id: ids.frameA })]))).toBe(
      "Arrange into frames",
    );
  });

  it("calls a drop into a frame a move, also when the frame grew", () => {
    expect(changeLabel(events([update("canvas_item", canvasItem(), { x: 8, y: 8, frame_id: ids.frameA })]))).toBe("Move card");
    expect(changeLabel(events([update("frame", frame(), { height: 900 }), update("canvas_item", canvasItem(), { x: 8, y: 700, frame_id: ids.frameA })]))).toBe(
      "Move card",
    );
  });

  it("names collapsing and expanding, one frame or all (slice 2c)", () => {
    expect(changeLabel(events([update("frame", frame(), { collapsed: true })]))).toBe("Collapse frame");
    expect(changeLabel(events([update("frame", frame(ids.frameA, { collapsed: true }), { collapsed: false })]))).toBe("Expand frame");
    expect(changeLabel(events([update("frame", frame(), { collapsed: true }), update("frame", frame(ids.frameB), { collapsed: true })]))).toBe("Collapse all frames");
    expect(
      changeLabel(events([update("frame", frame(ids.frameA, { collapsed: true }), { collapsed: false }), update("frame", frame(ids.frameB, { collapsed: true }), { collapsed: false })])),
    ).toBe("Expand all frames");
  });

  it("names requirement steps (slice 4a)", () => {
    const create = [update("workspace", workspace(), { requirement_key_next: 102 }), { kind: "insert", table: "requirement", row: requirement() } as unknown as Write];
    expect(changeLabel(events(create))).toBe("Create requirement");
    expect(changeLabel(events([{ kind: "insert", table: "requirement_link", row: requirementLink() } as unknown as Write]))).toBe("Link requirement");
    expect(changeLabel(events([update("requirement_link", requirementLink(), { deleted_at: "2026-10-13T10:00:00.000Z" })]))).toBe("Unlink requirement");
    expect(changeLabel(events([update("requirement", requirement(), { status: "agreed" })]))).toBe("Set requirement status");
    expect(changeLabel(events([update("requirement", requirement(), { name: "Unique e-mail" })]))).toBe("Rename requirement");
    expect(changeLabel(events([update("requirement", requirement(), { deleted_at: "2026-10-13T10:00:00.000Z" })]))).toBe("Delete requirement");
  });

  it("finds the canvas of a frame step", () => {
    expect(changeCanvasId(events([update("frame", frame(), { name: "Orders" })]))).toBe(ids.canvas1);
  });
});

describe("change labels for classifications and source notes (slice 7c)", () => {
  const golden = ownClassification("01900000-0000-7000-8000-c100000000c1", "Golden source", "table");
  const link = classificationLink(golden, { tableId: ids.crmCustomer });

  it("names the list's changes by the classification's name", () => {
    expect(changeLabel(events([{ kind: "insert", table: "classification", row: golden }]))).toBe("Add classification Golden source");
    expect(changeLabel(events([update("classification", golden, { name: "Golden", name_key: "golden" })]))).toBe("Rename classification Golden source");
    expect(changeLabel(events([deleted("classification_link", link), deleted("classification", golden)]))).toBe("Remove classification Golden source");
    const removed = { ...builtin("BK"), deleted_at: "2026-10-01T08:00:00.000Z" };
    expect(changeLabel(events([update("classification", removed, { deleted_at: null })]))).toBe("Restore classification Business key");
  });

  it("names a toggle, also with the changes it settles, and a note", () => {
    expect(changeLabel(events([{ kind: "insert", table: "classification_link", row: link }]))).toBe("Set classification");
    expect(changeLabel(events([deleted("classification_link", link)]))).toBe("Clear classification");
    expect(changeLabel(events([update("source_column", sourceColumn(ids.colEmail), { note_html: "<p>x</p>", note_text: "x" })]))).toBe("Edit note on email");
  });
});
