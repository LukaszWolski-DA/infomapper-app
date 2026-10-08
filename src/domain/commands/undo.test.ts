import { describe, expect, it } from "vitest";
import {
  access,
  archived,
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  ids,
  link,
  makeCtx,
  mapping,
  mappingInput,
  NOW,
  project,
  relationship,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "../__fixtures__/domain";
import { buildWriteSet, type CommandResult, type WriteSet } from "../changes";
import type { WorkspaceAccess } from "../permissions";
import type { Canvas, CanvasItem, ChangeEvent, WorkspaceRole } from "../types";
import { createAttributeFromColumn, deleteAttribute, reorderAttribute } from "./attribute";
import { deleteCanvas, duplicateCanvas, renameCanvas, setCanvasLook } from "./canvas";
import { removeFromCanvas } from "./canvas-item";
import { moveOnCanvas } from "./frame";
import { updateEntity } from "./entity";
import { deleteMapping, mergeMappings, setMappingStatus } from "./mapping";
import { createRelationship, deleteRelationship } from "./relationship";
import {
  isUndoable,
  NOT_UNDOABLE_MESSAGE,
  REDO_REFUSED_MESSAGE,
  revertChangeGroup,
  UNDO_REFUSED_MESSAGE,
  UNDOABLE_TABLES,
  type UndoableTable,
  type WorkspaceRows,
} from "./undo";
import { updateWorkspaceSettings } from "./workspace";

type Rows = { -readonly [T in UndoableTable]: WorkspaceRows[T][number][] };

/** The demo model of the fixtures: Customer and Sales Order, CRM customer with three columns, one mapping, two cards. */
function seed(): Rows {
  return {
    project: [project(ids.projectA), project(ids.projectB)],
    canvas: [canvas(ids.canvas1), canvas(ids.canvas2)],
    project_canvas: [link(ids.projectA, ids.canvas1), link(ids.projectB, ids.canvas2)],
    concept: [concept(ids.conceptCustomer), concept(ids.conceptSales)],
    entity: [entity(ids.customer), entity(ids.salesOrder)],
    attribute: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
    relationship: [relationship()],
    source_system: [sourceSystem()],
    source_table: [sourceTable()],
    source_column: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
    mapping: [mapping()],
    mapping_input: [mappingInput()],
    canvas_item: [canvasItem(ids.itemCustomer), canvasItem(ids.itemCrmCustomer)],
    frame: [],
  };
}

const keyOf = (table: UndoableTable, row: Record<string, unknown>) =>
  table === "project_canvas" ? `${String(row.project_id)}|${String(row.canvas_id)}` : String(row.id);

/** Applies a write set the way the adapter does (without its checks). */
function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows);
  for (const w of writeSet.writes) {
    const table = w.table as UndoableTable;
    const list = next[table] as unknown as Record<string, unknown>[];
    if (w.kind === "insert") list.push(structuredClone(w.row) as unknown as Record<string, unknown>);
    else {
      const key = keyOf(table, w.before as unknown as Record<string, unknown>);
      const index = list.findIndex((r) => keyOf(table, r) === key);
      if (w.kind === "remove") list.splice(index, 1);
      else list[index] = structuredClone(w.row) as unknown as Record<string, unknown>;
    }
  }
  return next;
}

function ok<T>(r: CommandResult<T>): WriteSet {
  if (!r.ok) throw new Error(r.error.message);
  return r.writeSet;
}

const modeler = access("modeler");
const ctx = makeCtx();
const as = (role: WorkspaceRole, ws = {}): WorkspaceAccess => access(role, ws);
const find = <T extends UndoableTable>(rows: Rows, table: T, id: string) => (rows[table] as unknown as Record<string, unknown>[]).find((r) => r.id === id)!;

/** The id of the first row a write set inserts. */
const insertedId = (writeSet: WriteSet): string => {
  const w = writeSet.writes[0]!;
  return w.kind === "insert" ? (w.row as { id?: string }).id ?? "" : "";
};

/** Renames Customer. */
const rename = (rows: Rows, name: string, expectedVersion: number, who: string = ids.actor) =>
  ok(updateEntity(makeCtx(who), modeler, { entity: find(rows, "entity", ids.customer) as never, entities: rows.entity, concept: null }, { entityId: ids.customer, expectedVersion, name }));

