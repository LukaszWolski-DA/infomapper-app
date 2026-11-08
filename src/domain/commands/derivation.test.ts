// Slice 18 (items 1 and 3; acceptance F7, F8, F9, Q1, Q4): the calculation commands, their checks and undo names, the
// cascades of an attribute's and an entity's delete, and undo's refusal of a cycle.

import { describe, expect, it } from "vitest";
import { access, archived, attribute, entity, ids, makeCtx } from "../__fixtures__/domain";
import type { CommandResult, WriteSet } from "../changes";
import { changeLabel } from "../model/change-label";
import { derivationIndex } from "../model/derivations";
import type { Attribute, AttributeInput } from "../types";
import { deleteAttribute } from "./attribute";
import {
  addAttributeInputs,
  ADD_INPUTS_LABEL,
  calculateAttribute,
  CALCULATED_ALREADY,
  CALCULATE_LABEL,
  CHANGE_RULE_LABEL,
  cycleRefusal,
  NOT_CALCULATED,
  NOT_ITSELF,
  readsAlready,
  removeAttributeInput,
  REMOVE_INPUT_LABEL,
  SAME_ENTITY,
  setCalculationRule,
  stopCalculating,
  STOP_CALCULATING_LABEL,
  type DerivationState,
} from "./derivation";
import { deleteEntity } from "./entity";
import { calculationCycleMessage, revertChangeGroup, UNDOABLE_TABLES, type UndoableTable, type WorkspaceRows } from "./undo";

const qty = "01900000-0000-7000-8000-0000000051a1";
const price = "01900000-0000-7000-8000-0000000051a2";
const disc = "01900000-0000-7000-8000-0000000051a3";
const net = "01900000-0000-7000-8000-0000000051a4";
const gross = "01900000-0000-7000-8000-0000000051a5";
const of = (id: string, name: string, over: Partial<Attribute> = {}) => attribute(id, { name, entity_id: ids.customer, is_primary_key: false, ...over });

type Rows = Record<UndoableTable, Record<string, unknown>[]>;
function seed(): Rows {
  const rows = Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []])) as unknown as Rows;
  rows.entity = [entity(ids.customer), entity(ids.salesOrder)] as never;
  rows.attribute = [of(qty, "quantity"), of(price, "unit_price"), of(disc, "discount_pct"), of(net, "net_amount"), of(gross, "gross_amount"), attribute(ids.orderId)] as never;
  return rows;
}
const attrs = (rows: Rows) => rows.attribute as unknown as Attribute[];
const inputs = (rows: Rows) => rows.attribute_input as unknown as AttributeInput[];
const stateOf = (rows: Rows, id: string): DerivationState => ({ attribute: attrs(rows).find((a) => a.id === id) ?? null, attributes: attrs(rows), attributeInputs: inputs(rows) });
const versionOf = (rows: Rows, id: string) => attrs(rows).find((a) => a.id === id)!.version;

function ok<T>(r: CommandResult<T>): WriteSet {
  if (!r.ok) throw new Error(r.error.message);
  return r.writeSet;
}
/** Applies a write set the way the adapter does (without its checks). */
function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows);
  for (const w of writeSet.writes) {
    const list = next[w.table as UndoableTable];
    if (w.kind === "insert") list.push(structuredClone(w.row) as never);
    else {
      const i = list.findIndex((r) => r.id === (w.before as { id: string }).id);
      list[i] = structuredClone((w as { row: unknown }).row) as never;
    }
  }
  return next;
}
const modeler = access("modeler");
// one context for the file: every command issues fresh ids (a context per call would issue the same ones again)
const ctx = makeCtx();
const calc = (rows: Rows, id: string, inputIds: string[], who = modeler) => calculateAttribute(ctx, who, stateOf(rows, id), { attributeId: id, expectedVersion: versionOf(rows, id), inputIds });
const live = (rows: Rows) => inputs(rows).filter((i) => i.deleted_at === null);
const reads = (rows: Rows, id: string) => derivationIndex(attrs(rows), inputs(rows)).inputsOf(id);
const undo = (rows: Rows, ws: WriteSet, mode: "undo" | "redo" = "undo") => revertChangeGroup(ctx, modeler, { events: ws.events, rows: rows as unknown as WorkspaceRows }, mode);

