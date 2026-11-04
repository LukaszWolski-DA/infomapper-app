// InfoCube's derived reads (slice 15b, role-playing R-2 to R-6, R-9; B-5 with R-4): a fact's dimensions one row per
// relationship with its role and active key, the hints, "Used by", "Carries", an attribute's delete preview rows and Add
// key's name. A link whose attribute is no foreign key is inactive (R3): every read ignores it, and it is back with the flag.

import { describe, expect, it } from "vitest";
import { rel, S, star } from "./__fixtures__/star";
import { attributeDependents, carries, cubeIndex, factHints, keyName, snakeCase, typeWord, usedBy, type CubeModel } from "./keys";

const index = (m: CubeModel = star()) => cubeIndex(m);
const texts = (m: CubeModel, fact: string = S.sales) => factHints(cubeIndex(m), fact).map((h) => h.text);
/** The star with ship_date_key's foreign key flag cleared (RP-06): its link stays, inactive. */
const shipFlagCleared = () => {
  const m = star();
  m.attributes = m.attributes.map((a) => (a.id === S.shipKey ? { ...a, is_foreign_key: false } : a));
  return m;
};

describe("keyName (R-3)", () => {
  it("names the key {role}_{pk} without repeating the shared word", () => {
    expect(keyName("Ship date", "date_key", [])).toBe("ship_date_key");
    expect(keyName("Payment date", "date_key", [])).toBe("payment_date_key");
    expect(keyName("Bill to", "customer_key", [])).toBe("bill_to_customer_key");
    expect(keyName("Date", "date_key", [])).toBe("date_key");
    expect(keyName("Ship date", "date_id", [])).toBe("ship_date_id");
    expect(keyName("Ship date", "DATE_SK", [])).toBe("ship_date_sk");
    expect(keyName("Ship date", "id", [])).toBe("ship_date_id");
  });

  it("is the primary key's name without a role, and numbered when taken (case ignored)", () => {
    expect(keyName(null, "customer_key", [])).toBe("customer_key");
    expect(keyName("  ", "customer_key", [])).toBe("customer_key");
    expect(keyName("Ship date", "date_key", ["Ship_Date_Key"])).toBe("ship_date_key_2");
    expect(keyName("Ship date", "date_key", ["ship_date_key", "ship_date_key_2"])).toBe("ship_date_key_3");
  });

  it("snake-cases a role as the prototype does", () => {
    expect(snakeCase("Ship date")).toBe("ship_date");
    expect(snakeCase("BillTo")).toBe("bill_to");
    expect(snakeCase(" Ship–date! ")).toBe("ship_date");
  });
});

describe("a fact's dimensions (R-2)", () => {
  it("are one row per relationship, in the model's order, with the role at the dimension's end and the key", () => {
    const rows = index().factKeys(S.sales);
    expect(rows.map((k) => [k.relationshipId, k.dimensionId, k.role, k.key?.name ?? null, k.pk?.name ?? null])).toEqual([
      [S.orderDate, S.date, "Order date", "date_key", "date_key"],
      [S.shipDate, S.date, "Ship date", "ship_date_key", "date_key"],
      [S.customer, S.cust, null, "customer_key", "customer_key"],
    ]);
    expect(index().factKeys(S.date)).toEqual([]);
  });

  it("read the role at the dimension's end whichever way the relationship runs", () => {
    const m = star();
    m.relationships = m.relationships.map((r) => (r.id === S.shipDate ? { ...r, from_entity_id: S.sales, to_entity_id: S.date, from_role: null, to_role: "Ship date" } : r));
    expect(cubeIndex(m).factKeys(S.sales)[1]).toMatchObject({ role: "Ship date", key: { name: "ship_date_key" } });
  });

  it("ignore an inactive link (R3), and show it again when the flag is back", () => {
    const m = shipFlagCleared();
    expect(cubeIndex(m).factKeys(S.sales)[1]).toMatchObject({ role: "Ship date", key: null });
    expect(m.cubeKeys.find((k) => k.id === S.kShipDate)!.deleted_at).toBeNull();
    m.attributes = m.attributes.map((a) => (a.id === S.shipKey ? { ...a, is_foreign_key: true } : a));
    expect(cubeIndex(m).factKeys(S.sales)[1]).toMatchObject({ key: { id: S.shipKey } });
  });

  it("ignore a deleted link, and a link whose attribute is not the fact's", () => {
    const m = star();
    m.cubeKeys = m.cubeKeys.map((k) => (k.id === S.kShipDate ? { ...k, deleted_at: "2026-11-04T09:00:00.000Z" } : k.id === S.kOrderDate ? { ...k, attribute_id: S.ordersDateKey } : k));
    const rows = cubeIndex(m).factKeys(S.sales);
    expect(rows[0]!.key).toBeNull();
    expect(rows[1]!.key).toBeNull();
  });
});

