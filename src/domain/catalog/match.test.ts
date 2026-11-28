import { describe, expect, it } from "vitest";
import type { CatalogItem } from "./items";
import { catalogQuery, definitionLine, highlightRanges, indexCatalogItem, matchTier } from "./match";

const item = (name: string, fields: Partial<CatalogItem["fields"]> = {}): CatalogItem => ({
  kind: "entity",
  kindLabel: "Entity",
  id: "01a0f9e9-0000-7000-8000-000000000001",
  workspaceId: "01a0f9e9-0000-7000-8000-000000000002",
  name,
  path: "",
  definition: fields.definition?.[0] ?? null,
  fields: { alias: [], definition: [], other: [], ...fields },
  marks: [],
  order: 0,
  anchors: { entities: [], tables: [] },
});
const tier = (x: CatalogItem, q: string) => matchTier(indexCatalogItem(x), catalogQuery(q));

describe("the catalog's matching and ranking (slice 39, S39-03, A3.1)", () => {
  it("needs every word, in any of the fields, case and accents ignored", () => {
    const x = item("Customer address", { definition: ["Where the customer lives."], other: ["CRM / crm.dbo.cust_addr"] });
    expect(tier(x, "customer lives")).not.toBeNull();
    expect(tier(x, "address dbo")).not.toBeNull();
    expect(tier(x, "customer phone")).toBeNull();
    expect(tier(item("Źródło danych"), "zrodlo")).not.toBeNull();
    expect(tier(x, "   ")).toBeNull();
  });

  it("ranks: the name, an alias or key, the name's start, the definition, the rest", () => {
    expect(tier(item("Customer"), "customer")).toBe(1);
    expect(tier(item("REQ-102 Customer e-mail", { alias: ["REQ-102"] }), "req-102")).toBe(2);
    expect(tier(item("Kunde", { alias: ["Customer"] }), "CUSTOMER")).toBe(2);
    expect(tier(item("Customer address"), "customer")).toBe(3);
    expect(tier(item("Address", { definition: ["Of a customer."] }), "customer")).toBe(4);
    expect(tier(item("Address", { other: ["customer_addr"] }), "customer")).toBe(5);
    // every word must be in the definition for the fourth tier
    expect(tier(item("Address", { definition: ["Of a customer."], other: ["street"] }), "customer street")).toBe(5);
  });

  it("highlights each word in the original text, merged and accents kept", () => {
    expect(highlightRanges("Źródło danych", ["zrodlo"])).toEqual([[0, 6]]);
    expect(highlightRanges("customer_customer", ["cust", "tomer"])).toEqual([[0, 8], [9, 17]]);
    expect(highlightRanges("Straße", ["strasse"])).toEqual([[0, 6]]);
    expect(highlightRanges("abc", [])).toEqual([]);
  });

  it("cuts a definition to one line around its first match", () => {
    const long = `${"x".repeat(100)} customer ${"y".repeat(300)}`;
    const line = definitionLine(long, ["customer"])!;
    expect(line.text.startsWith("…")).toBe(true);
    expect(line.text.endsWith("…")).toBe(true);
    expect(line.ranges).toHaveLength(1);
    const [start, end] = line.ranges[0]!;
    expect(line.text.slice(start, end)).toBe("customer");
    expect(definitionLine("Short\n\nand plain.", [])).toEqual({ text: "Short and plain.", ranges: [] });
    expect(definitionLine(null, ["x"])).toBeNull();
  });
});
