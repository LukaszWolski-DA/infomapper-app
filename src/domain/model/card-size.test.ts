import { describe, expect, it } from "vitest";
import { cardHeightFor, cardHeightOf, rowShown } from "./card-size";

const row = (over: Partial<{ mappings: number; pk: boolean; fk: boolean; bk: boolean; relevant: boolean }> = {}) => ({ mappings: 0, pk: false, fk: false, bk: false, ...over });

describe("card size (AD-24 rule 2, one rule for canvas, demo data and domain)", () => {
  it("is the header, the body padding and the shown rows, at least one line; the header only when collapsed", () => {
    expect(cardHeightFor(0)).toBe(54 + 12 + 26);
    expect(cardHeightFor(3)).toBe(54 + 12 + 78);
    expect(cardHeightFor(3, true)).toBe(54);
  });

  it("shows rows by filter: mapped, unmapped, keys, and the relevant rows of a live canvas (labeled)", () => {
    const rows = [row({ mappings: 1 }), row({ pk: true }), row({ bk: true, relevant: true }), row()];
    const shown = (f: Parameters<typeof rowShown>[1]) => rows.filter((r) => rowShown(r, f)).length;
    expect([shown("all"), shown("mapped"), shown("unmapped"), shown("keys"), shown("labeled")]).toEqual([4, 1, 3, 2, 1]);
    expect(cardHeightOf({ rows, collapsed: false, rowFilter: "labeled" })).toBe(cardHeightFor(1));
    expect(cardHeightOf({ rows, collapsed: true, rowFilter: "all" })).toBe(54);
    expect(cardHeightOf({ rows: [row()], collapsed: false, rowFilter: "labeled" })).toBe(cardHeightFor(0));
  });
});
