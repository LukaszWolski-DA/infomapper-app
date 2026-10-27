// The import and classifications (slice 7c, P6, P7; answers F9, F11–F13; S7C-10, S7C-11, S7C-06's import rules).
import { describe, expect, it } from "vitest";
import { access, builtins, ids, makeCtx, NOW, ownClassification } from "../__fixtures__/domain";
import { allOf, classify, codesOf, columnNamed, emptyModel, importId, importInto, systemNamed } from "../__fixtures__/import";
import { CHANGED, crmWithMappings } from "../__fixtures__/source-changes";
import { importSources, importStateOf } from "../commands/import";
import type { ImportModel } from "./model";
import { buildPlan, HINT_WHY, importSummary, TABLE_CLASSIFICATION_ON_COLUMN, UNKNOWN_CLASSIFICATION, type ImportPlan } from "./plan";
import { keptChoices, planFingerprint } from "./compare";
import { readStandard } from "./standard";

const HEAD = "database,schema,table,column,ordinal,data_type,nullable,primary_key,fk_name,fk_ref_schema,fk_ref_table,fk_ref_column,classifications";
type Row = [table: string, column: string, type: string, opts?: { pk?: boolean; fk?: [string, string]; cls?: string }];
const fileOf = (rows: Row[]) => {
  const ordinal = new Map<string, number>();
  const lines = rows.map(([table, column, type, o = {}]) => {
    const n = (ordinal.get(table) ?? 0) + 1;
    ordinal.set(table, n);
    const fk = o.fk ? `FK_${table}_${o.fk[0]},s,${o.fk[0]},${o.fk[1]}` : ",,,";
    return `d,s,${table},${column},${n},${type},yes,${o.pk ? "yes" : "no"},${fk},"${o.cls ?? ""}"`;
  });
  return readStandard([HEAD, ...lines].join("\n"), "test.csv");
};
const column = (plan: ImportPlan, table: string, name: string) => plan.tables.find((t) => t.file?.name === table)!.columns.find((c) => c.file?.name === name)!;
const nameOf = (model: ImportModel) => (id: string) => model.classifications!.find((c) => c.id === id)!.name;
const hash = ownClassification("01900000-0000-7000-8000-c100000000d1", "Hash candidate");
const withOwn = (): ImportModel => ({ ...emptyModel(), classifications: [...builtins(), hash] });

