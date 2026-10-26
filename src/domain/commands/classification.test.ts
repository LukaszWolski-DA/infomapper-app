import { describe, expect, it } from "vitest";
import type { CommandResult } from "../changes";
import { access, archived, builtin, builtins, classificationLink, fixtureLinks, ids, makeCtx, NOW, ownClassification, sourceColumn, sourceTable } from "../__fixtures__/domain";
import { TAKEN_NAME, WHAT_STOPS } from "../model/classifications";
import type { Classification, SourceChange } from "../types";
import {
  addClassification,
  classificationImpact,
  NOT_REMOVED,
  ONLY_BUILTIN_RESTORED,
  removeClassification,
  renameClassification,
  restoreClassification,
  RESTORE_TAKEN,
  setClassification,
  WRONG_SCOPE,
} from "./classification";

const writes = <T,>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r.writeSet.writes;
};
const list = () => builtins();
const golden = ownClassification("01900000-0000-7000-8000-c100000000a1", "Golden source", "table");

describe("add an own classification (item 8, S7C-04)", () => {
  it("adds one with no code, in its scope, as one change", () => {
    const r = addClassification(makeCtx(), access("modeler"), { classifications: list() }, { scope: "table", name: "  Golden source " });
    expect(writes(r)).toEqual([expect.objectContaining({ kind: "insert", table: "classification" })]);
    expect(r.ok && r.value.classification).toMatchObject({ code: null, name: "Golden source", name_key: "goldensource", scope: "table", origin: "own", workspace_id: ids.ws });
  });

  it("refuses a taken name (another's name or a built-in code of the scope) with “That name is taken”; another scope is fine", () => {
    for (const name of ["business KEY", "Personal_Data", "lk", "PII"]) {
      expect(addClassification(makeCtx(), access("modeler"), { classifications: list() }, { scope: "column", name })).toMatchObject({ ok: false, error: { code: "conflict", message: TAKEN_NAME } });
    }
    expect(addClassification(makeCtx(), access("modeler"), { classifications: list() }, { scope: "table", name: "Business key" }).ok).toBe(true);
    expect(addClassification(makeCtx(), access("modeler"), { classifications: list() }, { scope: "column", name: "---" })).toMatchObject({ ok: false, error: { code: "invalid", message: "Enter a name." } });
  });

  it("refuses reviewers, readers and an archived workspace (item 12)", () => {
    for (const a of [access("reviewer"), access("reader"), access("owner", archived)]) {
      expect(addClassification(makeCtx(), a, { classifications: list() }, { scope: "column", name: "Hash candidate" }).ok).toBe(false);
    }
  });
});