/** Runs a command on `rows`, then undoes it; returns the states and the groups. */
function doAndUndo(rows: Rows, run: (rows: Rows) => WriteSet, who: WorkspaceAccess = modeler) {
  const done = run(rows);
  const afterDo = apply(rows, done);
  const undone = revertChangeGroup(makeCtx(), who, { events: done.events, rows: afterDo }, "undo");
  return { done, afterDo, undone, afterUndo: undone.ok ? apply(afterDo, undone.writeSet) : afterDo };
}

/** The rows without the bookkeeping columns that undo changes (version, updated_*), to compare states. */
const content = (rows: Rows) =>
  Object.fromEntries(
    UNDOABLE_TABLES.map((t) => [
      t,
      (rows[t] as unknown as Record<string, unknown>[])
        .map((row) => {
          const rest = { ...row };
          for (const k of ["version", "updated_at", "updated_by"]) delete rest[k];
          return rest;
        })
        .sort((a, b) => keyOf(t, a).localeCompare(keyOf(t, b))),
    ]),
  );

describe("undo and redo (slice 1b)", () => {
  it("undoes a create by deleting the row, and redoes it by restoring it", () => {
    const rows = seed();
    const { done, undone, afterUndo } = doAndUndo(rows, (r) =>
      ok(createRelationship(ctx, modeler, { from: find(r, "entity", ids.customer) as never, to: find(r, "entity", ids.salesOrder) as never }, { fromEntityId: ids.customer, toEntityId: ids.salesOrder })),
    );
    if (!undone.ok) throw new Error(undone.error.message);
    const id = insertedId(done);
    expect(find(afterUndo, "relationship", id)).toMatchObject({ deleted_at: NOW, version: 2 });
    expect(undone.writeSet.events).toMatchObject([{ operation: "delete", object_type: "relationship", object_id: id }]);
    expect(undone.value.changeGroupId).toBe(undone.writeSet.changeGroupId);
    expect(undone.writeSet.changeGroupId).not.toBe(done.changeGroupId);

    const redone = revertChangeGroup(makeCtx(), modeler, { events: undone.writeSet.events, rows: afterUndo }, "redo");
    if (!redone.ok) throw new Error(redone.error.message);
    expect(find(apply(afterUndo, redone.writeSet), "relationship", id)).toMatchObject({ deleted_at: null, version: 3 });
    expect(redone.writeSet.events).toMatchObject([{ operation: "restore" }]);
  });

  it("undoes an edit with the before-image, as a new version", () => {
    const rows = seed();
    const { afterUndo, undone } = doAndUndo(rows, (r) =>
      rename(r, "Client", 1),
    );
    expect(undone.ok).toBe(true);
    expect(find(afterUndo, "entity", ids.customer)).toMatchObject({ name: "Customer", version: 3, updated_by: ids.actor, updated_at: NOW });
    expect(undone.ok && undone.writeSet.events[0]).toMatchObject({ operation: "update", before_image: { name: "Client", version: 2 }, after_image: { name: "Customer", version: 3 } });
  });

  it("undoes a delete by restoring, and the state is the one before", () => {
    const rows = seed();
    const { afterUndo } = doAndUndo(rows, (r) =>
      ok(deleteRelationship(ctx, modeler, { relationship: find(r, "relationship", ids.relPlaces) as never }, { relationshipId: ids.relPlaces, expectedVersion: 1 })),
    );
    expect(content(afterUndo)).toEqual(content(rows));
  });

  it("undoes a reorder, a new attribute from a column and a merge completely", () => {
    const rows = seed();
    const reorder = doAndUndo(rows, (r) =>
      ok(reorderAttribute(ctx, modeler, { attribute: find(r, "attribute", ids.email) as never, attributes: r.attribute }, { attributeId: ids.email, expectedVersion: 1, position: 0 })),
    );
    expect(reorder.undone.ok).toBe(true);
    expect(content(reorder.afterUndo)).toEqual(content(rows));

    const fromColumn = doAndUndo(rows, (r) =>
      ok(
        createAttributeFromColumn(
          ctx,
          modeler,
          { entity: find(r, "entity", ids.salesOrder) as never, attributes: r.attribute, column: find(r, "source_column", ids.colFirstName) as never, mappings: r.mapping, mappingInputs: r.mapping_input },
          { entityId: ids.salesOrder, sourceColumnId: ids.colFirstName },
        ),
      ),
    );
    expect(fromColumn.undone.ok && fromColumn.undone.writeSet.events.map((e) => [e.object_type, e.operation])).toEqual([
      ["mapping_input", "delete"],
      ["mapping", "delete"],
      ["attribute", "delete"],
    ]);

    const map2 = "01900000-0000-7000-8000-00000000a002";
    const withTwo = { ...seed() };
    withTwo.mapping = [...withTwo.mapping, mapping({ id: map2 })];
    withTwo.mapping_input = [...withTwo.mapping_input, mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: map2, source_column_id: ids.colFirstName })];
    const merge = doAndUndo(withTwo, (r) =>
      ok(mergeMappings(ctx, modeler, { mappings: r.mapping, inputs: r.mapping_input }, { mappings: [{ mappingId: ids.mapEmail, expectedVersion: 1 }, { mappingId: map2, expectedVersion: 1 }], ruleExpression: "r" })),
    );
    expect(merge.undone.ok).toBe(true);
    expect(content(merge.afterUndo)).toEqual(content(withTwo));
  });

  it("is refused when a row of the step changed afterwards (another person or a later change)", () => {
    const rows = seed();
    const renamed = rename(rows, "Client", 1);
    const afterRename = apply(rows, renamed);
    const later = rename(afterRename, "Buyer", 2, ids.someoneElse);
    const afterLater = apply(afterRename, later);
    expect(revertChangeGroup(makeCtx(), modeler, { events: renamed.events, rows: afterLater }, "undo")).toEqual({
      ok: false,
      error: { code: "conflict", message: UNDO_REFUSED_MESSAGE },
    });
  });

  it("refuses a redo when the row changed after the undo", () => {
    const rows = seed();
    const { undone, afterUndo } = doAndUndo(rows, (r) =>
      rename(r, "Client", 1),
    );
    if (!undone.ok) throw new Error(undone.error.message);
    const later = rename(afterUndo, "Buyer", 3, ids.someoneElse);
    expect(revertChangeGroup(makeCtx(), modeler, { events: undone.writeSet.events, rows: apply(afterUndo, later) }, "redo")).toMatchObject({
      ok: false,
      error: { code: "conflict", message: REDO_REFUSED_MESSAGE },
    });
  });

  it("is refused when undoing a create would leave live rows pointing at the deleted row", () => {
    const rows = seed();
    const made = ok(
      createAttributeFromColumn(
        ctx,
        modeler,
        { entity: find(rows, "entity", ids.salesOrder) as never, attributes: rows.attribute, column: find(rows, "source_column", ids.colFirstName) as never, mappings: rows.mapping, mappingInputs: rows.mapping_input },
        { entityId: ids.salesOrder, sourceColumnId: ids.colFirstName },
      ),
    );
    const afterMade = apply(rows, made);
    const attributeId = insertedId(made);
    // someone maps another column to the new attribute: the attribute row itself did not change
    const second = mapping({ id: "01900000-0000-7000-8000-00000000a009", attribute_id: attributeId, created_by: ids.someoneElse });
    const afterSecond = { ...afterMade, mapping: [...afterMade.mapping, second] };
    expect(revertChangeGroup(makeCtx(), modeler, { events: made.events, rows: afterSecond }, "undo")).toMatchObject({
      ok: false,
      error: { message: UNDO_REFUSED_MESSAGE },
    });
  });

  it("is refused when undoing a delete would bring back a row whose parent was deleted afterwards", () => {
    const rows = seed();
    const del = ok(deleteMapping(ctx, modeler, { mapping: find(rows, "mapping", ids.mapEmail) as never, inputs: rows.mapping_input }, { mappingId: ids.mapEmail, expectedVersion: 1 }));
    const afterDel = apply(rows, del);
    const attrGone = ok(deleteAttribute(makeCtx(ids.someoneElse), modeler, { attribute: find(afterDel, "attribute", ids.email) as never, mappings: afterDel.mapping, mappingInputs: afterDel.mapping_input }, { attributeId: ids.email, expectedVersion: 1 }));
    expect(revertChangeGroup(makeCtx(), modeler, { events: del.events, rows: apply(afterDel, attrGone) }, "undo")).toMatchObject({
      ok: false,
      error: { message: UNDO_REFUSED_MESSAGE },
    });
  });

  it("is refused when a removed card would come back next to the same card added again", () => {
    const rows = seed();
    const removed = ok(removeFromCanvas(ctx, modeler, { item: find(rows, "canvas_item", ids.itemCustomer) as never } as never, { canvasItemId: ids.itemCustomer, expectedVersion: 1 }));
    const afterRemove = apply(rows, removed);
    const again = canvasItem("01900000-0000-7000-8000-00000000c009", { entity_id: ids.customer });
    expect(revertChangeGroup(makeCtx(), modeler, { events: removed.events, rows: { ...afterRemove, canvas_item: [...afterRemove.canvas_item, again] } }, "undo")).toMatchObject({
      ok: false,
      error: { message: UNDO_REFUSED_MESSAGE },
    });
    expect(revertChangeGroup(makeCtx(), modeler, { events: removed.events, rows: afterRemove }, "undo").ok).toBe(true);
  });

  it("removes and restores project links, keeping at least one project per canvas and one canvas per project (D-28)", () => {
    const rows = seed();
    const added = buildWriteSet(ctx, ids.ws, [{ kind: "insert", table: "project_canvas", row: link(ids.projectA, ids.canvas2, 1) }]);
    const afterAdd = apply(rows, added);
    const undone = revertChangeGroup(makeCtx(), modeler, { events: added.events, rows: afterAdd }, "undo");
    if (!undone.ok) throw new Error(undone.error.message);
    expect(undone.writeSet.writes).toMatchObject([{ kind: "remove", table: "project_canvas" }]);
    const redone = revertChangeGroup(makeCtx(), modeler, { events: undone.writeSet.events, rows: apply(afterAdd, undone.writeSet) }, "redo");
    expect(redone.ok && redone.writeSet.writes).toMatchObject([{ kind: "insert", table: "project_canvas", row: { project_id: ids.projectA, canvas_id: ids.canvas2 } }]);

    // canvas 2's other link went meanwhile: undoing the add would leave canvas 2 without a project
    const alone = { ...afterAdd, project_canvas: afterAdd.project_canvas.filter((l) => l.project_id !== ids.projectB) };
    expect(revertChangeGroup(makeCtx(), modeler, { events: added.events, rows: alone }, "undo")).toMatchObject({ ok: false, error: { message: UNDO_REFUSED_MESSAGE } });
  });

  describe("permissions and the archive", () => {
    const statusChange = (who: string) => {
      const rows = seed();
      const r = setMappingStatus(makeCtx(who), access("reviewer"), { mapping: find(rows, "mapping", ids.mapEmail) as never, contentAuthorId: ids.someoneElse }, { mappingId: ids.mapEmail, expectedVersion: 1, status: "approved" });
      return { rows: apply(rows, ok(r)), events: ok(r).events };
    };

    it("lets a reviewer undo their own status change", () => {
      const { rows, events } = statusChange(ids.actor);
      const r = revertChangeGroup(makeCtx(), as("reviewer"), { events, rows }, "undo");
      expect(r.ok && r.writeSet.writes).toMatchObject([{ table: "mapping", row: { status: "draft", approved_by: null, version: 3 } }]);
    });

    it("refuses a reviewer any other step, and anyone another person's step", () => {
      const rows = seed();
      const renamed = rename(rows, "Client", 1);
      expect(revertChangeGroup(makeCtx(), as("reviewer"), { events: renamed.events, rows: apply(rows, renamed) }, "undo")).toMatchObject({ ok: false, error: { code: "forbidden" } });
      const { rows: r2, events } = statusChange(ids.someoneElse);
      expect(revertChangeGroup(makeCtx(), as("owner"), { events, rows: r2 }, "undo")).toMatchObject({
        ok: false,
        error: { code: "forbidden", message: "You can only undo your own changes." },
      });
    });

    it("refuses readers and an archived workspace", () => {
      const { rows, events } = statusChange(ids.actor);
      expect(revertChangeGroup(makeCtx(), as("reader"), { events, rows }, "undo")).toMatchObject({ ok: false, error: { code: "forbidden" } });
      expect(revertChangeGroup(makeCtx(), as("owner", archived), { events, rows }, "undo")).toMatchObject({ ok: false, error: { code: "archived" } });
    });
  });

  describe("what can be undone", () => {
    it("the model and the layout, not workspace settings, people or a canvas's look (D-12)", () => {
      const settings = ok(updateWorkspaceSettings(ctx, as("owner"), { workspaceId: ids.ws, expectedVersion: 3, name: "Retail DWH" }));
      expect(isUndoable(settings.events)).toBe(false);
      expect(revertChangeGroup(makeCtx(), as("owner"), { events: settings.events, rows: seed() }, "undo")).toMatchObject({
        ok: false,
        error: { code: "invalid", message: NOT_UNDOABLE_MESSAGE },
      });
      const look: ChangeEvent[] = buildWriteSet(ctx, ids.ws, [
        { kind: "update", table: "canvas", before: canvas(), row: { ...canvas(), look: { ...canvas().look, grid: "none" }, version: 3 } },
      ]).events;
      expect(isUndoable(look)).toBe(false);
      expect(isUndoable([])).toBe(false);
      const rows = seed();
      expect(isUndoable(ok(deleteRelationship(ctx, modeler, { relationship: find(rows, "relationship", ids.relPlaces) as never }, { relationshipId: ids.relPlaces, expectedVersion: 1 })).events)).toBe(true);
    });
  });
});

