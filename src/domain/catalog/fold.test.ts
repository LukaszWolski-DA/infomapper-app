import { describe, expect, it } from "vitest";
import { foldedWords, foldText, foldWithOrigin } from "./fold";

describe("folding for the catalog's search (slice 39, Q8)", () => {
  it("ignores case and accents, Polish and German letters included", () => {
    expect(foldText("Źródło")).toBe("zrodlo");
    expect(foldText("ŁÓDŹ żółć")).toBe("lodz zolc");
    expect(foldText("Straße")).toBe("strasse");
    expect(foldText("Müller, Øre, Đorđe, Æther, Œuvre")).toBe("muller, ore, dorde, aether, oeuvre");
  });

  it("folds the whole string as it folds each character", () => {
    for (const t of ["Źródło", "ŁÓDŹ żółć", "Straße", "éx", "İstanbul ΣΑΣ", "Müller, Øre, Đorđe"]) expect(foldText(t)).toBe(foldWithOrigin(t).text);
  });

  it("splits a query into folded words, extra spaces dropped", () => {
    expect(foldedWords("  Kunde   Straße ")).toEqual(["kunde", "strasse"]);
    expect(foldedWords("   ")).toEqual([]);
  });

  it("keeps each folded character's original range, a combining mark joining the letter before it", () => {
    const f = foldWithOrigin("aß");
    expect(f.text).toBe("ass");
    expect(f.start).toEqual([0, 1, 1]);
    expect(f.end).toEqual([1, 2, 2]);
    const decomposed = foldWithOrigin("éx");
    expect(decomposed.text).toBe("ex");
    expect(decomposed.end).toEqual([2, 3]);
  });
});
