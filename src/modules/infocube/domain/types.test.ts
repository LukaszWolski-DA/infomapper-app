// InfoCube types (slice 19, D-74): the aggregate and outrigger rules, the command's new fields with their checks and
// undo names, the four hints, and the texts built from them (the chip, the Cube tab, the history label, the preview).
// The older rows' upgrade, the store, the cascade and undo are in `tests/infocube-types.test.ts`.

import { describe, expect, it } from "vitest";
import { access, makeCtx } from "@/domain/__fixtures__/domain";
import type { CommandResult } from "@/domain/changes";
import { relationship } from "@/domain/__fixtures__/domain";
import { aggregateIndex, AGGREGATE_TEXTS, baseChoices } from "./aggregates";
import { measure, S, star } from "./__fixtures__/star";
import {
  BASE_ON_DIMENSION,
  FACT_TYPE_ON_DIMENSION,
  FACTLESS_ON_DIMENSION,
  KIND_ON_FACT,
  PERIOD_ON_FACT,
  updateCubeEntity,
} from "./commands";
import { cubeIndex, factHints, TYPE_HINTS } from "./keys";
import { outriggers } from "./outriggers";
import type { CubeEntity } from "./types";
import { cubeTitle, entityDependents, historyLabel, roleTitle, tabMeta, typeContext } from "./view";

const on = { infocube: true };
const modeler = () => access("modeler", on);
const ok = <T,>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};
const withRows = (over: Record<string, Partial<CubeEntity>>) => {
  const m = star();
  m.cubeEntities = m.cubeEntities.map((c) => ({ ...c, ...(over[c.id] ?? {}) }));
  return m;
};
const row = (m: ReturnType<typeof star>, id: string) => m.cubeEntities.find((c) => c.id === id)!;
const update = (m: ReturnType<typeof star>, id: string, input: object) =>
  updateCubeEntity(makeCtx(), modeler(), { cube: row(m, id), cubeEntities: m.cubeEntities, entities: m.entities }, { cubeEntityId: id, expectedVersion: 1, ...input });

describe("aggregates (D-74): a base that is a live fact, never itself, no cycle", () => {
  it("reads a base, its aggregates and the chain at any depth", () => {
    const m = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales } });
    const a = aggregateIndex(m.cubeEntities);
    expect(a.baseOf(S.orders)).toBe(S.sales);
    expect(a.aggregatesOf(S.sales)).toEqual([S.orders]);
    expect(a.reaches(S.orders, S.sales)).toBe(true);
    expect(a.reaches(S.sales, S.orders)).toBe(false);
  });

  it("reads a base that is itself, a dimension or a deleted fact as none", () => {
    for (const base of [S.orders, S.date, "01900000-0000-7000-8000-0000000cffff"]) {
      expect(aggregateIndex(withRows({ [S.cubeOrders]: { base_fact_entity_id: base } }).cubeEntities).baseOf(S.orders)).toBeNull();
    }
    const deleted = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales }, [S.cubeSales]: { deleted_at: "2026-11-08T10:00:00.000Z" } });
    expect(aggregateIndex(deleted.cubeEntities).baseOf(S.orders)).toBeNull();
  });

  it("ends a stored cycle instead of looping", () => {
    const m = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales }, [S.cubeSales]: { base_fact_entity_id: S.orders } });
    const a = aggregateIndex(m.cubeEntities);
    expect(a.reaches(S.orders, S.orders)).toBe(true);
    expect(a.reaches(S.orders, S.date)).toBe(false);
  });

  it("offers the other facts whose chain does not reach this one", () => {
    const m = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales } });
    const a = aggregateIndex(m.cubeEntities);
    const isFact = (id: string) => [S.sales, S.orders].includes(id as never);
    const order = [S.sales, S.orders, S.date, S.cust];
    expect(baseChoices(a, S.sales, order, isFact)).toEqual([]);
    expect(baseChoices(a, S.orders, order, isFact)).toEqual([S.sales]);
  });
});

describe("outriggers (D-74): the one end of a relationship between two dimensions, derived", () => {
  const roles: Record<string, "fact" | "dimension"> = { a: "dimension", b: "dimension", f: "fact" };
  const roleOf = (id: string) => roles[id];
  const r = (from: string, to: string, from_max: "1" | "n", to_max: "1" | "n", over = {}) =>
    relationship({ id: `${from}${to}${from_max}${to_max}`, from_entity_id: from, to_entity_id: to, from_max, to_max, ...over });

  it("1:N gives the one end, wherever it is; 1:1 the from end", () => {
    expect(outriggers([r("a", "b", "1", "n")], roleOf).outOf("a")).toEqual(["b"]);
    expect(outriggers([r("a", "b", "1", "n")], roleOf).outs("b")).toEqual(["a"]);
    expect(outriggers([r("a", "b", "n", "1")], roleOf).outOf("b")).toEqual(["a"]);
    expect(outriggers([r("a", "b", "1", "1")], roleOf).outOf("a")).toEqual(["b"]);
  });

  it("gives none for many-to-many, a loop, a fact's relationship or a deleted relationship", () => {
    const o = outriggers([r("a", "b", "n", "n"), r("a", "a", "1", "n"), r("a", "f", "1", "n"), r("b", "a", "1", "n", { deleted_at: "2026-11-08T10:00:00.000Z" })], roleOf);
    expect([o.outOf("a"), o.outOf("b"), o.outs("a"), o.outs("b")]).toEqual([[], [], [], []]);
  });
});