describe("the fact's hints (B-5 with R-4)", () => {
  it("are none on the complete star; a rename of the dimension's primary key changes nothing (RP-12)", () => {
    expect(texts(star())).toEqual([]);
    const m = star();
    m.attributes = m.attributes.map((a) => (a.id === S.datePk ? { ...a, name: "date_sk" } : a));
    expect(texts(m)).toEqual([]);
    expect(cubeIndex(m).factKeys(S.sales)[0]!.key!.name).toBe("date_key");
  });

  it("name the grain, and a fact without dimensions", () => {
    const m = star();
    m.cubeEntities = m.cubeEntities.map((c) => (c.id === S.cubeSales ? { ...c, grain: "  " } : c));
    m.relationships = [];
    m.attributes = m.attributes.filter((a) => !a.is_foreign_key);
    expect(factHints(cubeIndex(m), S.sales)).toEqual([
      { text: "No grain yet. Write what one row of this fact stands for.", go: { t: "grain" } },
      { text: "No dimension keys. Relate this fact to a dimension and add its key.", go: { t: "entity", id: S.sales } },
    ]);
  });

  it("ask for a role when a dimension is related more than once without one, and name the relationship no key carries (RP-03)", () => {
    const m = star();
    const third = "01900000-0000-7000-8000-0000000c0399";
    m.relationships.push(rel(third, S.date, S.sales, null));
    expect(factHints(cubeIndex(m), S.sales)).toEqual([
      { text: "Dim Date is related 3 times. Name each role.", go: { t: "relationship", id: third } },
      { text: "Dim Date is related, but no key carries it.", go: { t: "relationship", id: third } },
    ]);
    m.relationships = m.relationships.map((r) => (r.id === third ? { ...r, from_role: "Payment date" } : r));
    expect(texts(m)).toEqual(["Dim Date as Payment date is related, but no key carries it."]);
  });

  it("name a role played twice (case ignored), once per extra relationship (RQ-1: a hint, not a refusal)", () => {
    const m = star();
    m.relationships = m.relationships.map((r) => (r.id === S.shipDate ? { ...r, from_role: "order DATE" } : r));
    expect(texts(m)).toEqual(["Dim Date plays order DATE twice."]);
  });

  it("name an inactive link's relationship as carried by no key (RP-06); a deleted relationship's key as carrying nothing (RP-08)", () => {
    expect(texts(shipFlagCleared())).toEqual(["Dim Date as Ship date is related, but no key carries it."]);
    const m = star();
    m.relationships = m.relationships.filter((r) => r.id !== S.shipDate);
    expect(factHints(cubeIndex(m), S.sales)).toEqual([{ text: "ship_date_key is a foreign key but carries no dimension.", go: { t: "attribute", id: S.shipKey } }]);
  });

  it("name a measure that is not numeric, by its type's word", () => {
    const m = star();
    m.cubeMeasures.push({ ...m.cubeMeasures[0]!, id: "01900000-0000-7000-8000-0000000c0599", attribute_id: S.orderNumber });
    expect(texts(m)).toEqual(["order_number is a measure but its type is String. Measures are usually Integer or Decimal."]);
    expect(typeWord({ data_type: "custom", custom_type: "money" })).toBe("money");
    expect(typeWord({ data_type: "datetime", custom_type: null })).toBe("Datetime");
  });

  it("are none for a dimension", () => {
    expect(texts(star(), S.date)).toEqual([]);
  });
});

describe("Used by (R-5) and Carries (R-6)", () => {
  it("lists one row per relationship, facts in the order they first relate (RP-11)", () => {
    const m = star();
    const rows = usedBy(cubeIndex(m), S.date, m.relationships);
    expect(rows.map((k) => [k.factId, k.role, k.key?.name ?? null])).toEqual([
      [S.sales, "Order date", "date_key"],
      [S.sales, "Ship date", "ship_date_key"],
      [S.orders, "Order date", "date_key"],
    ]);
    expect(usedBy(cubeIndex(m), S.sales, m.relationships)).toEqual([]);
  });

  it("says what a foreign key carries while its link is active", () => {
    expect(carries(index(), S.shipKey)).toEqual({ relationshipId: S.shipDate, dimensionId: S.date, role: "Ship date" });
    expect(carries(index(), S.custKey)).toEqual({ relationshipId: S.customer, dimensionId: S.cust, role: null });
    expect(carries(index(), S.quantity)).toBeNull();
    expect(carries(cubeIndex(shipFlagCleared()), S.shipKey)).toBeNull();
  });
});

describe("an attribute's delete preview rows (R-9, RP-07)", () => {
  it("name the key it carries and its measure; nothing for an inactive link or a plain attribute", () => {
    expect(attributeDependents(index(), S.shipKey)).toEqual([["Carries Dim Date as Ship date", "the link is deleted; the relationship stays"]]);
    expect(attributeDependents(index(), S.custKey)).toEqual([["Carries Dim Customer", "the link is deleted; the relationship stays"]]);
    expect(attributeDependents(index(), S.quantity)).toEqual([["1 measure", "deleted"]]);
    expect(attributeDependents(index(), S.orderNumber)).toEqual([]);
    expect(attributeDependents(cubeIndex(shipFlagCleared()), S.shipKey)).toEqual([]);
  });

  it("name both for a foreign key that is also a measure", () => {
    const m = star();
    m.cubeMeasures.push({ ...m.cubeMeasures[0]!, id: "01900000-0000-7000-8000-0000000c0598", attribute_id: S.custKey });
    expect(attributeDependents(cubeIndex(m), S.custKey)).toEqual([
      ["Carries Dim Customer", "the link is deleted; the relationship stays"],
      ["1 measure", "deleted"],
    ]);
  });
});

