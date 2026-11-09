import { describe, expect, it } from "vitest";
import { clampAt, createText, enterAction, nextFocus, noneText, pickNorm, visibleItems, type PickItem } from "./pick";

const items: PickItem[] = [
  { id: "a", label: "Customer" },
  { id: "b", label: "Order", key: "REQ-104" },
  { id: "c", label: "Product", done: true },
];

describe("the picker (slice 17)", () => {
  it("filters by the label and the key, case ignored", () => {
    expect(visibleItems(items, "").map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(visibleItems(items, " cust ").map((i) => i.id)).toEqual(["a"]);
    expect(visibleItems(items, "req-1").map((i) => i.id)).toEqual(["b"]);
  });

  it("says the empty text without items, and that nothing matches otherwise", () => {
    expect(noneText({ items: [], empty: "No concepts yet." }, "x")).toBe("No concepts yet.");
    expect(noneText({ items, empty: "No concepts yet." }, " zz ")).toBe("Nothing matches “zz”.");
  });

  it("Enter picks the one item left, or confirms what is checked", () => {
    expect(enterAction(false, [items[0]!], 0)).toEqual({ pick: "a" });
    expect(enterAction(false, items.slice(0, 2), 0)).toBeNull();
    expect(enterAction(false, [], 0)).toBeNull();
    expect(enterAction(true, items, 0)).toBeNull();
    expect(enterAction(true, items, 2)).toEqual({ confirm: true });
  });

  it("the arrows move through the items and back up to the field", () => {
    expect(nextFocus(-1, 3, "ArrowDown")).toBe(0);
    expect(nextFocus(2, 3, "ArrowDown")).toBe(0);
    expect(nextFocus(1, 3, "ArrowUp")).toBe(0);
    expect(nextFocus(0, 3, "ArrowUp")).toBe(-1);
    expect(nextFocus(-1, 0, "ArrowDown")).toBe(-1);
  });

  it("stays 8 px inside the window", () => {
    expect(clampAt({ x: 900, y: 700 }, { width: 260, height: 200 }, { width: 1000, height: 800 })).toEqual({ x: 732, y: 592 });
    expect(clampAt({ x: -5, y: 2 }, { width: 260, height: 200 }, { width: 1000, height: 800 })).toEqual({ x: 8, y: 8 });
  });
});

describe("the picker's create item (slice 21, D-76)", () => {
  const create = { label: (t: string) => `New concept “${t}”`, act: () => {} };
  const concepts: PickItem[] = [
    { id: "s", label: "Sales" },
    { id: "r", label: "Reference data" },
  ];

  it("compares ignoring case and extra spaces", () => {
    expect(pickNorm("  Reference   DATA ")).toBe("reference data");
  });

  it("is absent with an empty filter, an exact match (other case, extra spaces) or no create option", () => {
    expect(createText({ items: concepts, create }, "   ")).toBe("");
    expect(createText({ items: concepts, create }, " reference   data ")).toBe("");
    expect(createText({ items: concepts, create }, "SALES")).toBe("");
    expect(createText({ items: concepts }, "Finance")).toBe("");
  });

  it("is the typed text with its extra spaces removed otherwise, also beside matches", () => {
    expect(createText({ items: concepts, create }, "  Fin   ance ")).toBe("Fin ance");
    expect(createText({ items: concepts, create }, "sal")).toBe("sal");
    expect(createText({ items: [], create }, "Retail")).toBe("Retail");
  });

  it("Enter keeps D-72: one match is picked, the create item only when nothing matches, several do nothing", () => {
    expect(enterAction(false, [concepts[0]!], 0, "sal")).toEqual({ pick: "s" });
    expect(enterAction(false, [], 0, "Finance")).toEqual({ create: "Finance" });
    expect(enterAction(false, concepts, 0, "a")).toBeNull();
    expect(enterAction(false, [], 0, "")).toBeNull();
    expect(enterAction(true, [], 0, "Finance")).toBeNull();
  });
});