describe("undo and a canvas's look and layer mode (slice 2a, D-12)", () => {
  const c = makeCtx();
  const undo = (rows: Rows, events: readonly ChangeEvent[]) => {
    const r = revertChangeGroup(c, modeler, { events, rows }, "undo");
    if (!r.ok) throw new Error(r.error.message);
    return { rows: apply(rows, r.writeSet), writeSet: r.writeSet };
  };
  const canvasOf = (rows: Rows, id: string) => find(rows, "canvas", id) as unknown as Canvas;
  const itemsOn = (rows: Rows, canvasId: string) => rows.canvas_item.filter((i) => i.canvas_id === canvasId && i.deleted_at === null);
  const look = (rows: Rows, canvasId: string, change: object) =>
    ok(setCanvasLook(c, modeler, { canvas: canvasOf(rows, canvasId) }, { canvasId, expectedVersion: canvasOf(rows, canvasId).version, ...change }));

  it("duplicate, change the copy's look and layer, delete it, undo the delete: the copy comes back with its cards, link and look", () => {
    let rows = seed();
    const duplicated = duplicateCanvas(c, modeler, { canvas: canvasOf(rows, ids.canvas1), project: find(rows, "project", ids.projectA) as never, projectLinks: rows.project_canvas, items: rows.canvas_item }, { projectId: ids.projectA, canvasId: ids.canvas1 });
    if (!duplicated.ok) throw new Error(duplicated.error.message);
    const copyId = duplicated.value.canvasId;
    rows = apply(rows, duplicated.writeSet);
    expect(itemsOn(rows, copyId)).toHaveLength(2);

    rows = apply(rows, look(rows, copyId, { background: "warm", grid: "lines", layer: "relationships" }));
    const changedLook = { background: "warm", grid: "lines", layer: "relationships" };
    expect(canvasOf(rows, copyId).look).toEqual(changedLook);

    const copy = canvasOf(rows, copyId);
    const deleted = ok(
      deleteCanvas(c, modeler, { canvas: copy, project: find(rows, "project", ids.projectA) as never, canvasLinks: rows.project_canvas.filter((l) => l.canvas_id === copyId), projectLinks: rows.project_canvas.filter((l) => l.project_id === ids.projectA), items: rows.canvas_item, frames: rows.frame }, { projectId: ids.projectA, canvasId: copyId, expectedVersion: copy.version }),
    );
    rows = apply(rows, deleted);
    expect(canvasOf(rows, copyId).deleted_at).toBe(NOW);
    expect(itemsOn(rows, copyId)).toHaveLength(0);
    expect(rows.project_canvas.some((l) => l.canvas_id === copyId)).toBe(false);

    rows = undo(rows, deleted.events).rows;
    expect(canvasOf(rows, copyId)).toMatchObject({ deleted_at: null, look: changedLook });
    expect(itemsOn(rows, copyId)).toHaveLength(2);
    expect(rows.project_canvas.some((l) => l.canvas_id === copyId && l.project_id === ids.projectA)).toBe(true);
  });

  it("duplicate, change the copy's look: undo of the duplicate still removes the copy, its cards and its link", () => {
    let rows = seed();
    const duplicated = ok(duplicateCanvas(c, modeler, { canvas: canvasOf(rows, ids.canvas1), project: find(rows, "project", ids.projectA) as never, projectLinks: rows.project_canvas, items: rows.canvas_item }, { projectId: ids.projectA, canvasId: ids.canvas1 }));
    rows = apply(rows, duplicated);
    const copyId = insertedId(duplicated);
    rows = apply(rows, look(rows, copyId, { grid: "none", layer: "mappings" }));

    rows = undo(rows, duplicated.events).rows;
    expect(canvasOf(rows, copyId).deleted_at).toBe(NOW);
    expect(itemsOn(rows, copyId)).toHaveLength(0);
    expect(rows.project_canvas.some((l) => l.canvas_id === copyId)).toBe(false);
    expect(itemsOn(rows, ids.canvas1)).toHaveLength(2);
  });

  it("a rename followed by a layer change: undo of the rename brings the name back and keeps the new layer", () => {
    let rows = seed();
    const before = canvasOf(rows, ids.canvas1);
    const renamed = ok(renameCanvas(c, modeler, { canvas: before }, { canvasId: ids.canvas1, expectedVersion: before.version, name: "Customers" }));
    rows = apply(rows, renamed);
    rows = apply(rows, look(rows, ids.canvas1, { layer: "mappings" }));
    const versionBeforeUndo = canvasOf(rows, ids.canvas1).version;

    const undone = undo(rows, renamed.events);
    expect(canvasOf(undone.rows, ids.canvas1)).toMatchObject({ name: before.name, look: { ...before.look, layer: "mappings" }, version: versionBeforeUndo + 1 });
    expect(undone.writeSet.events).toMatchObject([{ object_type: "canvas", operation: "update" }]);

    // and redo puts the name back, still with the new layer
    const redone = revertChangeGroup(c, modeler, { events: undone.writeSet.events, rows: undone.rows }, "redo");
    if (!redone.ok) throw new Error(redone.error.message);
    expect(canvasOf(apply(undone.rows, redone.writeSet), ids.canvas1)).toMatchObject({ name: "Customers", look: { layer: "mappings" } });
  });

  it("a later change of anything besides the look still counts as changed afterwards", () => {
    let rows = seed();
    const renamed = ok(renameCanvas(c, modeler, { canvas: canvasOf(rows, ids.canvas1) }, { canvasId: ids.canvas1, expectedVersion: 2, name: "Customers" }));
    rows = apply(rows, renamed);
    const again = ok(renameCanvas(makeCtx(ids.someoneElse), modeler, { canvas: canvasOf(rows, ids.canvas1) }, { canvasId: ids.canvas1, expectedVersion: 3, name: "Clients" }));
    rows = apply(rows, again);
    rows = apply(rows, look(rows, ids.canvas1, { grid: "none" }));
    expect(revertChangeGroup(c, modeler, { events: renamed.events, rows }, "undo")).toMatchObject({ ok: false, error: { message: UNDO_REFUSED_MESSAGE } });
  });
});

