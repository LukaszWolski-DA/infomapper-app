// A dimension's unknown member (slice 22, D-77): the value-fit rule for all eight types with its sentences (S22-03), the
// defaults (decision 2), the flag on `updateCubeEntity` and the value's command with its check of the row the page knows
// (acceptance F3, answer 3).

import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx } from "@/domain/__fixtures__/domain";
import type { Attribute } from "@/domain/types";
import { S, attr, star } from "./__fixtures__/star";
import { setUnknownValue, updateCubeEntity, UNKNOWN_ON_FACT, UNKNOWN_VALUE_NOT_ON_DIMENSION, type UnknownValueState } from "./commands";
import { cubeIndex } from "./keys";
import type { CubeAttribute } from "./types";
import { UNKNOWN_TEXTS, unknownDefault, unknownFit, unknownValueOf } from "./unknown-member";

const on = { infocube: true };
const typed = (data_type: Attribute["data_type"], type_length: number | null = null) => ({ data_type, type_length });

describe("unknownFit: a typed value against its attribute's type (PRD item 7, answer 1)", () => {
  it.each([
    ["integer", ["-1", "0", "42"], ["abc", "1.5", "+1", "1e3", " 1"], "“abc” is not an Integer"],
    ["decimal", ["-1", "0.5", "12.340"], ["abc", "1.", ".5", "1,5"], "“abc” is not a Decimal"],
    ["boolean", ["true", "FALSE", "True"], ["abc", "yes", "1"], "“abc” is not a Boolean"],
    ["date", ["1900-01-01", "2026-11-09 08:30", "2026-11-09T08:30:15"], ["abc", "01.01.1900", "1900-1-1", "2026-11-09 8:30"], "“abc” is not a Date (YYYY-MM-DD)"],
    ["datetime", ["1900-01-01", "2026-11-09 08:30", "2026-11-09T08:30:15"], ["abc", "08:30", "2026-11-09T08"], "“abc” is not a Datetime (YYYY-MM-DD HH:MM)"],
    ["json", ["{}", "null", '"Unknown"', '{"a":[1,2]}'], ["abc", "{a:1}"], "“abc” is not JSON"],
  ] as const)("%s", (type, fits, misfits, sentence) => {
    for (const v of fits) expect(unknownFit(v, typed(type)), v).toBeNull();
    for (const v of misfits) expect(unknownFit(v, typed(type)), v).not.toBeNull();
    expect(unknownFit("abc", typed(type))).toBe(sentence);
  });

  it("a String fits within its length, and any String without one", () => {
    expect(unknownFit("Unknown", typed("string"))).toBeNull();
    expect(unknownFit("n/a", typed("string", 3))).toBeNull();
    expect(unknownFit("Unknown", typed("string", 3))).toBe("“Unknown” is longer than String(3)");
  });

  it("a Custom type fits any value", () => {
    for (const v of ["abc", "-1", "{", ""]) expect(unknownFit(v, typed("custom"))).toBeNull();
  });

  it("checks a date by its shape only (F16)", () => {
    expect(unknownFit("2026-13-45", typed("date"))).toBeNull();
  });
});

describe("unknownDefault (decision 2)", () => {
  const a = (data_type: Attribute["data_type"], is_primary_key = false) => ({ data_type, type_length: null, is_primary_key });
  it("is -1 for an Integer primary key, Unknown for a String, empty for every other type", () => {
    expect(unknownDefault(a("integer", true))).toBe("-1");
    expect(unknownDefault(a("integer"))).toBe("");
    expect(unknownDefault(a("string"))).toBe("Unknown");
    expect(unknownDefault(a("string", true))).toBe("Unknown");
    for (const t of ["decimal", "boolean", "date", "datetime", "json", "custom"] as const) {
      expect(unknownDefault(a(t)), t).toBe("");
      expect(unknownDefault(a(t, true)), t).toBe("");
    }
  });
  it("does not shorten the default to a String's length (F8)", () => {
    expect(unknownDefault({ data_type: "string", type_length: 3, is_primary_key: false })).toBe("Unknown");
  });
});

const std = (id: string) => ({ id, workspace_id: ids.ws, version: 1, created_at: "2026-11-09T08:00:00.000Z", created_by: ids.actor, updated_at: "2026-11-09T08:00:00.000Z", updated_by: ids.actor, deleted_at: null });
const ROW = "01900000-0000-7000-8000-0000000c0701";
const OTHER_ROW = "01900000-0000-7000-8000-0000000c0702";
const value = (over: Partial<CubeAttribute> = {}): CubeAttribute => ({ ...std(ROW), attribute_id: S.custPk, unknown_value: "0", ...over });