describe("updateCubeEntity's types (D-74)", () => {
  it("sets each field with its own undo name", () => {
    const m = star();
    const cases: [string, object, Record<string, unknown>, string][] = [
      [S.cubeSales, { factType: "periodic" }, { fact_type: "periodic" }, "Change fact type"],
      [S.cubeSales, { isFactless: true }, { is_factless: true }, "Mark fact factless"],
      [S.cubeOrders, { baseFactEntityId: S.sales }, { base_fact_entity_id: S.sales }, "Set aggregate base"],
      [S.cubeDate, { dimKind: "junk" }, { dim_kind: "junk" }, "Change dimension kind"],
      [S.cubeDate, { history: "snapshot" }, { history: "snapshot" }, "Change history"],
      [S.cubeDate, { snapshotPeriod: "  Month-end " }, { snapshot_period: "Month-end" }, "Change snapshot period"],
    ];
    for (const [id, input, written, label] of cases) {
      const r = ok(update(m, id, input));
      expect(r.writeSet.writes[0]).toMatchObject({ table: "cube_entity", row: { ...written, version: 2 } });
      expect(r.writeSet.label).toBe(label);
    }
    const based = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales }, [S.cubeSales]: { is_factless: true } });
    expect(ok(update(based, S.cubeOrders, { baseFactEntityId: null })).writeSet.label).toBe("Clear aggregate base");
    expect(ok(update(based, S.cubeSales, { isFactless: false })).writeSet.label).toBe("Unmark fact factless");
  });

  it("keeps the snapshot period when another history is chosen", () => {
    const m = withRows({ [S.cubeDate]: { history: "snapshot", snapshot_period: "Month-end" } });
    expect(ok(update(m, S.cubeDate, { history: "history" })).writeSet.writes[0]).toMatchObject({ row: { history: "history", snapshot_period: "Month-end" } });
  });

  it("refuses each field on the wrong role", () => {
    const m = star();
    const refused = (id: string, input: object) => (update(m, id, input) as { error: { message: string } }).error.message;
    expect(refused(S.cubeDate, { factType: "periodic" })).toBe(FACT_TYPE_ON_DIMENSION);
    expect(refused(S.cubeDate, { isFactless: true })).toBe(FACTLESS_ON_DIMENSION);
    expect(refused(S.cubeDate, { baseFactEntityId: S.sales })).toBe(BASE_ON_DIMENSION);
    expect(refused(S.cubeSales, { dimKind: "junk" })).toBe(KIND_ON_FACT);
    expect(refused(S.cubeSales, { snapshotPeriod: "Daily" })).toBe(PERIOD_ON_FACT);
    expect(update(m, S.cubeSales, { factType: "weekly" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses a base that is the fact itself, not a fact, or closes a cycle at any depth", () => {
    const m = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales } });
    expect(update(m, S.cubeSales, { baseFactEntityId: S.sales })).toMatchObject({ ok: false, error: { message: AGGREGATE_TEXTS.self } });
    expect(update(m, S.cubeSales, { baseFactEntityId: S.date })).toMatchObject({ ok: false, error: { message: AGGREGATE_TEXTS.notFact } });
    expect(update(m, S.cubeSales, { baseFactEntityId: S.orders })).toMatchObject({ ok: false, error: { message: AGGREGATE_TEXTS.cycle("Fact Orders", "Fact Sales") } });
  });

  it("refuses a reviewer (AD-05)", () => {
    const m = star();
    const r = updateCubeEntity(makeCtx(), access("reviewer", on), { cube: row(m, S.cubeSales), cubeEntities: m.cubeEntities }, { cubeEntityId: S.cubeSales, expectedVersion: 1, factType: "periodic" });
    expect(r).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("the four hints (D-74, prototype factHints)", () => {
  const hintsOf = (m: ReturnType<typeof star>, fact: string) => factHints(cubeIndex(m), fact).map((h) => [h.text, h.go]);

  it("a factless fact with measures opens its first measure", () => {
    const m = withRows({ [S.cubeSales]: { is_factless: true } });
    expect(hintsOf(m, S.sales)).toContainEqual([TYPE_HINTS.factless(["quantity"]), { t: "attribute", id: S.quantity }]);
    m.cubeMeasures = [];
    expect(hintsOf(m, S.sales).map(([t]) => t)).not.toContain(TYPE_HINTS.factless([]));
  });

  it("a periodic snapshot names each additive measure", () => {
    const m = withRows({ [S.cubeSales]: { fact_type: "periodic" } });
    m.cubeMeasures.push(measure("01900000-0000-7000-8000-0000000c0503", S.orderNumber, { additivity: "non" }));
    const texts = hintsOf(m, S.sales).map(([t]) => t);
    expect(texts).toContain(TYPE_HINTS.periodic("quantity"));
    expect(texts).not.toContain(TYPE_HINTS.periodic("order_number"));
  });

  it("an accumulating snapshot without a dimension in two roles", () => {
    const m = withRows({ [S.cubeSales]: { fact_type: "accumulating" }, [S.cubeOrders]: { fact_type: "accumulating" } });
    expect(hintsOf(m, S.sales).map(([t]) => t)).not.toContain(TYPE_HINTS.accumulating);
    expect(hintsOf(m, S.orders)).toContainEqual([TYPE_HINTS.accumulating, { t: "entity", id: S.orders }]);
  });

  it("an aggregate with a dimension its base lacks, one hint per dimension", () => {
    const m = withRows({ [S.cubeSales]: { base_fact_entity_id: S.orders } });
    expect(hintsOf(m, S.sales).filter(([t]) => String(t).includes("its base"))).toEqual([[TYPE_HINTS.base("Dim Customer", "Fact Orders"), { t: "entity", id: S.cust }]]);
    expect(hintsOf(withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales } }), S.orders).filter(([t]) => String(t).includes("its base"))).toEqual([]);
  });
});

