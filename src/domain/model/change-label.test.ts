import { describe, expect, it } from "vitest";
import { attribute, canvasItem, entity, ids, makeCtx, mapping, mappingInput } from "../__fixtures__/domain";
import { buildWriteSet, nextVersion, type Write } from "../changes";
import { changeLabel } from "./change-label";

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
