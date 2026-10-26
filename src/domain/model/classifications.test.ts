import { describe, expect, it } from "vitest";
import { builtin, builtins, classificationLink, ids, makeCtx, NOW, ownClassification } from "../__fixtures__/domain";
import {
  BUILTIN_CLASSIFICATIONS,
  builtinClassificationRows,
  CLASSIFICATION_CODES,
  classificationIndex,
  DATA_VAULT_MODE_TEXT,
  dataVaultOffMessage,
  dataVaultUses,
  fitsScope,
  groupOf,
  nameTakenBy,
  normClassification,
  WHAT_STOPS,
  whatStops,
} from "./classifications";

describe("the built-in list (item 1, P2, S7C-01)", () => {
  it("holds the 19 classifications with their codes, scopes and groups; Effective date is general", () => {
    expect(BUILTIN_CLASSIFICATIONS.map((b) => [b.code, b.scope, groupOf(b)])).toEqual([
      ["BK", "column", "General"],
      ["PII", "column", "General"],
      ["TECH", "column", "General"],
      ["LDTS", "column", "General"],
      ["RSRC", "column", "General"],
      ["EFF", "column", "General"],
      ["LK", "column", "Data Vault 2.0"],
      ["DCK", "column", "Data Vault 2.0"],
      ["DK", "column", "Data Vault 2.0"],
      ["MAK", "column", "Data Vault 2.0"],
      ["T_MASTER", "table", "General"],
      ["T_TXN", "table", "General"],
      ["T_REF", "table", "General"],
      ["T_STG", "table", "General"],
      ["T_LOG", "table", "General"],
      ["T_HIST", "table", "General"],
      ["T_HUB", "table", "Data Vault 2.0"],
      ["T_LNK", "table", "Data Vault 2.0"],
      ["T_SAT", "table", "Data Vault 2.0"],
    ]);
    expect(BUILTIN_CLASSIFICATIONS.map((b) => b.code)).toEqual([...CLASSIFICATION_CODES]);
  });

  it("names the code PII “Personal data” (answer F14); the other names are the prototype's", () => {
    expect(BUILTIN_CLASSIFICATIONS.find((b) => b.code === "PII")!.name).toBe("Personal data");
    expect(BUILTIN_CLASSIFICATIONS.find((b) => b.code === "T_HIST")!.name).toBe("History (SCD2)");
  });

  it("gives a new workspace its rows: one per built-in, with the code, the normalized name and the creator", () => {
    const rows = builtinClassificationRows(makeCtx(), ids.ws);
    expect(rows).toHaveLength(19);
    expect(rows[1]).toMatchObject({ workspace_id: ids.ws, code: "PII", name: "Personal data", name_key: "personaldata", scope: "column", origin: "builtin", version: 1, created_by: ids.actor, deleted_at: null });
    expect(new Set(rows.map((r) => r.id)).size).toBe(19);
  });
});

describe("names (item 8, answer F10)", () => {
  it("compares ignoring case, spaces, _, - and / (prototype norm)", () => {
    expect(normClassification(" Load_Date ")).toBe("loaddate");
    expect(normClassification("Reference / code-list")).toBe("referencecodelist");
  });

  it("takes a name another classification of the scope has, or a built-in code of the scope, removed ones included", () => {
    const list = [...builtins().map((c) => (c.code === "LK" ? { ...c, deleted_at: NOW } : c)), ownClassification(ids.labelCr23, "Hash candidate")];
    expect(nameTakenBy(list, "column", "business_KEY")?.code).toBe("BK");
    expect(nameTakenBy(list, "column", "pii")?.code).toBe("PII");
    expect(nameTakenBy(list, "column", "hash-candidate")?.name).toBe("Hash candidate");
    // a removed built-in keeps its code, not its name
    expect(nameTakenBy(list, "column", "lk")?.code).toBe("LK");
    expect(nameTakenBy(list, "column", "Link key")).toBeNull();
    // another scope's names and codes are free
    expect(nameTakenBy(list, "table", "Business key")).toBeNull();
    expect(nameTakenBy(list, "column", "T_HUB")).toBeNull();
    // the one renamed may keep its own name in another case
    expect(nameTakenBy(list, "column", "business key", builtin("BK").id)).toBeNull();
  });

  it("knows which objects a classification fits (P3)", () => {
    expect(fitsScope(builtin("BK"), "source_column")).toBe(true);
    expect(fitsScope(builtin("BK"), "source_table")).toBe(false);
    expect(fitsScope(builtin("T_HUB"), "source_table")).toBe(true);
  });
});

