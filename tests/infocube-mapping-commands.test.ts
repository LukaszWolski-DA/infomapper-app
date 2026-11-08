// InfoCube's dimensional mapping commands on the Sales star (slice 15c step 3): create by a drop on a row and on a
// header, the drop's plan in both directions and its refusals, the panel's edits (inputs, kind, rule, note, target,
// status, delete), D-51's first rule with its undo, four-eyes through the change log (`CUBE_MAPPING_LOG`), "Create
// dimension from this…" with its undo, and the derived reads (feeds, the cards' feeds, the delete previews' rows).

import { describe, expect, it } from "vitest";
import { UNDO_TABLES } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { CommandContext, CommandResult, WriteSet } from "@/domain/changes";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { member, workspace } from "@/domain/__fixtures__/domain";
import { BACK_TO_REVIEW_MESSAGE, FOUR_EYES_MESSAGE, lastContentEditor, MAPPING_LOG } from "@/domain/model/mapping-rules";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Attribute, CanvasItem, ChangeEvent, Entity, Relationship, WorkspaceRole } from "@/domain/types";
import { attributeDeletes, entityDependents } from "@/modules/infocube/domain/view";
import { cubeIndex } from "@/modules/infocube/domain/keys";
import {
  ALREADY_READS,
  addCubeMappingInput,
  CUBE_MAPPING_LOG,
  createCubeMapping,
  createDimensionFrom,
  createOnHeader,
  deleteCubeMapping,
  DIMENSIONAL_TO_COLUMN,
  DIMENSIONAL_TO_DIMENSIONAL,
  DIRECT_READS_ONE,
  fedCount,
  fedFrom,
  feedsOf,
  LAST_INPUT,
  LOGICAL_TO_LOGICAL,
  MAPPING_EXISTS,
  MAPPING_EXISTS_SELECTED,
  mappingDependents,
  mappingIndex,
  planDrop,
  removeCubeMappingInput,
  retargetCubeMapping,
  rowFeeds,
  setCubeMappingStatus,
  updateCubeMapping,
  type MappingModel,
} from "@/modules/infocube/domain/mappings";
import type { CubeEntity, CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
const ANNA = "01900000-0000-7000-8000-00000000a001";
type Rows = Record<string, Record<string, unknown>[]>;

function starRows(): Rows {
  const db = buildSeed() as unknown as Rows;
  addModuleDemoData(db as never);
  return Object.fromEntries(Object.entries(db).filter(([k]) => Array.isArray(db[k])).map(([k, rows]) => [k, rows.filter((r) => r.workspace_id === WS)]));
}

function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows);
  for (const w of writeSet.writes) {
    const list = (next[w.table] ??= []);
    if (w.kind === "insert") list.push(structuredClone(w.row) as unknown as Record<string, unknown>);
    else if (w.kind === "update") {
      const id = (w.before as unknown as { id: string }).id;
      list[list.findIndex((r) => r.id === id)] = structuredClone(w.row) as unknown as Record<string, unknown>;
    }
  }
  return next;
}

let serial = 0;
/** A context whose ids never repeat across the commands of one test (the fixtures' `makeCtx` starts again at 1). */
function ctxOf(actorId: string = SEED_IDS.userLukasz, now = "2026-11-05T12:00:00.000Z"): CommandContext {
  return { actorId, now, newId: () => `01900000-0000-7000-8000-d${String(++serial).padStart(11, "0")}` };
}
const ok = <T>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};
const as = (role: WorkspaceRole, userId: string = SEED_IDS.userLukasz, fourEyes = false): WorkspaceAccess => ({
  workspace: workspace({ id: WS, infocube: true, four_eyes: fourEyes, organization_id: SEED_IDS.orgRetailCo }),
  member: member(role, { workspace_id: WS, user_id: userId }),
});
const modeler = () => as("modeler");

const live = <T extends { deleted_at: unknown }>(list: readonly T[]) => list.filter((r) => r.deleted_at === null);
const model = (rows: Rows): MappingModel => ({
  entities: live(rows.entity as unknown as Entity[]),
  attributes: live(rows.attribute as unknown as Attribute[]),
  cubeMappings: (rows.cube_mapping ?? []) as unknown as CubeMapping[],
  cubeMappingInputs: (rows.cube_mapping_input ?? []) as unknown as CubeMappingInput[],
});
const entityNamed = (rows: Rows, name: string) => (rows.entity as unknown as Entity[]).find((e) => e.name === name && e.deleted_at === null)!;
const attr = (rows: Rows, entity: string, name: string) =>
  (rows.attribute as unknown as Attribute[]).find((a) => a.entity_id === entityNamed(rows, entity).id && a.name === name && a.deleted_at === null)!;