describe("“changed afterwards” compares content, not version (slice 2a fix of slice 1b)", () => {
  const entityName = (rows: Rows) => (find(rows, "entity", ids.customer) as { name: string }).name;
  const versionOf = (rows: Rows, table: UndoableTable, id: string) => (find(rows, table, id) as { version: number }).version;
  const revert = (rows: Rows, events: readonly ChangeEvent[], mode: "undo" | "redo") => {
    const r = revertChangeGroup(makeCtx(), modeler, { events, rows }, mode);
    if (!r.ok) throw new Error(`${mode}: ${r.error.message}`);
    return { rows: apply(rows, r.writeSet), writeSet: r.writeSet };
  };

  it("rename twice, undo twice, redo twice", () => {
    let rows = seed();
    const original = entityName(rows);
    const first = rename(rows, "Client", versionOf(rows, "entity", ids.customer));
    rows = apply(rows, first);
    const second = rename(rows, "Party", versionOf(rows, "entity", ids.customer));
    rows = apply(rows, second);

    const undoSecond = revert(rows, second.events, "undo");
    expect(entityName(undoSecond.rows)).toBe("Client");
    const undoFirst = revert(undoSecond.rows, first.events, "undo");
    expect(entityName(undoFirst.rows)).toBe(original);

    const redoFirst = revert(undoFirst.rows, undoFirst.writeSet.events, "redo");
    expect(entityName(redoFirst.rows)).toBe("Client");
    const redoSecond = revert(redoFirst.rows, undoSecond.writeSet.events, "redo");
    expect(entityName(redoSecond.rows)).toBe("Party");
  });

  it("move a card twice, undo twice: back where it started", () => {
    let rows = seed();
    const move = (x: number, y: number) => {
      const item = find(rows, "canvas_item", ids.itemCustomer) as unknown as CanvasItem;
      const state = { canvas: find(rows, "canvas", ids.canvas1) as never, frames: [], items: [item], entities: rows.entity, concepts: rows.concept };
      return ok(moveOnCanvas(makeCtx(), modeler, state, { canvasId: ids.canvas1, frames: [], items: [{ canvasItemId: ids.itemCustomer, expectedVersion: item.version, x, y, height: 200 }] }));
    };
    const start = find(rows, "canvas_item", ids.itemCustomer);
    const m1 = move(480, 200);
    rows = apply(rows, m1);
    const m2 = move(560, 240);
    rows = apply(rows, m2);
    rows = revert(rows, m2.events, "undo").rows;
    expect(find(rows, "canvas_item", ids.itemCustomer)).toMatchObject({ x: 480, y: 200 });
    rows = revert(rows, m1.events, "undo").rows;
    expect(find(rows, "canvas_item", ids.itemCustomer)).toMatchObject({ x: start.x, y: start.y });
  });

  it("undo a delete of a duplicated canvas, then undo the duplicate", () => {
    let rows = seed();
    const canvasOf = (id: string) => find(rows, "canvas", id) as unknown as Canvas;
    const duplicated = ok(duplicateCanvas(makeCtx(), modeler, { canvas: canvasOf(ids.canvas1), project: find(rows, "project", ids.projectA) as never, projectLinks: rows.project_canvas, items: rows.canvas_item }, { projectId: ids.projectA, canvasId: ids.canvas1 }));
    rows = apply(rows, duplicated);
    const copyId = insertedId(duplicated);
    const copy = canvasOf(copyId);
    const deleted = ok(
      deleteCanvas(makeCtx(), modeler, { canvas: copy, project: find(rows, "project", ids.projectA) as never, canvasLinks: rows.project_canvas.filter((l) => l.canvas_id === copyId), projectLinks: rows.project_canvas.filter((l) => l.project_id === ids.projectA), items: rows.canvas_item, frames: rows.frame }, { projectId: ids.projectA, canvasId: copyId, expectedVersion: copy.version }),
    );
    rows = apply(rows, deleted);
    rows = revert(rows, deleted.events, "undo").rows;
    expect(canvasOf(copyId).deleted_at).toBeNull();
    rows = revert(rows, duplicated.events, "undo").rows;
    expect(canvasOf(copyId).deleted_at).toBe(NOW);
    expect(rows.canvas_item.filter((i) => i.canvas_id === copyId && i.deleted_at === null)).toHaveLength(0);
    expect(rows.project_canvas.some((l) => l.canvas_id === copyId)).toBe(false);
  });

  it("another session's rename still blocks the undo", () => {
    let rows = seed();
    const mine = rename(rows, "Client", versionOf(rows, "entity", ids.customer));
    rows = apply(rows, mine);
    rows = apply(rows, rename(rows, "Party", versionOf(rows, "entity", ids.customer), ids.someoneElse));
    expect(revertChangeGroup(makeCtx(), modeler, { events: mine.events, rows }, "undo")).toMatchObject({ ok: false, error: { message: UNDO_REFUSED_MESSAGE } });
  });

  it("a row changed and changed back (A-B-A) counts as unchanged, and the write carries the row's current version", () => {
    let rows = seed();
    const mine = rename(rows, "Client", versionOf(rows, "entity", ids.customer));
    rows = apply(rows, mine);
    rows = apply(rows, rename(rows, "Party", versionOf(rows, "entity", ids.customer), ids.someoneElse));
    rows = apply(rows, rename(rows, "Client", versionOf(rows, "entity", ids.customer), ids.someoneElse));
    const current = versionOf(rows, "entity", ids.customer);
    const undone = revertChangeGroup(makeCtx(), modeler, { events: mine.events, rows }, "undo");
    if (!undone.ok) throw new Error(undone.error.message);
    // the adapter refuses the write if the stored row is no longer at this version (AD-12)
    expect(undone.writeSet.writes).toMatchObject([{ kind: "update", table: "entity", before: { version: current }, row: { version: current + 1 } }]);
  });
});
