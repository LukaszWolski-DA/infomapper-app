// The level rules every write keeps (slice 15a, C-3, C-7 as changed on 4 November 2026).

import { describe, expect, it } from "vitest";
import { entity, ids, makeCtx } from "../__fixtures__/domain";
import { buildWriteSet, type Write } from "../changes";
import { dimensionalCount, INFOCUBE_OFF_MESSAGE, LEVEL_CHANGE_MESSAGE, levelWritesRefusal, writesEntities } from "./levels";

const ctx = makeCtx();
const fact = entity(ids.salesOrder, { model_level: "dimensional", name: "Fact Sales" });
const deletedFact = { ...fact, deleted_at: ctx.now, version: 2 };
const off = { infocube: false };
const on = { infocube: true };
const writes = (...w: Write[]) => buildWriteSet(ctx, ids.ws, w).writes;

describe("levelWritesRefusal (C-7)", () => {
  it("refuses a dimensional entity inserted while InfoCube is off, and lets it through while on", () => {
    const insert = writes({ kind: "insert", table: "entity", row: fact });
    expect(levelWritesRefusal(off, insert)).toMatchObject({ code: "forbidden", message: INFOCUBE_OFF_MESSAGE });
    expect(levelWritesRefusal(on, insert)).toBeNull();
  });

  it("refuses a deleted dimensional entity brought back while off (an undo or redo), not one deleted or changed", () => {
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: deletedFact, row: { ...fact, version: 3 } }))).toMatchObject({ code: "forbidden" });
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: fact, row: deletedFact }))).toBeNull();
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: fact, row: { ...fact, name: "Sales", version: 2 } }))).toBeNull();
  });

  it("lets logical entities through while off", () => {
    const customer = entity(ids.customer);
    expect(levelWritesRefusal(off, writes({ kind: "insert", table: "entity", row: customer }))).toBeNull();
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: { ...customer, deleted_at: ctx.now }, row: customer }))).toBeNull();
  });

  it("refuses any write that changes an entity's level, InfoCube on or off; an old image without a level is logical", () => {
    const customer = entity(ids.customer);
    const toDimensional = writes({ kind: "update", table: "entity", before: customer, row: { ...customer, model_level: "dimensional", version: 2 } });
    expect(levelWritesRefusal(on, toDimensional)).toMatchObject({ code: "invalid", message: LEVEL_CHANGE_MESSAGE });
    const old = Object.fromEntries(Object.entries(customer).filter(([k]) => k !== "model_level")) as typeof customer;
    expect(levelWritesRefusal(on, writes({ kind: "update", table: "entity", before: old, row: { ...customer, version: 2 } }))).toBeNull();
  });

  it("reads only writes of entities", () => {
    expect(writesEntities(writes({ kind: "insert", table: "entity", row: fact }))).toBe(true);
    expect(writesEntities([])).toBe(false);
  });
});

describe("dimensionalCount", () => {
  it("counts the workspace's live facts and dimensions only", () => {
    const rows = [entity(ids.customer), fact, { ...fact, id: ids.email, deleted_at: ctx.now }, { ...fact, id: ids.orderId, workspace_id: ids.org }];
    expect(dimensionalCount(rows, ids.ws)).toBe(1);
  });
});