describe("the index (item 6, P11)", () => {
  const own = ownClassification(ids.labelCr23, "Golden source", "table");
  const links = [
    classificationLink("BK", { columnId: ids.colCustId }),
    classificationLink("PII", { columnId: ids.colEmail }),
    classificationLink("TECH", { columnId: ids.colEmail }),
    classificationLink(own, { tableId: ids.crmCustomer }),
    classificationLink("PII", { columnId: ids.colFirstName }, { deleted_at: NOW }),
  ];

  it("answers which classifications an object has, in list order, and whether it has a code", () => {
    const ix = classificationIndex([...builtins(), own], links);
    expect(ix.of(ids.colEmail).map((c) => c.code)).toEqual(["PII", "TECH"]);
    expect(ix.of(ids.crmCustomer).map((c) => c.name)).toEqual(["Golden source"]);
    expect(ix.has(ids.colCustId, "BK")).toBe(true);
    expect(ix.has(ids.colEmail, "BK")).toBe(false);
    // a deleted link counts for nothing
    expect(ix.has(ids.colFirstName, "PII")).toBe(false);
    expect(ix.of(ids.colFirstName)).toEqual([]);
    expect(ix.uses(builtin("PII").id)).toEqual({ tables: [], columns: [ids.colEmail] });
    expect(ix.uses(own.id)).toEqual({ tables: [ids.crmCustomer], columns: [] });
    expect(ix.linkOf(ids.colCustId, builtin("BK").id)?.source_column_id).toBe(ids.colCustId);
  });

  it("follows the code, not the name: a renamed one keeps working, a removed one is absent (P1, answer F1)", () => {
    const renamed = builtins().map((c) => (c.code === "BK" ? { ...c, name: "Klucz biznesowy", name_key: "kluczbiznesowy" } : c));
    expect(classificationIndex(renamed, links).has(ids.colCustId, "BK")).toBe(true);
    const removed = builtins().map((c) => (c.code === "BK" ? { ...c, deleted_at: NOW } : c));
    const ix = classificationIndex(removed, links);
    expect(ix.has(ids.colCustId, "BK")).toBe(false);
    expect(ix.of(ids.colCustId)).toEqual([]);
    expect(ix.byCode.has("BK")).toBe(false);
    expect(ix.list).toHaveLength(18);
  });
});

describe("what stops when a built-in one is removed (item 10, answers F1, F3)", () => {
  it("has one text for every built-in a rule reads and none for the others", () => {
    expect(Object.keys(WHAT_STOPS).sort()).toEqual(["BK", "DCK", "DK", "EFF", "LDTS", "LK", "MAK", "PII", "RSRC", "T_HUB", "TECH"].sort());
    for (const code of ["T_MASTER", "T_TXN", "T_REF", "T_STG", "T_LOG", "T_HIST", "T_LNK", "T_SAT"] as const) expect(whatStops(builtin(code))).toBeNull();
    expect(whatStops(ownClassification(ids.labelCr23, "Hash candidate"))).toBeNull();
  });

  it("names the role, not the current name (answer F1)", () => {
    expect(whatStops(builtin("BK", { name: "Klucz biznesowy" }))).toBe(WHAT_STOPS.BK);
    expect(WHAT_STOPS.BK).toContain("suggests business keys on attributes");
    expect(WHAT_STOPS.BK).toContain("BK badge on source rows");
  });
});

describe("Data Vault 2.0 mode (P5, item 17, answers F16, F17)", () => {
  it("counts the uses of Data Vault classifications for the message; the count only when there are any", () => {
    const ix = classificationIndex(builtins(), [
      classificationLink("LK", { columnId: ids.colCustId }),
      classificationLink("DK", { columnId: ids.colEmail }),
      classificationLink("T_HUB", { tableId: ids.crmCustomer }),
      classificationLink("BK", { columnId: ids.colCustId }),
    ]);
    expect(dataVaultUses(ix)).toBe(3);
    expect(dataVaultOffMessage(3)).toBe("Data Vault 2.0 mode is off. 3 Data Vault classifications on tables and columns stay stored and show again when the mode is on.");
    expect(dataVaultOffMessage(1)).toBe("Data Vault 2.0 mode is off. 1 Data Vault classification on a table or column stays stored and shows again when the mode is on.");
    expect(dataVaultOffMessage(0)).toBe("Data Vault 2.0 mode is off.");
    expect(DATA_VAULT_MODE_TEXT).toContain("source table panels");
  });
});
