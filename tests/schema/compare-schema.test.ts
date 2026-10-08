import { describe, expect, it } from "vitest";
import { compareSchemas, NOT_IN_DOMAIN_YET, tablesFromPg, type PgColumnRow, type TableShape } from "./compare-schema";
import { domainTables } from "./domain-tables";

const pg = (table_name: string, column_name: string, data_type: string, nullable = false): PgColumnRow => ({
  table_name,
  column_name,
  data_type,
  is_nullable: nullable ? "YES" : "NO",
});

// canvas_item as the migration creates it (a few columns), and frame, which no slice has built yet
const database = tablesFromPg([
  pg("canvas_item", "id", "uuid"),
  pg("canvas_item", "x", "numeric"),
  pg("canvas_item", "width", "integer", true),
  pg("canvas_item", "frame_id", "uuid", true),
  pg("canvas_item", "updated_at", "timestamp with time zone"),
  pg("canvas", "look", "jsonb"),
  pg("frame", "id", "uuid"),
]).tables;

const domain: TableShape[] = [
  {
    table: "canvas_item",
    columns: [
      { name: "id", kind: "uuid", nullable: false },
      { name: "x", kind: "number", nullable: false },
      { name: "width", kind: "number", nullable: true },
      { name: "frame_id", kind: "uuid", nullable: true },
      { name: "updated_at", kind: "timestamptz", nullable: false },
    ],
  },
  { table: "canvas", columns: [{ name: "look", kind: "jsonb", nullable: false }] },
];

const withColumn = (table: string, name: string, change: Partial<TableShape["columns"][number]> | null): TableShape[] =>
  domain.map((t) =>
    t.table !== table
      ? t
      : { ...t, columns: change === null ? t.columns.filter((c) => c.name !== name) : t.columns.map((c) => (c.name === name ? { ...c, ...change } : c)) },
  );

describe("compareSchemas (AD-31: the migrations against the domain)", () => {
  it("finds nothing when tables, columns, types and nullability agree", () => {
    expect(compareSchemas(domain, database, ["frame"])).toEqual([]);
  });

  it("fails on a mismatch: a different type, nullability, or a column on one side only", () => {
    expect(compareSchemas(withColumn("canvas_item", "frame_id", { kind: "text" }), database, ["frame"])).toEqual([
      "canvas_item.frame_id: the domain says text, the database uuid",
    ]);
    expect(compareSchemas(withColumn("canvas_item", "width", { nullable: false }), database, ["frame"])).toEqual([
      "canvas_item.width: the domain says not null, the database nullable",
    ]);
    expect(compareSchemas(withColumn("canvas_item", "x", null), database, ["frame"])).toEqual(["canvas_item.x: in the database, missing in the domain"]);
    expect(compareSchemas(withColumn("canvas_item", "x", { name: "pos_x" }), database, ["frame"])).toEqual([
      "canvas_item.pos_x: in the domain, missing in the database",
      "canvas_item.x: in the database, missing in the domain",
    ]);
  });

  it("fails on a table on one side only, unless it is on the “not in the domain yet” list, and keeps that list current", () => {
    expect(compareSchemas(domain, database, [])).toEqual(['frame: created by a migration, but neither in the domain nor on the "not in the domain yet" list']);
    expect(compareSchemas([...domain, { table: "note", columns: [] }], database, ["frame"])).toEqual(["note: in the domain, but no migration creates it"]);
    expect(compareSchemas([...domain, { table: "frame", columns: [{ name: "id", kind: "uuid", nullable: false }] }], database, ["frame"])).toEqual([
      'frame: the domain describes it now; take it off the "not in the domain yet" list',
    ]);
    expect(compareSchemas(domain, database, ["frame", "label"])).toEqual(['label: on the "not in the domain yet" list, but no migration creates it']);
  });

  it("reports a Postgres type the domain cannot describe", () => {
    expect(tablesFromPg([pg("t", "c", "character varying")]).unsupported).toEqual(['t.c: type "character varying" is not one the domain can describe']);
  });
});

describe("domainTables (the domain's row types, per table of the local adapter)", () => {
  const tables = domainTables();
  const table = (name: string) => tables.find((t) => t.table === name)!;
  const column = (t: string, c: string) => table(t).columns.find((x) => x.name === c);

  it("reads every stored table, none of the not-yet-built ones", () => {
    expect(tables.map((t) => t.table).sort()).toEqual(
      [
        "app_user", "attribute", "canvas", "canvas_item", "change_event", "concept", "entity", "frame", "mapping", "mapping_input",
        "organization", "organization_member", "project", "project_canvas", "relationship", "source_column",
        "source_system", "source_table", "workspace", "workspace_member",
      ].sort(),
    );
    for (const t of NOT_IN_DOMAIN_YET) expect(tables.map((x) => x.table)).not.toContain(t);
  });

  it("tells the column types and nullability from the declared types, inherited columns included", () => {
    expect(column("canvas_item", "id")).toEqual({ name: "id", kind: "uuid", nullable: false });
    expect(column("canvas_item", "frame_id")).toEqual({ name: "frame_id", kind: "uuid", nullable: true });
    expect(column("canvas_item", "deleted_at")).toEqual({ name: "deleted_at", kind: "timestamptz", nullable: true });
    expect(column("canvas_item", "row_filter")).toEqual({ name: "row_filter", kind: "text", nullable: false });
    expect(column("canvas_item", "live_level")).toEqual({ name: "live_level", kind: "text", nullable: true });
    expect(column("canvas_item", "width")).toEqual({ name: "width", kind: "number", nullable: true });
    expect(column("canvas_item", "collapsed")).toEqual({ name: "collapsed", kind: "boolean", nullable: false });
    expect(column("frame", "kind")).toEqual({ name: "kind", kind: "text", nullable: false });
    expect(column("frame", "color")).toEqual({ name: "color", kind: "text", nullable: true });
    expect(column("frame", "x")).toEqual({ name: "x", kind: "number", nullable: false });
    expect(column("canvas", "look")).toEqual({ name: "look", kind: "jsonb", nullable: false });
    expect(column("change_event", "before_image")).toEqual({ name: "before_image", kind: "jsonb", nullable: true });
    expect(column("relationship", "from_min")).toEqual({ name: "from_min", kind: "number", nullable: false });
    expect(column("attribute", "type_scale")).toEqual({ name: "type_scale", kind: "number", nullable: true });
  });
});