const mappingOnto = (rows: Rows, entity: string, name: string) => live(model(rows).cubeMappings).find((m) => m.attribute_id === attr(rows, entity, name).id)!;
const mappingRow = (rows: Rows, id: string) => model(rows).cubeMappings.find((m) => m.id === id)!;
const inputsOf = (rows: Rows, mappingId: string) =>
  live(model(rows).cubeMappingInputs)
    .filter((i) => i.mapping_id === mappingId)
    .sort((a, b) => a.sort_order - b.sort_order);
const undo = (after: Rows, step: WriteSet, way: "undo" | "redo" = "undo", actor: string = SEED_IDS.userLukasz) =>
  ok(revertChangeGroup(ctxOf(actor), modeler(), { events: step.events, rows: after as unknown as WorkspaceRows }, way, UNDO_TABLES)).writeSet;

describe("creating a dimensional mapping (B-6)", () => {
  it("maps Product.list_price onto a dimensional row: a direct Draft mapping with one input, the types in the toast when they differ", () => {
    const rows = starRows();
    const from = attr(rows, "Product", "list_price");
    const to = attr(rows, "Dim Product", "product_name");
    const made = ok(createCubeMapping(ctxOf(), modeler(), model(rows), { inputAttributeId: from.id, targetAttributeId: to.id }));
    expect(made.writeSet.writes.map((w) => [w.kind, w.table])).toEqual([["insert", "cube_mapping"], ["insert", "cube_mapping_input"]]);
    expect(made.writeSet.writes[0]).toMatchObject({ row: { attribute_id: to.id, kind: "direct", status: "draft", rule_expression: null, note: null, approved_by: null } });
    expect(made.writeSet.writes[1]).toMatchObject({ row: { mapping_id: made.value.mappingId, attribute_id: from.id, sort_order: 0 } });
    expect(made.value.toast).toBe("Mapped Product.list_price to Dim Product.product_name. The types differ (Decimal → String).");
    const same = ok(createCubeMapping(ctxOf(), modeler(), model(rows), { inputAttributeId: attr(rows, "Product", "sku").id, targetAttributeId: to.id }));
    expect(same.value.toast).toBe("Mapped Product.sku to Dim Product.product_name");
  });

  it("refuses a dimensional input, a logical target, the identical mapping, a reviewer and the archive", () => {
    const rows = starRows();
    const run = (input: string, target: string, a = modeler()) => createCubeMapping(ctxOf(), a, model(rows), { inputAttributeId: input, targetAttributeId: target });
    const sku = attr(rows, "Product", "sku").id;
    const dimSku = attr(rows, "Dim Product", "sku").id;
    expect(run(dimSku, attr(rows, "Dim Customer", "city").id)).toMatchObject({ ok: false, error: { message: DIMENSIONAL_TO_DIMENSIONAL } });
    expect(run(sku, attr(rows, "Customer", "email").id)).toMatchObject({ ok: false, error: { message: LOGICAL_TO_LOGICAL } });
    expect(run(sku, dimSku)).toMatchObject({ ok: false, error: { code: "conflict", message: MAPPING_EXISTS_SELECTED } });
    expect(run(sku, attr(rows, "Dim Product", "product_name").id, as("reviewer"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const archived: WorkspaceAccess = { ...modeler(), workspace: { ...modeler().workspace, archived_at: "2026-11-01T00:00:00.000Z", archived_by: SEED_IDS.userLukasz } };
    expect(run(sku, attr(rows, "Dim Product", "product_name").id, archived)).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("plans a drop in both directions, onto a header, the existing mapping and the prototype's refusals", () => {
    const rows = starRows();
    const index = mappingIndex(model(rows));
    const price = attr(rows, "Product", "list_price").id;
    const dimName = attr(rows, "Dim Product", "product_name").id;
    expect(planDrop(index, price, { attributeId: dimName })).toEqual({ t: "map", inputId: price, targetId: dimName });
    expect(planDrop(index, dimName, { attributeId: price })).toEqual({ t: "map", inputId: price, targetId: dimName });
    expect(planDrop(index, price, { entityId: entityNamed(rows, "Dim Product").id })).toEqual({ t: "header", inputId: price, entityId: entityNamed(rows, "Dim Product").id });
    // a header with an attribute of that name maps onto it; an identical mapping is the existing one
    const sku = attr(rows, "Product", "sku").id;
    expect(planDrop(index, sku, { entityId: entityNamed(rows, "Dim Product").id })).toEqual({ t: "exists", mappingId: mappingOnto(rows, "Dim Product", "sku").id });
    expect(planDrop(index, attr(rows, "Dim Product", "sku").id, { attributeId: sku })).toEqual({ t: "exists", mappingId: mappingOnto(rows, "Dim Product", "sku").id });
    expect(planDrop(index, price, { attributeId: attr(rows, "Customer", "email").id })).toEqual({ t: "refuse", message: LOGICAL_TO_LOGICAL });
    expect(planDrop(index, dimName, { attributeId: attr(rows, "Dim Customer", "city").id })).toEqual({ t: "refuse", message: DIMENSIONAL_TO_DIMENSIONAL });
    expect(planDrop(index, dimName, { columnId: "01900000-0000-7000-8000-00000000c0c0" })).toEqual({ t: "refuse", message: DIMENSIONAL_TO_COLUMN });
    // nothing: a logical row on a column (X1), on a logical header, on itself, a dimensional row on a header
    expect(planDrop(index, price, { columnId: "01900000-0000-7000-8000-00000000c0c0" })).toEqual({ t: "none" });
    expect(planDrop(index, price, { entityId: entityNamed(rows, "Customer").id })).toEqual({ t: "none" });
    expect(planDrop(index, price, { attributeId: price })).toEqual({ t: "none" });
    expect(planDrop(index, dimName, { entityId: entityNamed(rows, "Dim Customer").id })).toEqual({ t: "none" });
  });

  it("onto a header: a plain copy placed last and its Draft mapping in one change group; the card opens; one undo removes both", () => {
    const rows = starRows();
    const price = attr(rows, "Product", "list_price");
    const dim = entityNamed(rows, "Dim Product");
    const card = (rows.canvas_item as unknown as CanvasItem[]).find((i) => i.entity_id === dim.id && i.deleted_at === null)!;
    const hidden = { ...card, row_filter: "unmapped" as const, collapsed: true };
    const at = { ...rows, canvas_item: rows.canvas_item!.map((i) => (i.id === card.id ? (hidden as unknown as Record<string, unknown>) : i)) };
    const made = ok(createOnHeader(ctxOf(), modeler(), { ...model(at), card: hidden }, { inputAttributeId: price.id, entityId: dim.id, card: { canvasItemId: card.id, expectedVersion: card.version } }));
    expect(made.writeSet.writes.map((w) => [w.kind, w.table])).toEqual([["insert", "attribute"], ["insert", "cube_mapping"], ["insert", "cube_mapping_input"], ["update", "canvas_item"]]);
    const copy = (made.writeSet.writes[0] as unknown as { row: Attribute }).row;
    expect(copy).toMatchObject({ entity_id: dim.id, name: "list_price", data_type: "decimal", type_precision: price.type_precision, type_scale: price.type_scale, is_primary_key: false, is_foreign_key: false, is_nullable: true, copied_from_attribute_id: null, sort_order: 4 });
    expect(made.writeSet.writes[3]).toMatchObject({ row: { collapsed: false, row_filter: "all" } });
    expect(made.value.toast).toBe("Added list_price to Dim Product, fed from Product.list_price. Rename it on the right.");
    expect(made.writeSet.mainTargets).toEqual([{ kind: "attribute", id: copy.id }]);
    // the undo step names both rows (Łukasz, 15c step 4)
    expect(made.writeSet.label).toBe("Create attribute and its mapping");
    expect(new Set(made.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const after = apply(at, made.writeSet);
    const back = apply(after, undo(after, made.writeSet));
    expect(live(back.attribute as unknown as Attribute[]).some((a) => a.id === copy.id)).toBe(false);
    expect(live(model(back).cubeMappings)).toHaveLength(20);
  });
});

describe("the mapping panel's edits", () => {
  it("adds a second input: a direct copy becomes a transformation (X2); the same attribute twice is refused; a dimensional input too", () => {
    const rows = starRows();
    const sku = mappingOnto(rows, "Dim Product", "sku");
    const draft = { ...rows, cube_mapping: rows.cube_mapping!.map((m) => (m.id === sku.id ? { ...m, status: "draft", approved_by: null, approved_at: null } : m)) };
    const add = (attributeId: string, rs = draft) => addCubeMappingInput(ctxOf(), modeler(), model(rs), { mappingId: sku.id, expectedVersion: 1, attributeId });
    const made = ok(add(attr(rows, "Product", "category_code").id));
    expect(made.value).toMatchObject({ version: 2, becameTransform: true, notice: null, toast: "It reads Product.category_code too, so it is a transformation now. Describe the rule." });
    expect(made.writeSet.writes[0]).toMatchObject({ table: "cube_mapping", row: { kind: "transform", status: "draft", rule_expression: null } });
    expect(made.writeSet.writes[1]).toMatchObject({ kind: "insert", table: "cube_mapping_input", row: { sort_order: 1 } });
    const after = apply(draft, made.writeSet);
    const third = ok(addCubeMappingInput(ctxOf(), modeler(), model(after), { mappingId: sku.id, expectedVersion: 2, attributeId: attr(rows, "Product", "product_name").id }));
    expect(third.value).toMatchObject({ becameTransform: false, toast: "It reads Product.product_name too." });
    expect(add(attr(rows, "Product", "sku").id)).toMatchObject({ ok: false, error: { code: "conflict", message: ALREADY_READS } });
    expect(add(attr(rows, "Dim Customer", "city").id)).toMatchObject({ ok: false, error: { message: DIMENSIONAL_TO_DIMENSIONAL } });
    expect(addCubeMappingInput(ctxOf(), modeler(), model(draft), { mappingId: sku.id, expectedVersion: 2, attributeId: attr(rows, "Product", "category_code").id })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
  });

  it("removes an input but not the last one; a transformation stays one", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const [first, , third] = inputsOf(rows, net.id);
    const removed = ok(removeCubeMappingInput(ctxOf(), modeler(), model(rows), { mappingId: net.id, expectedVersion: 1, inputId: third!.id }));
    expect(removed.writeSet.writes).toMatchObject([{ table: "cube_mapping", row: { kind: "transform", version: 2 } }, { table: "cube_mapping_input", row: { id: third!.id } }]);
    const quantity = mappingOnto(rows, "Fact Sales", "quantity");
    const only = inputsOf(rows, quantity.id)[0]!;
    expect(removeCubeMappingInput(ctxOf(), modeler(), model(rows), { mappingId: quantity.id, expectedVersion: 1, inputId: only.id })).toMatchObject({ ok: false, error: { message: LAST_INPUT } });
    expect(removeCubeMappingInput(ctxOf(), modeler(), model(rows), { mappingId: quantity.id, expectedVersion: 1, inputId: first!.id })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("sets the kind, the rule and the note; direct with more than one input is refused", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const update = (input: object, id = net.id) => updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: id, expectedVersion: 1, ...input });
    expect(update({ kind: "direct" })).toMatchObject({ ok: false, error: { message: DIRECT_READS_ONE } });
    expect(ok(update({ ruleExpression: "  quantity * unit_price  " })).writeSet.writes[0]).toMatchObject({ row: { rule_expression: "quantity * unit_price" } });
    expect(ok(update({ note: " Check the rounding. " })).writeSet.writes[0]).toMatchObject({ row: { note: "Check the rounding.", status: "review" } });
    expect(update({ ruleExpression: net.rule_expression })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    const quantity = mappingOnto(rows, "Fact Sales", "quantity");
    expect(ok(update({ kind: "transform" }, quantity.id)).writeSet.writes[0]).toMatchObject({ row: { kind: "transform" } });
    expect(update({ note: "x" }, quantity.id)).toMatchObject({ ok: true });
  });

  it("re-points the target onto a dimensional attribute; a logical one and the identical mapping are refused", () => {
    const rows = starRows();
    const sku = mappingOnto(rows, "Dim Product", "sku");
    const to = (attributeId: string) => retargetCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, attributeId });
    const moved = ok(to(attr(rows, "Dim Product", "category_code").id));
    expect(moved.value.toast).toBe("Re-pointed to Dim Product.category_code");
    expect(moved.writeSet.writes[0]).toMatchObject({ row: { attribute_id: attr(rows, "Dim Product", "category_code").id } });
    expect(to(attr(rows, "Product", "category_code").id)).toMatchObject({ ok: false, error: { message: LOGICAL_TO_LOGICAL } });
    expect(to(sku.attribute_id)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    // Product.product_name → Dim Product.product_name exists: a mapping reading Product.product_name alone cannot go there
    const made = ok(createCubeMapping(ctxOf(), modeler(), model(rows), { inputAttributeId: attr(rows, "Product", "product_name").id, targetAttributeId: attr(rows, "Dim Product", "sku").id }));
    const after = apply(rows, made.writeSet);
    expect(retargetCubeMapping(ctxOf(), modeler(), model(after), { mappingId: made.value.mappingId, expectedVersion: 1, attributeId: attr(rows, "Dim Product", "product_name").id })).toMatchObject({
      ok: false,
      error: { code: "conflict", message: MAPPING_EXISTS },
    });
  });

  it("deletes a mapping with its inputs in one step; undo brings them back", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const del = ok(deleteCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: net.id, expectedVersion: 1 })).writeSet;
    expect(del.writes.map((w) => w.table)).toEqual(["cube_mapping_input", "cube_mapping_input", "cube_mapping_input", "cube_mapping"]);
    const after = apply(rows, del);
    expect(live(model(after).cubeMappings)).toHaveLength(19);
    const back = apply(after, undo(after, del));
    expect(live(model(back).cubeMappings)).toHaveLength(20);
    expect(inputsOf(back, net.id)).toHaveLength(3);
  });
});

describe("D-51's first rule (O12) and its undo", () => {
  it("a change of inputs, kind, rule or target sends an approved mapping to review and clears its approval; a note alone keeps it", () => {
    const rows = starRows();
    const sku = mappingOnto(rows, "Dim Product", "sku");
    const quantity = mappingOnto(rows, "Fact Sales", "quantity");
    const back = { status: "review", approved_by: null, approved_at: null };
    const changes: [string, CommandResult<{ notice: string | null }>][] = [
      ["input added", addCubeMappingInput(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, attributeId: attr(rows, "Product", "category_code").id })],
      ["kind", updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: quantity.id, expectedVersion: 1, kind: "transform" })],
      ["rule", updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, ruleExpression: "UPPER(sku)" })],
      ["target", retargetCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, attributeId: attr(rows, "Dim Product", "category_code").id })],
    ];
    for (const [what, result] of changes) {
      expect(ok(result).writeSet.writes[0], what).toMatchObject({ table: "cube_mapping", row: back });
      expect(ok(result).value.notice, what).toBe(BACK_TO_REVIEW_MESSAGE);
    }
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const approvedNet = { ...rows, cube_mapping: rows.cube_mapping!.map((m) => (m.id === net.id ? { ...m, status: "approved", approved_by: ANNA, approved_at: "2026-11-02T00:00:00.000Z" } : m)) };
    const removed = ok(removeCubeMappingInput(ctxOf(), modeler(), model(approvedNet), { mappingId: net.id, expectedVersion: 1, inputId: inputsOf(rows, net.id)[2]!.id }));
    expect(removed.writeSet.writes[0]).toMatchObject({ row: back });
    const note = ok(updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, note: "From the product master." }));
    expect(note.writeSet.writes[0]).toMatchObject({ row: { status: "approved", approved_by: sku.approved_by, approved_at: sku.approved_at } });
    expect(note.value.notice).toBeNull();
    // a draft stays a draft
    const city = mappingOnto(rows, "Dim Customer", "city");
    expect(ok(updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: city.id, expectedVersion: 1, ruleExpression: "latest address" })).writeSet.writes[0]).toMatchObject({ row: { status: "draft" } });
  });

  it("one undo brings the approval back with who and when; redo sends it to review again", () => {
    const rows = starRows();
    const sku = mappingOnto(rows, "Dim Product", "sku");
    const step = ok(updateCubeMapping(ctxOf(), modeler(), model(rows), { mappingId: sku.id, expectedVersion: 1, ruleExpression: "UPPER(sku)" })).writeSet;
    const after = apply(rows, step);
    const undone = undo(after, step);
    const back = apply(after, undone);
    expect(mappingRow(back, sku.id)).toMatchObject({ status: "approved", approved_by: sku.approved_by, approved_at: sku.approved_at, rule_expression: null });
    const again = apply(back, undo(back, undone, "redo"));
    expect(mappingRow(again, sku.id)).toMatchObject({ status: "review", approved_by: null, rule_expression: "UPPER(sku)" });
  });
});