describe("the texts (D-74, prototype cubeTitle, scdLabel, cubeTree, cubeDependents)", () => {
  const ctxOf = (m: ReturnType<typeof star>) => typeContext(m.cubeEntities, m.relationships, m.entities);

  it("labels the history", () => {
    expect([historyLabel({ history: "keep", snapshot_period: null }), historyLabel({ history: "history", snapshot_period: "x" }), historyLabel(undefined)]).toEqual(["SCD 0", "SCD 2", "SCD 1"]);
    expect(historyLabel({ history: "snapshot", snapshot_period: " Month-end " })).toBe("Snapshot · Month-end");
    expect(historyLabel({ history: "snapshot", snapshot_period: null })).toBe("Snapshot");
  });

  it("builds the chip and its title; a plain fact and dimension keep Fact and Dimension", () => {
    const plain = star();
    expect(cubeTitle(row(plain, S.cubeSales), ctxOf(plain))).toEqual({ short: "Fact", long: "Transaction fact" });
    expect(roleTitle(row(plain, S.cubeDate), ctxOf(plain))).toBe("Dimension (InfoCube)");
    const m = withRows({
      [S.cubeOrders]: { fact_type: "accumulating", is_factless: true, base_fact_entity_id: S.sales },
      [S.cubeDate]: { dim_kind: "junk", history: "snapshot", snapshot_period: "Month-end" },
    });
    m.relationships.push(relationship({ id: "01900000-0000-7000-8000-0000000c0399", from_entity_id: S.cust, to_entity_id: S.date, from_max: "1", to_max: "n" }));
    expect(cubeTitle(row(m, S.cubeOrders), ctxOf(m))).toEqual({ short: "Fact · Accumulating · Factless · Aggregate", long: "Accumulating snapshot fact, factless, aggregate of Fact Sales" });
    expect(cubeTitle(row(m, S.cubeDate), ctxOf(m))).toEqual({ short: "Dimension · Junk · Snapshot", long: "Junk dimension, snapshot (Month-end)" });
    expect(cubeTitle(row(m, S.cubeCust), ctxOf(m))).toEqual({ short: "Dimension · Outrigger", long: "Dimension, outrigger of Dim Date" });
    expect(tabMeta(row(m, S.cubeOrders), ctxOf(m))).toBe("Accumulating · factless · aggregate · grain set");
    expect(tabMeta(row(m, S.cubeDate), ctxOf(m))).toBe("Snapshot · Month-end · junk");
    expect(tabMeta(row(m, S.cubeCust), ctxOf(m))).toBe("SCD 1 · outrigger");
    expect(tabMeta(row(plain, S.cubeSales), ctxOf(plain))).toBe("grain set");
  });

  it("names a snapshot's history and a base fact's aggregates in the delete preview", () => {
    const m = withRows({ [S.cubeOrders]: { base_fact_entity_id: S.sales }, [S.cubeDate]: { history: "snapshot", snapshot_period: "Month-end" } });
    const model = { entities: m.entities, relationships: m.relationships, attributes: m.attributes };
    expect(entityDependents(S.sales, model, m.cubeEntities, m.cubeMeasures)).toContainEqual(["Fact Orders", "loses its base fact"]);
    expect(entityDependents(S.date, model, m.cubeEntities, m.cubeMeasures)[0]).toEqual(["Dimension", "its history (Snapshot · Month-end) deleted"]);
    expect(entityDependents(S.cust, model, m.cubeEntities, m.cubeMeasures)[0]).toEqual(["Dimension", "SCD type 1 deleted"]);
  });
});