describe("calculateAttribute (slice 18, item 1)", () => {
  it("makes the attribute calculated from its inputs, in order, as one step named Calculate attribute", () => {
    const rows = seed();
    const r = calc(rows, net, [qty, price, disc]);
    const ws = ok(r);
    expect(r.ok && r.value.toast).toBe("net_amount is calculated from quantity, unit_price, discount_pct. Write its rule.");
    expect(ws.label).toBe(CALCULATE_LABEL);
    expect(ws.mainTargets).toEqual([{ kind: "attribute", id: net }]);
    const after = apply(rows, ws);
    expect(attrs(after).find((a) => a.id === net)).toMatchObject({ is_calculated: true, calc_rule: null, version: 2 });
    expect(reads(after, net)).toEqual([qty, price, disc]);
    expect(new Set(ws.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("refuses an input of another entity, the attribute itself, a deleted one, and twice", () => {
    const rows = seed();
    expect(calc(rows, net, [ids.orderId])).toMatchObject({ ok: false, error: { message: SAME_ENTITY } });
    expect(calc(rows, net, [net])).toMatchObject({ ok: false, error: { message: NOT_ITSELF } });
    expect(calc(rows, net, ["01900000-0000-7000-8000-0000000051ff"])).toMatchObject({ ok: false, error: { code: "not_found" } });
    const after = apply(rows, ok(calc(rows, net, [qty])));
    expect(calc(after, net, [price])).toMatchObject({ ok: false, error: { message: CALCULATED_ALREADY } });
    expect(addAttributeInputs(ctx, modeler, stateOf(after, net), { attributeId: net, expectedVersion: 2, inputIds: [qty] })).toMatchObject({ ok: false, error: { message: readsAlready("quantity") } });
  });

  it("refuses a cycle at any depth (S18-03)", () => {
    let rows = apply(seed(), ok(calc(seed(), net, [qty, price])));
    rows = apply(rows, ok(calc(rows, gross, [net])));
    // quantity calculated from gross_amount would close quantity → gross_amount → net_amount → quantity
    expect(calc(rows, qty, [gross])).toMatchObject({ ok: false, error: { message: cycleRefusal("gross_amount", "quantity") } });
    expect(calc(rows, qty, [disc]).ok).toBe(true);
  });

  it("is for owners, admins and modelers in a workspace that is not archived; checks the version", () => {
    const rows = seed();
    expect(calc(rows, net, [qty], access("reviewer"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(calc(rows, net, [qty], access("reader"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(calc(rows, net, [qty], access("owner", archived))).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(calculateAttribute(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 7, inputIds: [qty] })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});

describe("the other calculation commands (slice 18, item 1)", () => {
  it("adds inputs after the existing ones, removes one (the last one too), changes the rule and stops calculating", () => {
    let rows = apply(seed(), ok(calc(seed(), net, [qty])));
    const add = addAttributeInputs(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 2, inputIds: [price, disc] });
    expect(add.ok && add.value.toast).toBe("net_amount reads 2 more attributes.");
    expect(ok(add).label).toBe(ADD_INPUTS_LABEL);
    rows = apply(rows, ok(add));
    expect(reads(rows, net)).toEqual([qty, price, disc]);

    const rm = ok(removeAttributeInput(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 3, inputId: price }));
    expect(rm.label).toBe(REMOVE_INPUT_LABEL);
    rows = apply(rows, rm);
    expect(reads(rows, net)).toEqual([qty, disc]);

    const rule = ok(setCalculationRule(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 4, rule: "  quantity * (1 - discount_pct)  " }));
    expect(rule.label).toBe(CHANGE_RULE_LABEL);
    rows = apply(rows, rule);
    expect(attrs(rows).find((a) => a.id === net)!.calc_rule).toBe("quantity * (1 - discount_pct)");
    expect(setCalculationRule(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 5, rule: "quantity * (1 - discount_pct)" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });

    rows = apply(rows, ok(removeAttributeInput(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 5, inputId: qty })));
    rows = apply(rows, ok(removeAttributeInput(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 6, inputId: disc })));
    // Q1: calculated, with no inputs
    expect(attrs(rows).find((a) => a.id === net)).toMatchObject({ is_calculated: true });
    expect(reads(rows, net)).toEqual([]);

    const stop = stopCalculating(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 7 });
    expect(stop.ok && stop.value.toast).toBe("net_amount is no longer calculated.");
    expect(ok(stop).label).toBe(STOP_CALCULATING_LABEL);
    rows = apply(rows, ok(stop));
    expect(attrs(rows).find((a) => a.id === net)).toMatchObject({ is_calculated: false, calc_rule: null });
  });

  it("refuses the rule and new inputs on an attribute that is not calculated", () => {
    const rows = seed();
    expect(setCalculationRule(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 1, rule: "x" })).toMatchObject({ ok: false, error: { message: NOT_CALCULATED } });
    expect(addAttributeInputs(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 1, inputIds: [qty] })).toMatchObject({ ok: false, error: { message: NOT_CALCULATED } });
    expect(stopCalculating(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("names a step from its rows when no label is given: a calculation input's noun", () => {
    const ws = ok(calc(seed(), net, [qty]));
    expect(changeLabel(ws.events.filter((e) => e.object_type === "attribute_input"))).toBe("Create calculation input");
  });
});

describe("cascades (slice 18, item 3, F9)", () => {
  it("deleting an input removes it from the calculation in the same group; one undo restores both", () => {
    const rows = apply(seed(), ok(calc(seed(), net, [qty, price])));
    const del = ok(deleteAttribute(ctx, modeler, { attribute: attrs(rows).find((a) => a.id === qty)!, mappings: [], mappingInputs: [], attributeInputs: inputs(rows) }, { attributeId: qty, expectedVersion: 1 }));
    const after = apply(rows, del);
    expect(reads(after, net)).toEqual([price]);
    const undone = undo(after, del);
    if (!undone.ok) throw new Error(undone.error.message);
    const back = apply(after, undone.writeSet);
    expect(reads(back, net)).toEqual([qty, price]);
  });

  it("deleting a calculated attribute removes its own input rows; the inputs stay", () => {
    const rows = apply(seed(), ok(calc(seed(), net, [qty, price])));
    const del = ok(deleteAttribute(ctx, modeler, { attribute: attrs(rows).find((a) => a.id === net)!, mappings: [], mappingInputs: [], attributeInputs: inputs(rows) }, { attributeId: net, expectedVersion: 2 }));
    expect(live(apply(rows, del))).toEqual([]);
    expect(attrs(apply(rows, del)).filter((a) => a.deleted_at === null).map((a) => a.id)).toContain(qty);
  });

  it("deleting the entity takes every calculation of its attributes", () => {
    const rows = apply(seed(), ok(calc(seed(), net, [qty, price])));
    const del = ok(
      deleteEntity(ctx, modeler, { entity: rows.entity[0] as never, attributes: attrs(rows), mappings: [], mappingInputs: [], attributeInputs: inputs(rows), relationships: [], canvasItems: [] }, { entityId: ids.customer, expectedVersion: 1 }),
    );
    expect(live(apply(rows, del))).toEqual([]);
  });
});

describe("undo and redo of a calculation (slice 18, S18-01, F8)", () => {
  it("undoes and redoes every command", () => {
    const rows = seed();
    const ws = ok(calc(rows, net, [qty, price]));
    const after = apply(rows, ws);
    const undone = undo(after, ws);
    if (!undone.ok) throw new Error(undone.error.message);
    const back = apply(after, undone.writeSet);
    expect(attrs(back).find((a) => a.id === net)!.is_calculated).toBe(false);
    expect(reads(back, net)).toEqual([]);
    const redone = undo(back, undone.writeSet, "redo");
    if (!redone.ok) throw new Error(redone.error.message);
    const again = apply(back, redone.writeSet);
    expect(reads(again, net)).toEqual([qty, price]);

    const stop = ok(stopCalculating(ctx, modeler, stateOf(again, net), { attributeId: net, expectedVersion: versionOf(again, net) }));
    const stopped = apply(again, stop);
    const unstopped = undo(stopped, stop);
    if (!unstopped.ok) throw new Error(unstopped.error.message);
    expect(reads(apply(stopped, unstopped.writeSet), net)).toEqual([qty, price]);
  });

  it("refuses an undo that would bring back an input closing a cycle", () => {
    // net reads qty; net stops reading qty; then qty is calculated from net; undoing the removal would loop
    let rows = apply(seed(), ok(calc(seed(), net, [qty, price])));
    const rm = ok(removeAttributeInput(ctx, modeler, stateOf(rows, net), { attributeId: net, expectedVersion: 2, inputId: qty }));
    rows = apply(rows, rm);
    rows = apply(rows, ok(calc(rows, qty, [net])));
    expect(undo(rows, rm)).toMatchObject({ ok: false, error: { message: calculationCycleMessage("net_amount") } });
  });
});
