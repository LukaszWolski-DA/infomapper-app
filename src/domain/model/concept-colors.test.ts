import { describe, expect, it } from "vitest";
import { CONCEPT_PALETTE, isConceptColor, nextConceptColor } from "./concept-colors";

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("concept colours (D-41)", () => {
  it("contains no violet (hue 250°–300°)", () => {
    for (const c of CONCEPT_PALETTE) expect(hue(c), c).not.toSatisfy((h: number) => h >= 250 && h <= 300);
    expect(isConceptColor("#7C3AED")).toBe(false);
  });

  it("picks the first unused colour, ignoring case", () => {
    expect(nextConceptColor([])).toBe("#2F7DD1");
    expect(nextConceptColor(["#2f7dd1", "#0F8B8D"])).toBe("#C0437A");
  });

  it("repeats the palette when every colour is used", () => {
    expect(nextConceptColor([...CONCEPT_PALETTE, CONCEPT_PALETTE[0]])).toBe(CONCEPT_PALETTE[1]);
  });

  it("accepts palette colours in any case", () => {
    expect(isConceptColor("#2f7dd1")).toBe(true);
  });
});