describe("reading the file's classifications (P6, S7C-10)", () => {
  const FILE = fileOf([
    ["t", "a", "int", { pk: true, cls: "bk" }],
    ["t", "b", "varchar(10)", { cls: "Personal_Data; load-date" }],
    ["t", "c", "int", { cls: "Hash candidate" }],
    ["t", "d", "int", { cls: "Master data" }],
    ["t", "e", "int", { cls: "XYZ" }],
    ["t", "f", "int", { cls: "xyz" }],
    ["u", "a", "int", { pk: true, cls: "XYZ" }],
    ["u", "b", "int", { cls: "LK" }],
  ]);

  it("matches codes and names of the whole list, ignoring case, spaces, _, - and /, own ones by name", () => {
    const model = withOwn();
    const plan = buildPlan(model, FILE, { newName: "S" }, allOf(FILE));
    expect(column(plan, "t", "a").classificationIds.map(nameOf(model))).toEqual(["Business key"]);
    expect(column(plan, "t", "b").classificationIds.map(nameOf(model))).toEqual(["Personal data", "Load date"]);
    expect(column(plan, "t", "c").classificationIds.map(nameOf(model))).toEqual(["Hash candidate"]);
    // a Data Vault classification is read with the mode off (P5; the review marks it)
    expect(column(plan, "u", "b").classificationIds.map(nameOf(model))).toEqual(["Link key"]);
  });

  it("warns once per unknown value and table, and about a table classification on a column, and ignores both (F13)", () => {
    const plan = buildPlan(withOwn(), FILE, { newName: "S" }, allOf(FILE));
    expect(plan.warnings).toEqual([
      "“Master data” is a table classification; ignored on s.t.d (row 5).",
      "Unknown classification “XYZ” on s.t.e (row 6; 1 more row in this table), ignored. Add it to the classification list (“Edit the list…” in a table or column panel) to use it.",
      "Unknown classification “XYZ” on s.u.a (row 8), ignored. Add it to the classification list (“Edit the list…” in a table or column panel) to use it.",
    ]);
    expect(UNKNOWN_CLASSIFICATION(2, "Q", "s.t.a", 2)).toBe("Unknown classification “Q” on s.t.a (row 2; 2 more rows in this table), ignored. Add it to the classification list (“Edit the list…” in a table or column panel) to use it.");
    expect(TABLE_CLASSIFICATION_ON_COLUMN(2, "Staging", "s.t.a", 0)).toBe("“Staging” is a table classification; ignored on s.t.a (row 2).");
    expect(column(plan, "t", "d").classificationIds).toEqual([]);
    expect(column(plan, "t", "e").classificationIds).toEqual([]);
  });

  it("writes new columns with what matched (and the ticked suggestions)", () => {
    const { model } = importInto(withOwn(), FILE, { newName: "S" });
    const col = (t: string, c: string) => codesOf(model, columnNamed(model, t, c).id);
    expect(col("t", "a")).toEqual(["BK"]);
    expect(col("t", "b")).toEqual(["LDTS", "PII"]);
    expect(col("t", "c")).toEqual(["Hash candidate"]);
    expect(col("t", "d")).toEqual([]);
    // u.a: the only primary key, and the file's value matched nothing, so Business key was suggested and left ticked
    expect(col("u", "a")).toEqual(["BK"]);
    expect(col("u", "b")).toEqual(["LK"]);
  });

  it("matches a renamed built-in by its new name and by its code; the old name is unknown then (S7C-04)", () => {
    const model: ImportModel = { ...emptyModel(), classifications: builtins().map((c) => (c.code === "BK" ? { ...c, name: "Klucz biznesowy", name_key: "kluczbiznesowy" } : c)) };
    const file = fileOf([
      ["t", "a", "int", { cls: "Klucz biznesowy" }],
      ["t", "b", "int", { cls: "BK" }],
      ["t", "c", "int", { cls: "Business key" }],
    ]);
    const plan = buildPlan(model, file, { newName: "S" }, allOf(file));
    expect(column(plan, "t", "a").classificationIds.map(nameOf(model))).toEqual(["Klucz biznesowy"]);
    expect(column(plan, "t", "b").classificationIds.map(nameOf(model))).toEqual(["Klucz biznesowy"]);
    expect(plan.warnings).toEqual([UNKNOWN_CLASSIFICATION(4, "Business key", "s.t.c", 0)]);
  });

  it("a removed classification is unknown, by code and by name (S7C-06)", () => {
    const model: ImportModel = { ...emptyModel(), classifications: builtins().map((c) => (c.code === "BK" ? { ...c, deleted_at: NOW } : c)) };
    const file = fileOf([["t", "a", "int", { pk: true, cls: "BK" }]]);
    const plan = buildPlan(model, file, { newName: "S" }, allOf(file));
    expect(plan.warnings).toEqual([UNKNOWN_CLASSIFICATION(2, "BK", "s.t.a", 0)]);
    // and no business key is suggested: a suggestion needs its classification in the list
    expect(plan.hints).toEqual([]);
  });
});

describe("a re-import never changes classifications (D-55, item 19, S7C-10)", () => {
  it("keeps the modeller's and says when the file differs, for any classification", () => {
    const first = fileOf([
      ["t", "a", "int", { pk: true, cls: "BK" }],
      ["t", "b", "int", { cls: "PII" }],
    ]);
    const { model } = importInto(emptyModel(), first, { newName: "S" });
    const again = fileOf([
      ["t", "a", "int", { pk: true, cls: "Business key" }],
      ["t", "b", "int", { cls: "TECH" }],
      ["t", "c", "int", { cls: "TECH" }],
    ]);
    const { plan, changes, model: after } = importInto(model, again, { systemId: systemNamed(model, "S").id });
    expect(column(plan, "t", "a").fileClassifications).toBeNull();
    expect(column(plan, "t", "b").fileClassifications).toEqual(["Technical / audit"]);
    // only the new column gets links
    expect(changes.classificationLinks.insert.map((l) => l.source_column_id)).toEqual([columnNamed(after, "t", "c").id]);
    expect(codesOf(after, columnNamed(after, "t", "b").id)).toEqual(["PII"]);
  });

  it("a re-import that differs only in classifications counts no change and writes nothing to the columns (answers to step 5)", () => {
    const first = fileOf([
      ["t", "a", "int", { pk: true, cls: "BK" }],
      ["t", "b", "int", { cls: "PII" }],
    ]);
    const { model } = importInto(emptyModel(), first, { newName: "S" });
    const again = fileOf([
      ["t", "a", "int", { pk: true, cls: "BK" }],
      ["t", "b", "int", { cls: "TECH" }],
    ]);
    const { plan, changes } = importInto(model, again, { systemId: systemNamed(model, "S").id });
    expect(column(plan, "t", "b")).toMatchObject({ status: "unchanged", fileClassifications: ["Technical / audit"] });
    expect(plan.tables[0].status).toBe("unchanged");
    expect(changes.counts).toEqual({ tables_new: 0, columns_new: 0, columns_changed: 0, columns_renamed: 0, columns_missing: 0, relationships_new: 0, changes_raised: 0, changes_high: 0 });
    expect(importSummary(changes.counts)).toBe("No changes");
    expect(changes.tables.update.filter((u) => Object.keys(u.patch).some((k) => k !== "row_count"))).toEqual([]);
    expect(changes.columns).toEqual({ insert: [], update: [] });
    expect(changes.classificationLinks.insert).toEqual([]);
  });
});

