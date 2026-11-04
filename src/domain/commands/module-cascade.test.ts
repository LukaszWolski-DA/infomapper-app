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
});