describe("the cube index (slice 22)", () => {
  const custName = "01900000-0000-7000-8000-0000000c0223";
  const model = () => {
    const m = star();
    return { ...m, attributes: [...m.attributes, attr(custName, S.cust, "customer_name", 1, { data_type: "string" })] };
  };
  it("says a dimension has its unknown member unless turned off, and a fact never", () => {
    const m = model();
    expect(cubeIndex(m).unknownOn(S.cust)).toBe(true);
    expect(cubeIndex(m).unknownOn(S.sales)).toBe(false);
    expect(cubeIndex(m).unknownOn("nowhere")).toBe(false);
    const off = { ...m, cubeEntities: m.cubeEntities.map((c) => (c.id === S.cubeCust ? { ...c, has_unknown_member: false } : c)) };
    expect(cubeIndex(off).unknownOn(S.cust)).toBe(false);
  });
  it("gives the stored value, else the default; a deleted row is none", () => {
    const m = model();
    const pk = m.attributes.find((a) => a.id === S.custPk)!;
    const name = m.attributes.find((a) => a.id === custName)!;
    const none = cubeIndex(m);
    expect([unknownValueOf(none, pk), unknownValueOf(none, name)]).toEqual(["-1", "Unknown"]);
    const stored = cubeIndex({ ...m, cubeAttributes: [value(), value({ id: OTHER_ROW, attribute_id: custName, unknown_value: "n/a", deleted_at: "2026-11-09T09:00:00.000Z" })] });
    expect([unknownValueOf(stored, pk), unknownValueOf(stored, name)]).toEqual(["0", "Unknown"]);
    expect(stored.unknownOf(custName)).toBeUndefined();
  });
  it("words the fact's Dimensions part and a lookup's placeholder", () => {
    expect(UNKNOWN_TEXTS.noMatch("-1")).toBe("no match → -1");
    expect(UNKNOWN_TEXTS.noMatch("")).toBe("no match → NULL");
    expect(UNKNOWN_TEXTS.noMatchTitle("customer_key", "Dim Customer")).toBe("A fact row whose customer_key is empty or has no match gets Dim Customer's unknown member");
    expect(UNKNOWN_TEXTS.lookupPlaceholder("Unknown")).toBe("Unknown (the unknown member's value)");
  });
});