describe("suggested classifications (P7, F12, S7C-11)", () => {
  it("Business key for the only primary key column of a table with no business key, for new columns the file does not classify", () => {
    const file = fileOf([
      ["t", "id", "int", { pk: true }],
      ["t", "x", "int"],
      ["two", "a", "int", { pk: true }],
      ["two", "b", "int", { pk: true }],
      ["keyed", "id", "int", { pk: true }],
      ["keyed", "no", "int", { cls: "BK" }],
    ]);
    const plan = buildPlan(emptyModel(), file, { newName: "S" }, allOf(file));
    expect(plan.hints.map((h) => [h.label, h.code, h.why, h.on])).toEqual([["s.t.id", "BK", HINT_WHY.BK, true]]);
    expect(HINT_WHY.BK).toBe("the only primary key column, and the table has no business key");
  });

  it("not when a live stored column of the table is a business key already (F12)", () => {
    const { model } = importInto(emptyModel(), fileOf([["v", "id", "int"], ["v", "code", "int"]]), { newName: "S" });
    const again = fileOf([["v", "id", "int"], ["v", "code", "int"], ["v", "nk", "int", { pk: true }]]);
    const target = { systemId: systemNamed(model, "S").id };
    expect(buildPlan(model, again, target, allOf(again)).hints.map((h) => h.label)).toEqual(["s.v.nk"]);
    const keyed = classify(model, columnNamed(model, "v", "code").id, "BK");
    expect(buildPlan(keyed, again, target, allOf(again)).hints).toEqual([]);
  });

  it("Link key only in Data Vault 2.0 mode, for a foreign key that is not a primary key", () => {
    const file = fileOf([
      ["p", "id", "int", { pk: true, cls: "BK" }],
      ["c", "id", "int", { pk: true, cls: "BK" }],
      ["c", "p_id", "int", { fk: ["p", "id"] }],
      ["c2", "p_id", "int", { pk: true, fk: ["p", "id"], cls: "BK" }],
    ]);
    expect(buildPlan(emptyModel(), file, { newName: "S" }, allOf(file)).hints).toEqual([]);
    const plan = buildPlan({ ...emptyModel(), dataVault: true }, file, { newName: "S" }, allOf(file));
    expect(plan.hints.map((h) => [h.label, h.code, h.why])).toEqual([["s.c.p_id", "LK", "a foreign key: a candidate for a link between hubs"]]);
  });

  it("an unticked one is not written, a ticked one is (and goes with the import's undo, being in its change group)", () => {
    const file = fileOf([["t", "id", "int", { pk: true }]]);
    const off = new Set(["d|s|t|id|BK"]);
    const unticked = importInto(emptyModel(), file, { newName: "S" }, allOf(file, { hintsOff: off }));
    expect(unticked.plan.hints).toMatchObject([{ id: "d|s|t|id|BK", on: false }]);
    expect(unticked.changes.classificationLinks.insert).toEqual([]);
    const ticked = importInto(emptyModel(), file, { newName: "S" });
    expect(codesOf(ticked.model, columnNamed(ticked.model, "t", "id").id)).toEqual(["BK"]);
  });

  it("a tick, and a list change that alters what the import shows, change the fingerprint; the unticked stay chosen (F11, P8)", () => {
    const file = fileOf([["t", "id", "int", { pk: true }], ["t", "b", "int", { cls: "TECH" }]]);
    const model = emptyModel();
    const shown = planFingerprint(buildPlan(model, file, { newName: "S" }, allOf(file)));
    expect(planFingerprint(buildPlan(model, file, { newName: "S" }, allOf(file, { hintsOff: new Set(["d|s|t|id|BK"]) })))).not.toBe(shown);
    const techRenamed: ImportModel = { ...model, classifications: builtins().map((c) => (c.code === "TECH" ? { ...c, name: "Audit", name_key: "audit" } : c)) };
    // the file names TECH by its code: still matched, the new column written the same
    expect(planFingerprint(buildPlan(techRenamed, file, { newName: "S" }, allOf(file)))).toBe(shown);
    const techRemoved: ImportModel = { ...model, classifications: builtins().map((c) => (c.code === "TECH" ? { ...c, deleted_at: NOW } : c)) };
    expect(planFingerprint(buildPlan(techRemoved, file, { newName: "S" }, allOf(file)))).not.toBe(shown);
    const rebuilt = buildPlan(model, file, { newName: "S" }, allOf(file));
    expect([...keptChoices(allOf(file, { hintsOff: new Set(["d|s|t|id|BK", "gone|x|BK"]) }), rebuilt).hintsOff!]).toEqual(["d|s|t|id|BK"]);
  });
});

