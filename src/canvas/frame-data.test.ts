import { describe, expect, it } from "vitest";
import { conceptAsk, frameChips, frameStats } from "./frame-data";

describe("the drop's concept question (D-05)", () => {
  it("asks about one entity by name", () => {
    expect(conceptAsk([{ name: "Customer", from: "Customer", to: "Sales" }])).toEqual({
      message: "Customer is now inside the Sales frame, but belongs to the Customer concept. Move it to Sales in the model?",
      yes: "Move to Sales",
      no: "Keep in Customer",
      moved: "Customer now belongs to Sales.",
      kept: "Customer stays in Customer. The frame marks it as outside this concept.",
    });
  });

  it("asks once for a group, naming one frame or several", () => {
    const one = conceptAsk([{ name: "A", from: "X", to: "Sales" }, { name: "B", from: "Y", to: "Sales" }]);
    expect(one).toMatchObject({ message: "2 entities (A, B) landed in the Sales frame. Move them to Sales in the model?", yes: "Move to Sales", no: "Keep their concepts" });
    const two = conceptAsk([{ name: "A", from: "X", to: "Sales" }, { name: "B", from: "Y", to: "Product" }]);
    expect(two).toMatchObject({ message: "2 entities (A, B) landed in frames of other concepts. Move them to those concepts in the model?", yes: "Move them" });
  });
});

describe("frame label numbers", () => {
  const card = (id: string, kind: "ent" | "src", frameId: string | null, over: object = {}) => ({
    id,
    kind,
    rows: [{}, {}, {}] as never,
    mapped: 2,
    frameId,
    subject: kind === "ent" ? { entityConceptId: "c1" } : { sourceSystemId: "s1" },
    links: [{ id: "m1", warn: true, draft: false }, { id: "m2", warn: false, draft: true }],
    ...over,
  });
  const frame = { id: "f", kind: "concept" as const, conceptId: "c1", sourceSystemId: null };

  it("counts attributes, columns, distinct mappings and misplaced cards of the frame's cards only", () => {
    const stats = frameStats(frame, [card("a", "ent", "f"), card("b", "src", "f"), card("c", "ent", null), card("d", "ent", "f", { subject: { entityConceptId: "c2" } })]);
    expect(stats).toEqual({ cards: 3, attributes: 6, mapped: 4, columns: 3, used: 2, typeProblems: 1, drafts: 1, misplaced: 2 });
    expect(frameChips(stats, "concept").map((c) => c.text)).toEqual(["4/6 mapped", "2/3 used", "1 type", "1 draft", "2 misplaced"]);
  });
});