describe("updateCubeEntity: the unknown member's flag (F13)", () => {
  const m = star();
  const cust = m.cubeEntities.find((c) => c.id === S.cubeCust)!;
  const sales = m.cubeEntities.find((c) => c.id === S.cubeSales)!;
  const run = (cube = cust, hasUnknownMember = false, who = access("modeler", on)) => updateCubeEntity(makeCtx(), who, { cube }, { cubeEntityId: cube.id, expectedVersion: cube.version, hasUnknownMember });

  it("a new dimension has it on, a fact has none", () => {
    expect([cust.has_unknown_member, sales.has_unknown_member]).toEqual([true, null]);
  });
  it("turns it off and on, one write, with the undo step's name", () => {
    const off = run();
    if (!off.ok) throw new Error(off.error.message);
    expect(off.writeSet.writes).toMatchObject([{ kind: "update", table: "cube_entity", row: { id: cust.id, has_unknown_member: false, version: cust.version + 1 } }]);
    expect(off.writeSet.label).toBe("Turn off unknown member");
    const back = run({ ...cust, has_unknown_member: false }, true);
    expect(back.ok && back.writeSet.label).toBe("Turn on unknown member");
  });
  it("writes nothing for the same value, and is refused on a fact, for a reviewer and in an archived workspace", () => {
    expect(run(cust, true)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(run(sales, true)).toMatchObject({ ok: false, error: { code: "invalid", message: UNKNOWN_ON_FACT } });
    expect(run(cust, false, access("reviewer", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(run(cust, false, access("reader", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(run(cust, false, access("owner", { ...on, ...archived }))).toMatchObject({ ok: false, error: { code: "archived" } });
  });
  it("is refused at a stale version", () => {
    expect(updateCubeEntity(makeCtx(), access("modeler", on), { cube: { ...cust, version: 2 } }, { cubeEntityId: cust.id, expectedVersion: 1, hasUnknownMember: false })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});

describe("setUnknownValue (PRD item 3, acceptance F3)", () => {
  const m = star();
  const state = (over: Partial<UnknownValueState> = {}): UnknownValueState => ({
    attribute: m.attributes.find((a) => a.id === S.custPk)!,
    cube: m.cubeEntities.find((c) => c.id === S.cubeCust)!,
    row: null,
    ...over,
  });
  const run = (s: UnknownValueState, v: string | null, current: { id: string; version: number } | null, who = access("modeler", on), attributeId: string = S.custPk) =>
    setUnknownValue(makeCtx(), who, s, { attributeId, value: v, current });

  it("stores the first value trimmed, as a new row, one undo step", () => {
    const r = run(state(), "  0 ", null);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "insert", table: "cube_attribute", row: { attribute_id: S.custPk, unknown_value: "0", version: 1, deleted_at: null } }]);
    expect(r.value.row).toEqual({ id: (r.writeSet.writes[0] as { row: { id: string } }).row.id, version: 1 });
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(r.writeSet.label).toBe("Set unknown member value");
  });

  it("keeps a value that does not fit its type: the panel and the checks say so", () => {
    const r = run(state(), "abc", null);
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ row: { unknown_value: "abc" } });
  });

  it("changes a stored value at the version the page knows", () => {
    const r = run(state({ row: value() }), "-2", { id: ROW, version: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "cube_attribute", row: { id: ROW, unknown_value: "-2", version: 2 } }]);
    expect(r.value.row).toEqual({ id: ROW, version: 2 });
    expect(r.writeSet.label).toBe("Set unknown member value");
  });

  it("clears a value by deleting its row: an empty value, spaces or null", () => {
    for (const v of ["", "   ", null]) {
      const r = run(state({ row: value() }), v, { id: ROW, version: 1 });
      if (!r.ok) throw new Error(r.error.message);
      expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "cube_attribute", row: { id: ROW, version: 2 } }]);
      expect((r.writeSet.writes[0] as { row: CubeAttribute }).row.deleted_at).not.toBeNull();
      expect(r.value.row).toBeNull();
      expect(r.writeSet.label).toBe("Clear unknown member value");
    }
  });

  it("writes nothing for the same value, or for clearing what is not stored", () => {
    expect(run(state({ row: value() }), " 0 ", { id: ROW, version: 1 })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(run(state(), "", null)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("is a stale version when another user created the row meanwhile (answer 3)", () => {
    // the page knows no row; Anna typed a value in the meantime
    expect(run(state({ row: value({ unknown_value: "-99" }) }), "0", null)).toMatchObject({ ok: false, error: { code: "stale_version" } });
    // clearing nothing is refused the same way, not as "Nothing to change."
    expect(run(state({ row: value({ unknown_value: "-99" }) }), "", null)).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("is a stale version when the row changed, was cleared, or was cleared and typed again meanwhile", () => {
    expect(run(state({ row: value({ version: 2, unknown_value: "-99" }) }), "0", { id: ROW, version: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(run(state({ row: null }), "0", { id: ROW, version: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(run(state({ row: value({ deleted_at: "2026-11-09T09:00:00.000Z", version: 2 }) }), "0", { id: ROW, version: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(run(state({ row: value({ id: OTHER_ROW }) }), "0", { id: ROW, version: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("is refused on an attribute of a fact, on a missing attribute, for reviewers and readers and in an archived workspace", () => {
    const quantity = m.attributes.find((a) => a.id === S.quantity)!;
    const sales = m.cubeEntities.find((c) => c.id === S.cubeSales)!;
    expect(run(state({ attribute: quantity, cube: sales }), "0", null, access("modeler", on), S.quantity)).toMatchObject({ ok: false, error: { code: "invalid", message: UNKNOWN_VALUE_NOT_ON_DIMENSION } });
    expect(run(state({ attribute: quantity, cube: null }), "0", null, access("modeler", on), S.quantity)).toMatchObject({ ok: false, error: { code: "invalid", message: UNKNOWN_VALUE_NOT_ON_DIMENSION } });
    expect(run(state({ attribute: null }), "0", null)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run(state({ attribute: { ...state().attribute!, deleted_at: "2026-11-09T09:00:00.000Z" } }), "0", null)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run(state(), "0", null, access("reviewer", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(run(state(), "0", null, access("reader", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(run(state(), "0", null, access("owner", { ...on, ...archived }))).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("stores a value while the dimension's unknown member is off (the values stay)", () => {
    const off = { ...state().cube!, has_unknown_member: false };
    expect(run(state({ cube: off }), "0", null).ok).toBe(true);
  });
});
