// A module's rows go with their registered parents (slice 15a, E14), with a module registered here by hand: the
// domain does not import a module (InfoCube's own tables are tested through the composition root in tests/).

import { describe, expect, it } from "vitest";
import { attribute, entity, ids, makeCtx } from "../__fixtures__/domain";
import { buildWriteSet, type Write } from "../changes";
import { cascadingModuleTables, moduleCascade } from "./module-cascade";
import { CORE_UNDO_TABLES, undoTables } from "./undo";

const tables = undoTables({
  cube_entity: { parents: [["entity_id", "entity"]], noun: "fact or dimension" },
  cube_measure: { parents: [["attribute_id", "attribute"]], noun: "measure" },
} as never);
const ctx = makeCtx();
const std = { workspace_id: ids.ws, version: 1, created_at: ctx.now, created_by: ids.actor, updated_at: ctx.now, updated_by: ids.actor, deleted_at: null };
const fact = entity(ids.salesOrder, { model_level: "dimensional" });
const amount = attribute(ids.orderId, { entity_id: ids.salesOrder });
const cube = { ...std, id: "c1", entity_id: ids.salesOrder };
const otherCube = { ...std, id: "c2", entity_id: ids.customer };
const measure = { ...std, id: "m1", attribute_id: ids.orderId };
const softDelete = (table: "entity" | "attribute", row: typeof fact | typeof amount): Write =>
  ({ kind: "update", table, before: row, row: { ...row, deleted_at: ctx.now, version: row.version + 1 } }) as Write;

describe("moduleCascade (E14)", () => {
  it("names the module tables whose parents the writes delete, none for an insert or with no module", () => {
    expect(cascadingModuleTables([softDelete("entity", fact)], tables)).toEqual(["cube_entity"]);
    expect(cascadingModuleTables([softDelete("entity", fact), softDelete("attribute", amount)], tables)).toEqual(["cube_entity", "cube_measure"]);
    expect(cascadingModuleTables([{ kind: "insert", table: "entity", row: fact }], tables)).toEqual([]);
    expect(cascadingModuleTables([softDelete("entity", fact)], CORE_UNDO_TABLES)).toEqual([]);
  });

  it("soft-deletes the live rows pointing to a deleted parent, once, and nothing else", () => {
    const writes = buildWriteSet(ctx, ids.ws, [softDelete("entity", fact), softDelete("attribute", amount)]).writes;
    const extra = moduleCascade(ctx, writes, tables, { cube_entity: [cube, otherCube], cube_measure: [measure] });
    expect(extra.map((w) => `${w.kind}:${w.table}:${(w as { row: { id: string } }).row.id}`)).toEqual(["update:cube_entity:c1", "update:cube_measure:m1"]);
    expect((extra[0] as { row: unknown }).row).toMatchObject({ deleted_at: ctx.now, version: 2, updated_by: ids.actor });
    // a row the command already deleted is not written twice
    const already: Write = { kind: "update", table: "cube_entity", before: cube, row: { ...cube, deleted_at: ctx.now, version: 2 } } as unknown as Write;
    expect(moduleCascade(ctx, [...writes, already], tables, { cube_entity: [cube], cube_measure: [] })).toEqual([]);
  });

  it("follows a module row that points to another module row (15c's inputs to their mapping)", () => {
    const chained = undoTables({
      cube_entity: { parents: [["entity_id", "entity"]], noun: "fact or dimension" },
      cube_measure: { parents: [["cube_id", "cube_entity"]], noun: "measure" },
    } as never);
    const onCube = { ...std, id: "m2", cube_id: "c1" };
    expect(cascadingModuleTables([softDelete("entity", fact)], chained)).toEqual(["cube_entity", "cube_measure"]);
    const extra = moduleCascade(ctx, [softDelete("entity", fact)], chained, { cube_entity: [cube], cube_measure: [onCube] });
    expect(extra.map((w) => w.table)).toEqual(["cube_entity", "cube_measure"]);
  });

  describe("goesWhole (slice 15c, Q-5)", () => {
    const mapped = undoTables({
      cube_mapping: { parents: [["attribute_id", "attribute"]], noun: "dimensional mapping", goesWhole: [["cube_mapping_input", "mapping_id", "attribute_id"]] },
      cube_mapping_input: { parents: [["mapping_id", "cube_mapping"], ["attribute_id", "attribute"]], noun: "dimensional mapping input" },
    } as never);
    const target = attribute(ids.customerId, { entity_id: ids.customer });
    const [a, b, c] = ["in-a", "in-b", "in-c"].map((id) => attribute(id, { entity_id: ids.salesOrder }));
    const mapping = { ...std, id: "map1", attribute_id: target.id };
    const other = { ...std, id: "map2", attribute_id: target.id };
    const inputs = [a!, b!, c!].map((x, i) => ({ ...std, id: `i${i}`, mapping_id: "map1", attribute_id: x.id, sort_order: i }));
    const otherInput = { ...std, id: "i9", mapping_id: "map2", attribute_id: "elsewhere", sort_order: 0 };
    const rows = { cube_mapping: [mapping, other], cube_mapping_input: [...inputs, otherInput] };
    const deletedIds = (extra: Write[]) => extra.map((w) => `${w.table}:${(w as { row: { id: string } }).row.id}`).sort();

    it("takes a mapping whole when one of its inputs goes with its attribute, with its other inputs", () => {
      const writes = [softDelete("attribute", b!)];
      expect(cascadingModuleTables(writes, mapped).sort()).toEqual(["cube_mapping", "cube_mapping_input"]);
      expect(deletedIds(moduleCascade(ctx, writes, mapped, rows))).toEqual(["cube_mapping:map1", "cube_mapping_input:i0", "cube_mapping_input:i1", "cube_mapping_input:i2"]);
    });

    it("leaves the mapping when an input is removed on purpose", () => {
      const removed: Write = { kind: "update", table: "cube_mapping_input", before: inputs[1], row: { ...inputs[1], deleted_at: ctx.now, version: 2 } } as unknown as Write;
      expect(moduleCascade(ctx, [removed], mapped, rows)).toEqual([]);
    });

    it("takes the mapping and its inputs when its target goes, and leaves the other mappings", () => {
      const writes = [softDelete("attribute", target)];
      expect(deletedIds(moduleCascade(ctx, writes, mapped, rows))).toEqual([
        "cube_mapping:map1", "cube_mapping:map2", "cube_mapping_input:i0", "cube_mapping_input:i1", "cube_mapping_input:i2", "cube_mapping_input:i9",
      ]);
    });

    it("writes each row once when several inputs go together", () => {
      const extra = moduleCascade(ctx, [softDelete("attribute", a!), softDelete("attribute", c!)], mapped, rows);
      expect(deletedIds(extra)).toEqual(["cube_mapping:map1", "cube_mapping_input:i0", "cube_mapping_input:i1", "cube_mapping_input:i2"]);
    });
  });
});
