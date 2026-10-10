// Slice 3a: what the existing commands do with label links and notes when the things they mark or hang on go
// (item 9, D-47 cascade), and that Duplicate layout copies no notes (Łukasz's step 0 answer 1).

import { describe, expect, it } from "vitest";
import {
  access,
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  frame,
  ids,
  labelLink,
  link,
  makeCtx,
  mapping,
  mappingInput,
  note,
  NOW,
  project,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "../__fixtures__/domain";
import type { Write, WriteSet } from "../changes";
import { changeLabel } from "../model/change-label";
import type { CommandResult } from "../changes";
import { deleteAttribute } from "./attribute";
import { deleteCanvas, duplicateCanvas } from "./canvas";
import { removeCanvasItems } from "./canvas-item";
import { arrangeCanvasIntoFrames, deleteFrame } from "./frame";
import { deleteMapping, mergeMappings } from "./mapping";
import { deleteSourceTable } from "./source";

const { canvas1, frameA, itemCustomer, itemCrmCustomer, noteFree, notePinned, linkCustomer, linkEmail, linkMapping, linkTable } = ids;
const modeler = access("modeler");

function ok<T>(r: CommandResult<T>): WriteSet {
  if (!r.ok) throw new Error(r.error.message);
  return r.writeSet;
}
const rowsOf = (ws: WriteSet, table: Write["table"]) => ws.writes.filter((w) => w.table === table).map((w) => (w.kind === "remove" ? w.before : w.row));

const links = [labelLink(linkCustomer), labelLink(linkEmail), labelLink(linkMapping), labelLink(linkTable), labelLink("01900000-0000-7000-8000-00000000a205", { source_table_id: null, label_id: ids.labelJira, source_column_id: ids.colEmail })];
const secondMapping = "01900000-0000-7000-8000-00000000a002";

describe("deleting model items takes their label links with them (D-47)", () => {
  it("an attribute: the links on it and on its mappings", () => {
    const ws = ok(deleteAttribute(makeCtx(), modeler, { attribute: attribute(ids.email), mappings: [mapping()], mappingInputs: [mappingInput()], labelLinks: links }, { attributeId: ids.email, expectedVersion: 1 }));
    expect(rowsOf(ws, "label_link")).toMatchObject([
      { id: linkEmail, deleted_at: NOW },
      { id: linkMapping, deleted_at: NOW },
    ]);
    expect(changeLabel(ws.events)).toBe("Delete attribute");
  });

  it("a mapping: the links on it", () => {
    const ws = ok(deleteMapping(makeCtx(), modeler, { mapping: mapping(), inputs: [mappingInput()], labelLinks: links }, { mappingId: ids.mapEmail, expectedVersion: 1 }));
    expect(rowsOf(ws, "label_link")).toMatchObject([{ id: linkMapping, deleted_at: NOW }]);
    expect(changeLabel(ws.events)).toBe("Delete mapping");
  });

  it("a merge: the links on the mappings that go, as the prototype drops them; the kept mapping keeps its own", () => {
    const other = mapping({ id: secondMapping });
    const input2 = mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: secondMapping, source_column_id: ids.colFirstName });
    const onOther = labelLink("01900000-0000-7000-8000-00000000a206", { entity_id: null, mapping_id: secondMapping });
    const ws = ok(
      mergeMappings(
        makeCtx(),
        modeler,
        { mappings: [mapping(), other], inputs: [mappingInput(), input2], labelLinks: [...links, onOther] },
        { mappings: [{ mappingId: ids.mapEmail, expectedVersion: 1 }, { mappingId: secondMapping, expectedVersion: 1 }], ruleExpression: "coalesce(a, b)" },
      ),
    );
    expect(rowsOf(ws, "label_link")).toMatchObject([{ id: onOther.id, deleted_at: NOW }]);
    expect(changeLabel(ws.events)).toBe("Merge mappings");
  });

  it("a source table: the links on it and its columns; notes pinned to its cards become free", () => {
    const ws = ok(
      deleteSourceTable(
        makeCtx(),
        modeler,
        {
          table: sourceTable(),
          columns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail)],
          canvasItems: [canvasItem(itemCrmCustomer, { x: 1200, y: 40 })],
          mappings: [],
          mappingInputs: [],
          attributes: [],
          entities: [],
          labelLinks: links,
          notes: [note(noteFree, { pin_canvas_item_id: itemCrmCustomer, x: 280, y: 0 })],
        },
        { sourceTableId: ids.crmCustomer, expectedVersion: 1 },
      ),
    );
    expect(rowsOf(ws, "label_link").map((k) => (k as { id: string }).id)).toEqual([linkTable, "01900000-0000-7000-8000-00000000a205"]);
    expect(rowsOf(ws, "note")).toMatchObject([{ id: noteFree, pin_canvas_item_id: null, x: 1480, y: 40, frame_id: null }]);
    expect(changeLabel(ws.events)).toBe("Delete source table");
  });
});

