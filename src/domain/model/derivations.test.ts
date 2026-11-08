import { describe, expect, it } from "vitest";
import { calcMarkTitle, calculationGaps, closesCycle, derivationIndex, derivedRows, derivedRowTitle, rowCounts, throughCalculation } from "./derivations";

type A = { id: string; entity_id: string; name: string; is_calculated: boolean; calc_rule: string | null; deleted_at: string | null };
const attr = (id: string, over: Partial<A> = {}): A => ({ id, entity_id: "E", name: id, is_calculated: false, calc_rule: null, deleted_at: null, ...over });
const input = (attribute_id: string, input_attribute_id: string, sort_order = 0, deleted_at: string | null = null) => ({ attribute_id, input_attribute_id, sort_order, deleted_at });

// net = qty * price * (1 - disc); gross = net + tax; qty, price, tax plain
const model = () => {
  const attributes = [
    attr("qty"),
    attr("price"),
    attr("disc"),
    attr("tax"),
    attr("net", { is_calculated: true, calc_rule: "qty * price * (1 - disc)" }),
    attr("gross", { is_calculated: true, calc_rule: "net + tax" }),
    attr("other", { entity_id: "F" }),
  ];
  const inputs = [input("net", "price", 1), input("net", "qty", 0), input("net", "disc", 2), input("gross", "net", 0), input("gross", "tax", 1)];
  return { attributes, inputs };
};

describe("derivationIndex (slice 18)", () => {
  it("lists a calculation's inputs in order and who reads an attribute", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    expect(ix.inputsOf("net")).toEqual(["qty", "price", "disc"]);
    expect(ix.usersOf("net")).toEqual(["gross"]);
    expect(ix.usersOf("qty")).toEqual(["net"]);
    expect(ix.isCalculated("net")).toBe(true);
    expect(ix.isCalculated("qty")).toBe(false);
    expect(ix.ruleOf("gross")).toBe("net + tax");
    expect(ix.any).toBe(true);
  });

  it("drops inputs that are deleted, of another entity, the attribute itself, or of an attribute that is not calculated", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(
      [...attributes, attr("gone", { deleted_at: "2026-11-08T00:00:00Z" })],
      [...inputs, input("net", "other", 3), input("net", "net", 4), input("net", "gone", 5), input("net", "tax", 6, "2026-11-08T00:00:00Z"), input("qty", "price")],
    );
    expect(ix.inputsOf("net")).toEqual(["qty", "price", "disc"]);
    expect(ix.inputsOf("qty")).toEqual([]);
  });

  it("a calculated attribute may have no inputs (Q1)", () => {
    const ix = derivationIndex([attr("x", { is_calculated: true })], []);
    expect(ix.isCalculated("x")).toBe(true);
    expect(ix.inputsOf("x")).toEqual([]);
  });

  it("finds a cycle at any depth", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    expect(ix.reaches("gross", "qty")).toBe(true);
    expect(ix.reaches("qty", "gross")).toBe(false);
    // net reading gross would close net → gross → net
    expect(closesCycle(ix, "net", "gross")).toBe(true);
    expect(closesCycle(ix, "net", "net")).toBe(true);
    expect(closesCycle(ix, "gross", "qty")).toBe(false);
  });

  it("knows no calculation in a model without one", () => {
    const ix = derivationIndex([attr("a"), attr("b")], []);
    expect(ix.any).toBe(false);
    expect(derivedRows(ix, [attr("a")], () => false)).toEqual({});
  });
});

describe("throughCalculation (slice 18, D-73)", () => {
  it("counts a calculated attribute when every input counts, recursively", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    const direct = new Set(["qty", "price", "disc", "tax"]);
    const counts = throughCalculation(ix, (id) => direct.has(id));
    expect(counts("net")).toBe(true);
    expect(counts("gross")).toBe(true);
    direct.delete("disc");
    const without = throughCalculation(ix, (id) => direct.has(id));
    expect(without("net")).toBe(false);
    expect(without("gross")).toBe(false);
  });

  it("counts an attribute that counts directly whatever its calculation (decision 2a)", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    expect(throughCalculation(ix, (id) => id === "net")("net")).toBe(true);
    // gross reads net (direct) and tax (not): not counted
    expect(throughCalculation(ix, (id) => id === "net")("gross")).toBe(false);
  });

  it("never counts a calculation without inputs, and survives a cycle", () => {
    const ix = derivationIndex([attr("x", { is_calculated: true }), attr("a", { is_calculated: true }), attr("b", { is_calculated: true })], [input("a", "b"), input("b", "a")]);
    const counts = throughCalculation(ix, () => false);
    expect(counts("x")).toBe(false);
    expect(counts("a")).toBe(false);
    expect(counts("b")).toBe(false);
  });
});

describe("calculationGaps and the rows (slice 18)", () => {
  it("names the inputs at any depth that do not count", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    const direct = new Set(["qty", "tax"]);
    expect(calculationGaps(ix, "gross", (id) => direct.has(id))).toEqual(["price", "disc"]);
    expect(calculationGaps(ix, "net", () => true)).toEqual([]);
  });

  it("gives a calculated row that does not count directly its state, rule and inputs", () => {
    const { attributes, inputs } = model();
    const ix = derivationIndex(attributes, inputs);
    const direct = new Set(["qty", "price", "disc"]);
    const rows = derivedRows(ix, attributes, (id) => direct.has(id));
    expect(rows).toEqual({
      net: { ok: true, rule: "qty * price * (1 - disc)", inputs: ["qty", "price", "disc"] },
      gross: { ok: false, rule: "net + tax", inputs: ["net", "tax"] },
    });
    expect(derivedRowTitle(rows.net!, "mapped")).toBe("Calculated from qty, price, disc: every input is mapped");
    expect(derivedRowTitle(rows.gross!, "fed")).toBe("Calculated from net, tax: not every input is fed yet");
    expect(derivedRowTitle({ ok: false, rule: null, inputs: [] }, "mapped")).toBe("Calculated from no attributes yet");
    expect(calcMarkTitle(null)).toBe("Calculated: no rule yet");
    expect(calcMarkTitle("a * b")).toBe("Calculated: a * b");
  });

  it("counts a row with a mapping or a calculation that counts", () => {
    expect(rowCounts({ mappings: 1 })).toBe(true);
    expect(rowCounts({ mappings: 0 })).toBe(false);
    expect(rowCounts({ mappings: 0, calc: { square: "ok" } })).toBe(true);
    expect(rowCounts({ mappings: 0, calc: { square: "gap" } })).toBe(false);
    expect(rowCounts({ mappings: 0, calc: {} })).toBe(false);
  });
});