describe("rename any classification (item 9, S7C-04)", () => {
  it("renames a built-in one and keeps its code", () => {
    const bk = builtin("BK");
    const r = renameClassification(makeCtx(), access("owner"), { classifications: list() }, { classificationId: bk.id, expectedVersion: 1, name: "Klucz biznesowy" });
    const [w] = writes(r);
    expect(w).toMatchObject({ kind: "update", table: "classification", row: { code: "BK", name: "Klucz biznesowy", name_key: "kluczbiznesowy", version: 2 } });
  });

  it("renames an own one; refuses a taken name, the same name and a stale version", () => {
    const own = ownClassification("01900000-0000-7000-8000-c100000000a2", "Hash candidate");
    const state = { classifications: [...list(), own] };
    expect(renameClassification(makeCtx(), access("modeler"), state, { classificationId: own.id, expectedVersion: 1, name: "Hash key candidate" }).ok).toBe(true);
    expect(renameClassification(makeCtx(), access("modeler"), state, { classificationId: own.id, expectedVersion: 1, name: "Load date" })).toMatchObject({ ok: false, error: { message: TAKEN_NAME } });
    expect(renameClassification(makeCtx(), access("modeler"), state, { classificationId: own.id, expectedVersion: 1, name: "Hash candidate" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(renameClassification(makeCtx(), access("modeler"), state, { classificationId: own.id, expectedVersion: 3, name: "X" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    // another case of its own name is fine
    expect(renameClassification(makeCtx(), access("modeler"), state, { classificationId: own.id, expectedVersion: 1, name: "HASH candidate" }).ok).toBe(true);
  });
});

describe("remove a classification with its impact first (item 10, D-47, S7C-05)", () => {
  const table = sourceTable();
  const columns = [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)];

  it("lists the uses, sorted, and for a built-in one what stops and the business key changes that settle", () => {
    const links = [...fixtureLinks(), classificationLink(golden, { tableId: table.id })];
    const change = { id: "c1", kind: "business_key_changed", mapping_id: null, source_column_id: ids.colCustId, status: "open", deleted_at: null } as SourceChange;
    const impact = classificationImpact({ classifications: [...list(), golden], links, tables: [table], columns, changes: [change] }, builtin("BK").id);
    expect(impact).toEqual({ name: "Business key", tables: [], columns: [{ id: ids.colCustId, label: "dbo.customer.cust_id" }], stops: WHAT_STOPS.BK, settles: 1 });
    expect(classificationImpact({ classifications: [...list(), golden], links, tables: [table], columns }, builtin("PII").id)).toMatchObject({
      columns: [{ label: "dbo.customer.email" }, { label: "dbo.customer.first_name" }],
      stops: WHAT_STOPS.PII,
      settles: 0,
    });
    expect(classificationImpact({ classifications: [...list(), golden], links, tables: [table], columns }, golden.id)).toEqual({
      name: "Golden source",
      tables: [{ id: table.id, label: "dbo.customer" }],
      columns: [],
      stops: null,
      settles: 0,
    });
  });

  it("takes the classification and its live links away in one change group", () => {
    const links = [...fixtureLinks(), classificationLink("PII", { columnId: ids.colCustId }, { deleted_at: NOW })];
    const r = removeClassification(makeCtx(), access("modeler"), { classifications: list(), links }, { classificationId: builtin("PII").id, expectedVersion: 1 });
    expect(writes(r).map((w) => [w.table, w.kind === "update" && (w.row as { deleted_at: string | null }).deleted_at !== null])).toEqual([
      ["classification_link", true],
      ["classification_link", true],
      ["classification", true],
    ]);
    expect(r.ok && r.value).toEqual({ name: "Personal data", tables: 0, columns: 2 });
  });

  it("refuses a removed one, a stale version and a reviewer", () => {
    const removed = list().map((c) => (c.code === "PII" ? { ...c, deleted_at: NOW } : c));
    expect(removeClassification(makeCtx(), access("modeler"), { classifications: removed, links: [] }, { classificationId: builtin("PII").id, expectedVersion: 1 }).ok).toBe(false);
    expect(removeClassification(makeCtx(), access("modeler"), { classifications: list(), links: [] }, { classificationId: builtin("PII").id, expectedVersion: 2 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(removeClassification(makeCtx(), access("reviewer"), { classifications: list(), links: [] }, { classificationId: builtin("PII").id, expectedVersion: 1 }).ok).toBe(false);
  });
});

describe("restore a removed built-in one (item 11, S7C-05)", () => {
  const removedBk: Classification = { ...builtin("BK"), deleted_at: NOW, version: 2 };
  const state = { classifications: [...list().filter((c) => c.code !== "BK"), removedBk] };

  it("brings the same row back under the name it had; its links stay removed (it comes back empty)", () => {
    const r = restoreClassification(makeCtx(), access("modeler"), state, { classificationId: removedBk.id, expectedVersion: 2 });
    expect(writes(r)).toEqual([expect.objectContaining({ kind: "update", table: "classification", row: expect.objectContaining({ id: removedBk.id, name: "Business key", deleted_at: null, version: 3 }) })]);
  });

  it("refuses while another classification has its name, a live one, an own one and a stale version", () => {
    const taker = ownClassification("01900000-0000-7000-8000-c100000000a3", "business key");
    expect(restoreClassification(makeCtx(), access("modeler"), { classifications: [...state.classifications, taker] }, { classificationId: removedBk.id, expectedVersion: 2 })).toMatchObject({
      ok: false,
      error: { code: "conflict", message: RESTORE_TAKEN("business key", "Business key") },
    });
    expect(RESTORE_TAKEN("business key", "Business key")).toBe("Rename business key first: Business key is taken.");
    expect(restoreClassification(makeCtx(), access("modeler"), { classifications: list() }, { classificationId: builtin("BK").id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: NOT_REMOVED } });
    const removedOwn = { ...golden, deleted_at: NOW };
    expect(restoreClassification(makeCtx(), access("modeler"), { classifications: [removedOwn] }, { classificationId: golden.id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: ONLY_BUILTIN_RESTORED } });
    expect(restoreClassification(makeCtx(), access("modeler"), state, { classificationId: removedBk.id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(restoreClassification(makeCtx(), access("reader"), state, { classificationId: removedBk.id, expectedVersion: 2 }).ok).toBe(false);
  });
});

describe("set and clear a classification on a table or column (items 13, 14, S7C-03)", () => {
  const state = (links = fixtureLinks()) => ({ classifications: [...list(), golden], links, tables: [sourceTable()], columns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail)] });

  it("sets one on a column and on a table: a new link each", () => {
    const r = setClassification(makeCtx(), access("modeler"), state(), { classificationId: builtin("TECH").id, target: { kind: "source_column", id: ids.colEmail }, on: true });
    expect(writes(r)).toEqual([expect.objectContaining({ kind: "insert", table: "classification_link", row: expect.objectContaining({ source_column_id: ids.colEmail, source_table_id: null }) })]);
    expect(r.ok && r.value).toEqual({ name: "Technical / audit", objectName: "email", on: true });
    // the undo history's name (Łukasz, step 2)
    expect(r.ok && r.writeSet.label).toBe("Set Technical / audit on email");
    const t = setClassification(makeCtx(), access("modeler"), state(), { classificationId: golden.id, target: { kind: "source_table", id: ids.crmCustomer }, on: true });
    expect(writes(t)[0]).toMatchObject({ row: { source_table_id: ids.crmCustomer, source_column_id: null, classification_id: golden.id } });
  });

  it("clears one: its live link soft-deleted", () => {
    const r = setClassification(makeCtx(), access("modeler"), state(), { classificationId: builtin("BK").id, target: { kind: "source_column", id: ids.colCustId }, on: false });
    expect(writes(r)).toEqual([expect.objectContaining({ kind: "update", table: "classification_link", row: expect.objectContaining({ deleted_at: NOW }) })]);
    expect(r.ok && r.writeSet.label).toBe("Clear Business key from cust_id");
  });

  it("refuses the wrong scope, a removed classification, a set one set again and nothing to clear", () => {
    expect(setClassification(makeCtx(), access("modeler"), state(), { classificationId: golden.id, target: { kind: "source_column", id: ids.colEmail }, on: true })).toMatchObject({
      ok: false,
      error: { message: WRONG_SCOPE("Golden source", "table") },
    });
    expect(WRONG_SCOPE("Golden source", "table")).toBe("Golden source is a table classification.");
    const removed = { ...state(), classifications: list().map((c) => (c.code === "TECH" ? { ...c, deleted_at: NOW } : c)) };
    expect(setClassification(makeCtx(), access("modeler"), removed, { classificationId: builtin("TECH").id, target: { kind: "source_column", id: ids.colEmail }, on: true })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(setClassification(makeCtx(), access("modeler"), state(), { classificationId: builtin("BK").id, target: { kind: "source_column", id: ids.colCustId }, on: true })).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(setClassification(makeCtx(), access("modeler"), state(), { classificationId: builtin("BK").id, target: { kind: "source_column", id: ids.colEmail }, on: false })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses reviewers, readers and an archived workspace; the server refuses their writes (S7C-13)", () => {
    for (const [a, code] of [[access("reviewer"), "forbidden"], [access("reader"), "forbidden"], [access("modeler", archived), "archived"]] as const) {
      expect(setClassification(makeCtx(), a, state(), { classificationId: builtin("TECH").id, target: { kind: "source_column", id: ids.colEmail }, on: true })).toMatchObject({ ok: false, error: { code } });
    }
  });
});
