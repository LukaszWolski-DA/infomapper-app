import { describe, expect, it } from "vitest";
import { prunePlaces, readPlace, savePlace } from "./history-places";

/** A `sessionStorage` stand-in. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

const place = (id: string) => ({ canvasId: "c1", sel: { t: "card", id } });

describe("history places", () => {
  it("keeps a place per entry key and reads it back", () => {
    const s = memoryStorage();
    savePlace(s, "k1", place("a"), ["k1"]);
    expect(readPlace(s, "k1")).toEqual(place("a"));
    expect(readPlace(s, "k2")).toBeNull();
  });

  it("forgets the places of entries no longer in the tab's history on every save", () => {
    const s = memoryStorage();
    savePlace(s, "k1", place("a"), ["k1"]);
    savePlace(s, "k2", place("b"), ["k1", "k2"]);
    // the person went back to k1 and selected something else: k2 was cut off
    savePlace(s, "k3", place("c"), ["k1", "k3"]);
    expect(readPlace(s, "k2")).toBeNull();
    expect(readPlace(s, "k1")).toEqual(place("a"));
    expect(readPlace(s, "k3")).toEqual(place("c"));
  });

  it("leaves other keys in the storage alone and counts what it pruned", () => {
    const s = memoryStorage();
    s.setItem("something-else", "1");
    savePlace(s, "k1", place("a"), ["k1"]);
    savePlace(s, "k2", place("b"), ["k1", "k2"]);
    expect(prunePlaces(s, [])).toBe(2);
    expect(s.getItem("something-else")).toBe("1");
  });

  it("clears an entry's place when it is saved as none", () => {
    const s = memoryStorage();
    savePlace(s, "k1", place("a"), ["k1"]);
    savePlace(s, "k1", null, ["k1"]);
    expect(readPlace(s, "k1")).toBeNull();
  });

  it("reads a broken value as no place", () => {
    const s = memoryStorage();
    s.setItem("infomapper:place:k1", "{");
    expect(readPlace(s, "k1")).toBeNull();
  });
});