describe("the business key rules read the code (S7C-06)", () => {
  it("a renamed Business key still sends back and raises; a removed one does neither", () => {
    const base = crmWithMappings();
    const target = { systemId: base.systemId };
    const reasons = (m: ImportModel) => buildPlan(m, CHANGED, target, allOf(CHANGED)).mappings.find((x) => x.mappingId === base.mappings.custNo)?.reasons ?? [];
    const renamed = { ...base.model, classifications: base.model.classifications!.map((c) => (c.code === "BK" ? { ...c, name: "Klucz biznesowy", name_key: "kluczbiznesowy" } : c)) };
    expect(reasons(renamed)).toContain("business key column changed type, varchar(20) → varchar(25)");
    const removed = { ...base.model, classifications: base.model.classifications!.map((c) => (c.code === "BK" ? { ...c, deleted_at: NOW } : c)) };
    expect(reasons(removed).some((r) => r.startsWith("business key"))).toBe(false);
    // cust_no's mapping a draft: the change without a mapping is raised only while Business key is in the list
    const draft = (m: ImportModel) => ({ ...m, mappings: m.mappings.map((x) => (x.id === base.mappings.custNo ? { ...x, status: "draft" as const, approved_by: null, approved_at: null } : x)) });
    const raised = (m: ImportModel) => buildPlan(draft(m), CHANGED, target, allOf(CHANGED)).raises.filter((r) => r.kind === "business_key_changed");
    expect(raised(renamed)).toHaveLength(1);
    expect(raised(removed)).toHaveLength(0);
  });
});

describe("the import command (S7C-11): the server's list and Data Vault mode, the links in its change group", () => {
  const file = "d,s,p,id,1,int,no,yes,,,,,BK\nd,s,c,id,1,int,no,yes,,,,,BK\nd,s,c,p_id,2,int,yes,no,FK_c_p,s,p,id,";
  const text = `${HEAD}\n${file}`;
  const state = importStateOf({ ...emptyWorkspaceModel(), classifications: builtins(), classificationLinks: [] }, []);
  const input = (dataVault: boolean, hintsOff: string[] = []) => {
    const read = readStandard(text, "x.csv");
    const plan = buildPlan({ ...state.model, dataVault }, read, { newName: "S" }, allOf(read, { hintsOff: new Set(hintsOff) }));
    return { target: { newName: "S" }, channel: "file", sourceLabel: "x.csv", text, scope: [...allOf(read).scope], compare: "schemas", renames: [], hintsOff, fingerprint: planFingerprint(plan) };
  };
  const ctx = () => ({ ...makeCtx(), newId: importId });

  it("plans with the workspace's Data Vault mode, not the browser's: a review planned without it is refused", () => {
    const dv = access("modeler", { dv2_mode: true });
    expect(importSources(ctx(), dv, state, input(false))).toMatchObject({ ok: false, error: { code: "conflict" } });
    const r = importSources(ctx(), dv, state, input(true));
    if (!r.ok) throw new Error(r.error.message);
    const links = r.writeSet.writes.filter((w) => w.table === "classification_link");
    // BK on both ids from the file, LK suggested on c.p_id and left ticked
    expect(links).toHaveLength(3);
    expect(links.every((w) => w.kind === "insert" && w.row.workspace_id === ids.ws && w.row.source_table_id === null)).toBe(true);
  });

  it("writes no link for an unticked suggestion", () => {
    const r = importSources(ctx(), access("modeler", { dv2_mode: true }), state, input(true, ["d|s|c|p_id|LK"]));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.filter((w) => w.table === "classification_link")).toHaveLength(2);
  });
});

function emptyWorkspaceModel() {
  return {
    concepts: [],
    entities: [],
    attributes: [],
    relationships: [],
    sourceSystems: [],
    sourceTables: [],
    sourceColumns: [],
    mappings: [],
    mappingInputs: [],
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
  };
}
