import { describe, expect, it } from "vitest";
import { builtins, classificationLink, ids, NOW, sourceColumn, sourceTable } from "../__fixtures__/domain";
import type { SourceColumn, SourceRelationship, SourceRelationshipColumn } from "../types";
import { classificationIndex, type ClassificationCode } from "./classifications";
import { dataVaultReading, READING_EMPTY, READING_FOOTER, readingText, type ReadingInput } from "./data-vault-reading";

// slice 7c, item 21, P10, S7C-12: test tables made for each line
const table = sourceTable();
let n = 0;
const col = (name: string, over: Partial<SourceColumn> = {}) => sourceColumn(`01900000-0000-7000-8000-e1${String(++n).padStart(10, "0")}`, { name, ordinal: n, is_primary_key: false, is_foreign_key: false, ...over });
const rel = (id: string, to: string, over: Partial<SourceRelationship> = {}): SourceRelationship => ({
  id,
  workspace_id: ids.ws,
  version: 1,
  created_at: NOW,
  created_by: ids.actor,
  updated_at: NOW,
  updated_by: ids.actor,
  deleted_at: null,
  source_table_id: table.id,
  to_source_table_id: to,
  name: id,
  kind: "declared",
  missing_since: null,
  ...over,
});
const pair = (relationshipId: string, from: string, i = 0): SourceRelationshipColumn => ({ ...rel(`${relationshipId}-${i}`, table.id), source_relationship_id: relationshipId, from_column_id: from, to_column_id: from, sort_order: i }) as unknown as SourceRelationshipColumn;

function read(columns: SourceColumn[], codes: [string, ClassificationCode][], relationships: SourceRelationship[] = [], pairs: SourceRelationshipColumn[] = [], list = builtins()) {
  const links = codes.map(([id, code]) => classificationLink(code, id === table.id ? { tableId: id } : { columnId: id }));
  const input: ReadingInput = { table, columns, relationships, relationshipColumns: pairs, tableName: (id) => (id === "t-cust" ? "customers" : "?") };
  return dataVaultReading(input, classificationIndex(list, links)).map(readingText);
}

describe("the Data Vault reading", () => {
  it("each line: hub, links, link keys with no relationship, dependent child, driving, multi-active, effective-dated, satellite", () => {
    const no = col("cust_no"), cust = col("cust_id", { is_foreign_key: true }), ref = col("ref_id"), line = col("line_no"), drv = col("driver"), mak = col("phone_type");
    const eff = col("valid_from"), ld = col("load_ts"), name = col("full_name"), mail = col("email"), id = col("id", { is_primary_key: true });
    const columns = [no, cust, ref, line, drv, mak, eff, ld, name, mail, id];
    const lines = read(
      columns,
      [[no.id, "BK"], [ref.id, "LK"], [line.id, "DCK"], [drv.id, "DK"], [mak.id, "MAK"], [eff.id, "EFF"], [ld.id, "LDTS"], [mail.id, "PII"]],
      [rel("FK_a", "t-cust")],
      [pair("FK_a", cust.id)],
    );
    expect(lines).toEqual([
      "Hub on cust_no",
      "Link to customers via cust_id (foreign key; not marked Link key)",
      "Link key ref_id with no relationship known: which table does it point to?",
      "Dependent child key line_no: part of the link’s or satellite’s key, not a hub",
      "Driving key driver: an effectivity satellite on the link tracks it",
      "Multi-active satellite keyed by phone_type",
      "Effective-dated by valid_from",
      // descriptive: valid_from, full_name, email (keys and technical columns left out)
      "Satellite with 3 descriptive columns; 1 with personal data: consider a separate satellite for email",
    ]);
  });

  it("a link whose column is marked Link key; a hub candidate with no business key column", () => {
    const cust = col("cust_id", { is_foreign_key: true });
    expect(read([cust], [[cust.id, "LK"], [table.id, "T_HUB"]], [rel("FK_b", "t-cust")], [pair("FK_b", cust.id)])).toEqual([
      "Marked as a hub candidate, but no column is a business key yet",
      "Link to customers via cust_id",
    ]);
  });

  it("leaves out columns missing from source, retired or not needed, and relationships missing from source", () => {
    const gone = col("gone", { missing_since: NOW }), retired = col("old", { missing_since: NOW, retired_since: NOW }), unused = col("unused", { not_needed: true });
    const fk = col("cust_id", { is_foreign_key: true }), kept = col("kept");
    const lines = read([gone, retired, unused, fk, kept], [[gone.id, "BK"], [retired.id, "BK"], [unused.id, "PII"]], [rel("FK_c", "t-cust", { missing_since: NOW })], [pair("FK_c", fk.id)]);
    expect(lines).toEqual(["Satellite with 1 descriptive column"]);
  });

  it("says nothing for a table with nothing to read; the texts", () => {
    expect(read([col("id", { is_primary_key: true })], [])).toEqual([]);
    expect(READING_EMPTY).toBe("Classify columns (Business key, Link key…) to see what this table suggests.");
    expect(READING_FOOTER).toBe("Hints from the classifications and the source’s keys; nothing is created.");
  });

  it("reads codes: a renamed classification still read, a removed one absent", () => {
    const no = col("cust_no");
    const renamed = builtins().map((c) => (c.code === "BK" ? { ...c, name: "Klucz biznesowy", name_key: "kluczbiznesowy" } : c));
    expect(read([no], [[no.id, "BK"]], [], [], renamed)).toEqual(["Hub on cust_no"]);
    const removed = builtins().map((c) => (c.code === "BK" ? { ...c, deleted_at: NOW } : c));
    expect(read([no], [[no.id, "BK"]], [], [], removed)).toEqual(["Satellite with 1 descriptive column"]);
  });
});