describe("status, reviewers and four-eyes (O9, AD-06)", () => {
  it("a reviewer sets the status, nothing else; approving records who and when, leaving Approved clears both", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const reviewer = as("reviewer", ANNA);
    const approved = ok(setCubeMappingStatus(ctxOf(ANNA), reviewer, { ...model(rows), contentAuthorId: SEED_IDS.userLukasz }, { mappingId: net.id, expectedVersion: 1, status: "approved" }));
    expect(approved.writeSet.writes[0]).toMatchObject({ row: { status: "approved", approved_by: ANNA, approved_at: "2026-11-05T12:00:00.000Z" } });
    const draft = ok(setCubeMappingStatus(ctxOf(ANNA), reviewer, { ...model(rows), contentAuthorId: SEED_IDS.userLukasz }, { mappingId: mappingOnto(rows, "Dim Product", "sku").id, expectedVersion: 1, status: "draft" }));
    expect(draft.writeSet.writes[0]).toMatchObject({ row: { status: "draft", approved_by: null, approved_at: null } });
    expect(updateCubeMapping(ctxOf(ANNA), reviewer, model(rows), { mappingId: net.id, expectedVersion: 1, note: "x" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(deleteCubeMapping(ctxOf(ANNA), reviewer, model(rows), { mappingId: net.id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(setCubeMappingStatus(ctxOf(ANNA), as("reader", ANNA), { ...model(rows), contentAuthorId: SEED_IDS.userLukasz }, { mappingId: net.id, expectedVersion: 1, status: "approved" })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    // the undo of a reviewer's own approval is a status change, so a reviewer may undo it (`action`)
    const after = apply(rows, approved.writeSet);
    expect(revertChangeGroup(ctxOf(ANNA), reviewer, { events: approved.writeSet.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES)).toMatchObject({ ok: true });
  });

  it("with four-eyes on, the last content editor (read from the change log) cannot approve; another person can", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const events: ChangeEvent[] = [];
    // seeded: no event, the creator is the author
    expect(lastContentEditor(net, events, CUBE_MAPPING_LOG)).toBe(net.created_by);
    // Anna (a modeler) changes the rule: she is the last content editor
    const edit = ok(updateCubeMapping(ctxOf(ANNA, "2026-11-05T12:01:00.000Z"), as("modeler", ANNA, true), model(rows), { mappingId: net.id, expectedVersion: 1, ruleExpression: "ROUND(quantity * unit_price, 2)" }));
    events.push(...edit.writeSet.events);
    let after = apply(rows, edit.writeSet);
    // Łukasz's note is no content
    const note = ok(updateCubeMapping(ctxOf(SEED_IDS.userLukasz, "2026-11-05T12:02:00.000Z"), as("modeler", SEED_IDS.userLukasz, true), model(after), { mappingId: net.id, expectedVersion: 2, note: "ok" }));
    events.push(...note.writeSet.events);
    after = apply(after, note.writeSet);
    expect(lastContentEditor(mappingRow(after, net.id), events, CUBE_MAPPING_LOG)).toBe(ANNA);
    // InfoMapper's log does not read InfoCube's events
    expect(lastContentEditor(mappingRow(after, net.id), events, MAPPING_LOG)).toBe(net.created_by);
    const approve = (userId: string) =>
      setCubeMappingStatus(ctxOf(userId), as("reviewer", userId, true), { ...model(after), contentAuthorId: lastContentEditor(mappingRow(after, net.id), events, CUBE_MAPPING_LOG) }, { mappingId: net.id, expectedVersion: 3, status: "approved" });
    expect(approve(ANNA)).toMatchObject({ ok: false, error: { code: "forbidden", message: FOUR_EYES_MESSAGE } });
    expect(approve(SEED_IDS.userLukasz)).toMatchObject({ ok: true });
    // a re-pointed target and an added input count as content too (X5)
    const moved = ok(retargetCubeMapping(ctxOf(SEED_IDS.userLukasz, "2026-11-05T12:03:00.000Z"), modeler(), model(after), { mappingId: net.id, expectedVersion: 3, attributeId: attr(rows, "Fact Sales", "unit_price").id }));
    expect(lastContentEditor(mappingRow(after, net.id), [...events, ...moved.writeSet.events], CUBE_MAPPING_LOG)).toBe(SEED_IDS.userLukasz);
    const added = ok(addCubeMappingInput(ctxOf(ANNA, "2026-11-05T12:04:00.000Z"), as("modeler", ANNA), model(after), { mappingId: net.id, expectedVersion: 3, attributeId: attr(rows, "Product", "list_price").id }));
    expect(lastContentEditor(mappingRow(after, net.id), [...events, ...moved.writeSet.events, ...added.writeSet.events], CUBE_MAPPING_LOG)).toBe(ANNA);
  });
});

describe("Create dimension from this… (B-2)", () => {
  const dimensionFrom = (rows: Rows, ticked: string[], input: object = {}) => {
    const product = entityNamed(rows, "Product");
    const concept = (rows.concept as unknown as { id: string }[]).find((c) => c.id === product.concept_id)!;
    const canvas = (rows.canvas as unknown as { id: string; name: string }[]).find((c) => c.name === "Sales star")!;
    return createDimensionFrom(
      ctxOf(),
      modeler(),
      {
        ...model(rows),
        original: product,
        items: rows.canvas_item as unknown as CanvasItem[],
        create: { concept: concept as never, entities: live(rows.entity as unknown as Entity[]), canvas: canvas as never, frames: [] },
      },
      { entityId: product.id, attributeIds: ticked.map((n) => attr(rows, "Product", n).id), placement: { canvasId: canvas.id, x: 1200, y: 96 }, ...input },
    );
  };

  it("makes Dim Product 2 with product_key first, plain copies of the ticked attributes, a Draft direct mapping each, its role and its card to the right", () => {
    const rows = starRows();
    const product = entityNamed(rows, "Product");
    const made = ok(dimensionFrom(rows, ["product_id", "sku", "list_price"]));
    expect(made.value).toMatchObject({ name: "Dim Product 2", keyName: "product_key", toast: "Created Dim Product 2 with 3 attributes fed from Product, plus its key product_key." });
    const w = made.writeSet.writes;
    const entity = w.find((x) => x.table === "entity")!.row as unknown as Entity;
    expect(entity).toMatchObject({ name: "Dim Product 2", model_level: "dimensional", concept_id: product.concept_id });
    expect(w.find((x) => x.table === "cube_entity")!.row).toMatchObject({ entity_id: entity.id, role: "dimension", history: "overwrite", dim_kind: "standard", grain: null });
    const attributes = w.filter((x) => x.table === "attribute").map((x) => x.row as unknown as Attribute);
    expect(attributes.map((a) => [a.name, a.sort_order, a.is_primary_key, a.is_nullable])).toEqual([
      ["product_key", 0, true, false],
      ["product_id", 1, false, true],
      ["sku", 2, false, true],
      ["list_price", 3, false, true],
    ]);
    expect(attributes[0]).toMatchObject({ data_type: "integer", definition_text: "Surrogate key of the dimension." });
    expect(attributes.every((a) => a.copied_from_attribute_id === null && a.entity_id === entity.id)).toBe(true);
    const maps = w.filter((x) => x.table === "cube_mapping").map((x) => x.row as unknown as CubeMapping);
    expect(maps.map((m) => [m.kind, m.status, attributes.find((a) => a.id === m.attribute_id)!.name])).toEqual([
      ["direct", "draft", "product_id"],
      ["direct", "draft", "sku"],
      ["direct", "draft", "list_price"],
    ]);
    const ins = w.filter((x) => x.table === "cube_mapping_input").map((x) => x.row as unknown as CubeMappingInput);
    expect(ins.map((i) => (rows.attribute as unknown as Attribute[]).find((a) => a.id === i.attribute_id)!.name)).toEqual(["product_id", "sku", "list_price"]);
    // the card at the free spot the canvas found (besideSpots, in the browser); the step's name
    expect(w.find((x) => x.table === "canvas_item")!.row).toMatchObject({ entity_id: entity.id, x: 1200, y: 96 });
    expect(made.writeSet.label).toBe("Create dimension");
    // nothing changes in Product
    expect(w.some((x) => x.kind === "update")).toBe(false);
    expect(new Set(made.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("takes the dialog's name; without a placement or a card no card; refuses a dimensional entity; one undo removes everything", () => {
    const rows = starRows();
    const named = ok(dimensionFrom(rows, ["sku"], { name: " Dim Item " }));
    expect(named.value.name).toBe("Dim Item");
    expect(named.value.toast).toBe("Created Dim Item with 1 attribute fed from Product, plus its key product_key.");
    expect(ok(dimensionFrom(rows, [], { placement: undefined })).writeSet.writes.some((w) => w.table === "canvas_item")).toBe(false);
    const dim = entityNamed(rows, "Dim Product");
    const refused = createDimensionFrom(ctxOf(), modeler(), { ...model(rows), original: dim, items: [], create: { concept: null, entities: [], canvas: null } }, { entityId: dim.id, attributeIds: [] });
    expect(refused).toMatchObject({ ok: false, error: { message: "A dimension is created from a logical entity." } });

    const step = named.writeSet;
    const after = apply(rows, step);
    const back = apply(after, undo(after, step));
    expect(live(back.entity as unknown as Entity[]).some((e) => e.name === "Dim Item")).toBe(false);
    expect(live(back.cube_entity as unknown as CubeEntity[])).toHaveLength(live(rows.cube_entity as unknown as CubeEntity[]).length);
    expect(live(model(back).cubeMappings)).toHaveLength(20);
    expect(live(back.attribute as unknown as Attribute[])).toHaveLength(live(rows.attribute as unknown as Attribute[]).length);
    const redone = apply(back, undo(back, undo(after, step), "redo"));
    expect(live(redone.entity as unknown as Entity[]).some((e) => e.name === "Dim Item")).toBe(true);
  });
});

describe("the derived reads", () => {
  it("what a logical attribute feeds and what feeds a dimensional one", () => {
    const rows = starRows();
    const index = mappingIndex(model(rows));
    expect(feedsOf(index, attr(rows, "Order Line", "quantity").id).map((r) => [r.label, r.status, r.transform])).toEqual([
      ["Fact Sales.quantity", "approved", false],
      ["Fact Sales.net_amount", "review", true],
    ]);
    expect(fedFrom(index, attr(rows, "Fact Sales", "net_amount").id).map((r) => r.label)).toEqual(["Order Line.quantity + Order Line.unit_price + Order Line.discount_pct"]);
    expect(fedFrom(index, attr(rows, "Dim Date", "month").id)).toEqual([]);
  });

  it("the cards' feeds count dimensional attributes with any mapping (P17, X4); the Overview's fed count", () => {
    const rows = starRows();
    const index = mappingIndex(model(rows));
    const feeds = rowFeeds(index, model(rows).attributes);
    expect(Object.keys(feeds)).toHaveLength(20);
    expect(feeds[attr(rows, "Dim Customer", "city").id]).toBe(1);
    expect(feeds[attr(rows, "Dim Customer", "customer_key").id]).toBeUndefined();
    expect(feeds[attr(rows, "Customer", "segment_code").id]).toBeUndefined();
    expect(fedCount(index, [entityNamed(rows, "Dim Customer").id])).toEqual({ fed: 4, total: 5 });
    expect(fedCount(index, [entityNamed(rows, "Dim Date").id, entityNamed(rows, "Customer").id])).toEqual({ fed: 0, total: 5 });
  });

  it("S15-12: Order Line's preview: 6 dimensional mappings, 4 approved, and the facts that lose their feed", () => {
    const rows = starRows();
    const index = mappingIndex(model(rows));
    expect(mappingDependents(index, { entityId: entityNamed(rows, "Order Line").id })).toEqual([
      ["6 dimensional mappings", "deleted, 4 of them approved"],
      ["Fact Orders, Fact Sales", "lose their feed from the logical model"],
    ]);
    expect(mappingDependents(index, { entityId: entityNamed(rows, "Country").id })).toEqual([
      ["1 dimensional mapping", "deleted, 1 of them approved"],
      ["Dim Customer", "loses its feed from the logical model"],
    ]);
    // a logical entity through InfoCube's preview (X-2), a dimensional one with its mappings (X-4)
    const cube = { entities: live(rows.entity as unknown as Entity[]), relationships: live(rows.relationship as unknown as Relationship[]), attributes: live(rows.attribute as unknown as Attribute[]) };
    const cubeEntities = rows.cube_entity as unknown as CubeEntity[];
    expect(entityDependents(entityNamed(rows, "Order Line").id, cube, cubeEntities, [], index)).toHaveLength(2);
    expect(entityDependents(entityNamed(rows, "Dim Customer").id, cube, cubeEntities, [], index)).toEqual([
      ["Dimension", "SCD type 2 deleted"],
      ["2 facts", "lose this dimension: Fact Sales, Fact Orders"],
      ["4 dimensional mappings", "deleted, 3 of them approved"],
    ]);
    expect(entityDependents(entityNamed(rows, "Dim Date").id, cube, cubeEntities, [], index)).toEqual([
      ["Dimension", "SCD type 0 deleted"],
      ["2 facts", "lose this dimension: Fact Sales, Fact Orders"],
    ]);
  });

  it("an attribute's second click names its dimensional mappings and the feed lost (X-3)", () => {
    const rows = starRows();
    const index = mappingIndex(model(rows));
    const attributes = live(rows.attribute as unknown as Attribute[]);
    const keys = cubeIndex({
      entities: live(rows.entity as unknown as Entity[]),
      attributes,
      relationships: live(rows.relationship as unknown as Relationship[]),
      cubeEntities: rows.cube_entity as never,
      cubeMeasures: (rows.cube_measure ?? []) as never,
      cubeKeys: (rows.cube_key ?? []) as never,
    });
    const deletes = attributeDeletes(keys, attributes, index);
    expect(deletes[attr(rows, "Customer", "segment_code").id]).toEqual({ also: ["1 dimensional mapping"], then: ["Dim Customer loses its feed from the logical model"], toast: ["1 dimensional mapping"] });
    expect(deletes[attr(rows, "Order Line", "quantity").id]).toEqual({ also: ["2 dimensional mappings"], then: ["Fact Sales loses its feed from the logical model"], toast: ["2 dimensional mappings"] });
    expect(deletes[attr(rows, "Order Line", "order_id").id]).toBeUndefined();
    // a fact's measure with its mapping: both, the measure first
    expect(deletes[attr(rows, "Fact Sales", "quantity").id]).toEqual({ also: ["1 measure", "1 dimensional mapping"], then: [], toast: ["1 dimensional mapping"] });
  });
});