describe("cards leaving and frames going free their notes (item 9)", () => {
  const items = [canvasItem(itemCustomer, { frame_id: frameA }), canvasItem(itemCrmCustomer, { x: 1200 })];
  const frames = [frame(frameA)];
  const onFrame = note("01900000-0000-7000-8000-00000000d003", { pin_frame_id: frameA, x: 824, y: 0 });
  const inFrame = note("01900000-0000-7000-8000-00000000d004", { x: 100, y: 400, frame_id: frameA });
  const notes = [note(noteFree), note(notePinned), onFrame, inFrame];

  it("removing several cards frees the notes pinned to them, and is still “Remove 2 cards”", () => {
    const ws = ok(
      removeCanvasItems(makeCtx(), modeler, { canvas: canvas(), items, notes }, { canvasId: canvas1, items: [{ canvasItemId: itemCustomer, expectedVersion: 1 }, { canvasItemId: itemCrmCustomer, expectedVersion: 1 }] }),
    );
    expect(rowsOf(ws, "note")).toMatchObject([{ id: notePinned, x: 680, y: 120, pin_canvas_item_id: null }]);
    expect(changeLabel(ws.events)).toBe("Remove 2 cards");
  });

  it("deleting a frame frees the notes pinned to it and takes free notes out of it", () => {
    const ws = ok(deleteFrame(makeCtx(), modeler, { canvas: canvas(), frames, items, notes }, { frameId: frameA, expectedVersion: 1, cards: [{ canvasItemId: itemCustomer, expectedVersion: 1 }] }));
    expect(rowsOf(ws, "note")).toMatchObject([
      { id: onFrame.id, x: 824, y: 0, pin_frame_id: null, frame_id: null },
      { id: inFrame.id, x: 100, y: 400, frame_id: null },
    ]);
    expect(changeLabel(ws.events)).toBe("Delete frame");
  });

  it("arranging into frames frees the notes of the concept and source frames it rebuilds; free frames keep theirs", () => {
    const conceptFrame = frame(frameA, { kind: "concept", concept_id: ids.conceptCustomer, color: null });
    const ws = ok(
      arrangeCanvasIntoFrames(
        makeCtx(),
        modeler,
        { canvas: canvas(), frames: [conceptFrame], items, notes, entities: [entity(ids.customer)], sourceTables: [sourceTable()], concepts: [concept()], sourceSystems: [sourceSystem()] },
        { canvasId: canvas1, frames: [{ frameId: frameA, expectedVersion: 1 }], cards: [{ canvasItemId: itemCustomer, expectedVersion: 1, height: 200 }, { canvasItemId: itemCrmCustomer, expectedVersion: 1, height: 160 }] },
      ),
    );
    expect(rowsOf(ws, "note")).toMatchObject([
      { id: onFrame.id, pin_frame_id: null, frame_id: null },
      { id: inFrame.id, frame_id: null },
    ]);
  });

  it("deleting a canvas soft-deletes its notes with it", () => {
    const ws = ok(
      deleteCanvas(
        makeCtx(),
        modeler,
        { canvas: canvas(), project: project(), canvasLinks: [link(ids.projectA, canvas1)], projectLinks: [link(ids.projectA, canvas1), link(ids.projectA, ids.canvas2, 1)], items, frames, notes },
        { projectId: ids.projectA, canvasId: canvas1, expectedVersion: 2 },
      ),
    );
    expect(rowsOf(ws, "note").map((n) => (n as { deleted_at: string | null }).deleted_at)).toEqual([NOW, NOW, NOW, NOW]);
  });
});

describe("Duplicate layout (S3A-11)", () => {
  it("copies the cards and frames but no notes; the original's notes are untouched", () => {
    const ws = ok(
      duplicateCanvas(
        makeCtx(),
        modeler,
        { canvas: canvas(), project: project(), projectLinks: [link(ids.projectA, canvas1)], items: [canvasItem(itemCustomer)], frames: [frame(frameA)] },
        { projectId: ids.projectA, canvasId: canvas1 },
      ),
    );
    expect(ws.writes.map((w) => w.table)).toEqual(["canvas", "project_canvas", "frame", "canvas_item"]);
    expect(changeLabel(ws.events)).toBe("Duplicate canvas");
  });
});
