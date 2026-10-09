import { describe, expect, it } from "vitest";
import {
  arrangeIntoFrames,
  CARD_HEADER_HEIGHT,
  cardsFullyInside,
  conceptQuestions,
  dropCards,
  frameAround,
  frameAt,
  frameOfCard,
  grownToHold,
  headerMiddle,
  isMisplaced,
  kindFor,
  membershipAfterResize,
  type CardBox,
  type FrameBox,
} from "./frames";

const frame = (id: string, x: number, y: number, width: number, height: number): FrameBox => ({ id, x, y, width, height });
const card = (id: string, x: number, y: number, over: Partial<CardBox> = {}): CardBox => ({ id, x, y, width: 256, height: 200, frameId: null, ...over });

describe("membership by the middle of the header (D-05)", () => {
  it("takes the middle of the card's width and of its header", () => {
    expect(headerMiddle({ x: 100, y: 40, width: 256 })).toEqual({ x: 228, y: 40 + CARD_HEADER_HEIGHT / 2 });
  });

  it("finds the frame around a point, the smallest where frames overlap (D-23: always one)", () => {
    const big = frame("big", 0, 0, 1000, 1000);
    const small = frame("small", 100, 100, 300, 300);
    expect(frameAt([big, small], { x: 200, y: 200 })?.id).toBe("small");
    expect(frameAt([small, big], { x: 200, y: 200 })?.id).toBe("small");
    expect(frameAt([big, small], { x: 900, y: 900 })?.id).toBe("big");
    expect(frameAt([big, small], { x: 1001, y: 10 })).toBeNull();
  });

  it("counts a point on the edge as inside", () => {
    expect(frameAt([frame("f", 0, 0, 100, 100)], { x: 100, y: 100 })?.id).toBe("f");
  });

  it("puts a card in a frame when only its header middle is inside, not when only its body is", () => {
    const f = frame("f", 0, 0, 400, 300);
    expect(frameOfCard([f], { x: 300, y: 100, width: 256 })).toBeNull(); // header middle (428, 127): outside, body partly inside
    expect(frameOfCard([f], { x: 100, y: 260, width: 256 })?.id).toBe("f"); // (228, 287): inside
    expect(frameOfCard([f], { x: 100, y: 280, width: 256 })).toBeNull(); // (228, 307): below
  });
});

describe("a new frame takes free cards fully inside it (D-06)", () => {
  const rect = { x: 0, y: 0, width: 800, height: 600 };

  it("takes a card fully inside and leaves one that sticks out", () => {
    const inside = card("in", 32, 40);
    const out = card("out", 600, 40); // 600 + 256 > 800
    expect(cardsFullyInside(rect, [inside, out]).map((c) => c.id)).toEqual(["in"]);
  });

  it("never takes a card that belongs to another frame", () => {
    expect(cardsFullyInside(rect, [card("other", 32, 40, { frameId: "g" })])).toEqual([]);
  });

  it("uses the card's height from the canvas", () => {
    expect(cardsFullyInside(rect, [card("tall", 32, 40, { height: 600 })])).toEqual([]);
  });
});

describe("dropping cards (D-05)", () => {
  it("grows a frame to hold a card that joined it: 24 px at the sides and below, 40 px above", () => {
    expect(grownToHold({ x: 0, y: 0, width: 400, height: 300 }, { x: 300, y: 200, width: 256, height: 200 })).toEqual({
      x: 0,
      y: 0,
      width: 300 + 256 + 24,
      height: 200 + 200 + 24,
    });
    expect(grownToHold({ x: 0, y: 0, width: 400, height: 300 }, { x: -50, y: 10, width: 256, height: 100 })).toEqual({
      x: -74,
      y: -30,
      width: 474,
      height: 330,
    });
  });

  it("does not shrink a frame that already holds the card", () => {
    const f = { x: 0, y: 0, width: 800, height: 600 };
    expect(grownToHold(f, { x: 100, y: 100, width: 256, height: 200 })).toEqual(f);
  });

  it("puts each dropped card in the frame under its header, or none, and grows that frame", () => {
    const f = frame("f", 0, 0, 400, 300);
    const r = dropCards([f], [card("a", 100, 200), card("b", 2000, 0, { frameId: "f" })]);
    expect(r.membership).toEqual([
      { cardId: "a", frameId: "f" },
      { cardId: "b", frameId: null },
    ]);
    expect(r.frames).toEqual([{ id: "f", x: 0, y: 0, width: 400, height: 424 }]);
    expect(f.height).toBe(300); // the input is not changed
  });

  it("takes the cards one after the other: a frame grown for one card is there for the next", () => {
    const f = frame("f", 0, 0, 400, 300);
    // b's header middle (228, 407) is outside the frame as drawn (300 high), inside once it grew for a (424 high)
    const r = dropCards([f], [card("a", 100, 200), card("b", 100, 380)]);
    expect(r.membership.map((m) => m.frameId)).toEqual(["f", "f"]);
    expect(r.frames[0]!.height).toBe(380 + 200 + 24);
  });

  it("picks the smaller of two overlapping frames", () => {
    const r = dropCards([frame("big", 0, 0, 2000, 2000), frame("small", 0, 0, 600, 600)], [card("a", 100, 100)]);
    expect(r.membership[0]!.frameId).toBe("small");
  });
});

describe("resizing a frame (D-06)", () => {
  it("releases its cards whose header middle is now outside, to the frame under them or to none", () => {
    const resized = frame("f", 0, 0, 300, 300);
    const under = frame("g", 500, 0, 600, 600);
    const changes = membershipAfterResize(resized, [resized, under], [
      card("stays", 0, 100, { frameId: "f" }),
      card("toG", 600, 100, { frameId: "f" }),
      card("toNone", 0, 900, { frameId: "f" }),
    ]);
    expect(changes).toEqual([
      { cardId: "toG", frameId: "g" },
      { cardId: "toNone", frameId: null },
    ]);
  });

  it("takes free cards whose header middle is now inside, never cards of another frame", () => {
    const resized = frame("f", 0, 0, 1000, 1000);
    const changes = membershipAfterResize(resized, [resized, frame("g", 0, 0, 2000, 2000)], [
      card("free", 100, 100),
      card("ofG", 300, 300, { frameId: "g" }),
    ]);
    expect(changes).toEqual([{ cardId: "free", frameId: "f" }]);
  });
});

describe("a frame around cards", () => {
  it("keeps 32 px at the sides, 40 above and 32 below", () => {
    expect(frameAround([{ x: 100, y: 100, width: 256, height: 200 }, { x: 400, y: 50, width: 300, height: 100 }])).toEqual({
      x: 68,
      y: 10,
      width: 700 - 100 + 64,
      height: 300 - 50 + 72,
    });
  });

  it("stands for one concept, one source system, or a free area", () => {
    expect(kindFor([{ entityConceptId: "c1" }, { entityConceptId: "c1" }])).toEqual({ kind: "concept", refId: "c1" });
    expect(kindFor([{ sourceSystemId: "s1" }, { sourceSystemId: "s1" }])).toEqual({ kind: "source_system", refId: "s1" });
    expect(kindFor([{ entityConceptId: "c1" }, { entityConceptId: "c2" }])).toEqual({ kind: "free", refId: null });
    expect(kindFor([{ entityConceptId: "c1" }, { sourceSystemId: "s1" }])).toEqual({ kind: "free", refId: null });
    expect(kindFor([])).toEqual({ kind: "free", refId: null });
  });
});

describe("what does not belong in a frame", () => {
  const conceptFrame = { kind: "concept" as const, concept_id: "c1", source_system_id: null };
  const sourceFrame = { kind: "source_system" as const, concept_id: null, source_system_id: "s1" };
  const free = { kind: "free" as const, concept_id: null, source_system_id: null };

  it("a concept frame: anything that is not an entity of its concept", () => {
    expect(isMisplaced(conceptFrame, { entityConceptId: "c1" })).toBe(false);
    expect(isMisplaced(conceptFrame, { entityConceptId: "c2" })).toBe(true);
    expect(isMisplaced(conceptFrame, { sourceSystemId: "s1" })).toBe(true);
  });

  it("a source frame: anything that is not a table of its system; a free frame takes anything", () => {
    expect(isMisplaced(sourceFrame, { sourceSystemId: "s1" })).toBe(false);
    expect(isMisplaced(sourceFrame, { sourceSystemId: "s2" })).toBe(true);
    expect(isMisplaced(sourceFrame, { entityConceptId: "c1" })).toBe(true);
    expect(isMisplaced(free, { entityConceptId: "c1" })).toBe(false);
  });

  it("asks about entities that joined a concept frame of another concept, only once", () => {
    const frames = [{ id: "f", kind: "concept" as const, concept_id: "sales" }, { id: "g", kind: "free" as const, concept_id: null }];
    const d = (cardId: string, over: object) => ({ cardId, entityId: `e-${cardId}`, conceptId: "customer", frameBefore: null, frameAfter: "f", ...over });
    expect(
      conceptQuestions(frames, [
        d("joined", {}),
        d("same", { conceptId: "sales" }),
        d("stayed", { frameBefore: "f" }),
        d("table", { entityId: null, conceptId: null }),
        d("free", { frameAfter: "g" }),
        d("none", { frameAfter: null }),
      ]),
    ).toEqual([{ cardId: "joined", entityId: "e-joined", conceptId: "sales" }]);
  });
});

describe("arrange into frames (prototype arrangeLayout)", () => {
  const c = (id: string, height = 200, width = 256) => ({ id, width, height });

  it("puts one source frame per system on the left, one column each, 96 px apart", () => {
    const { frames, positions } = arrangeIntoFrames(
      [
        { refId: "crm", cards: [c("t1"), c("t2", 100)] },
        { refId: "erp", cards: [c("t3")] },
      ],
      [],
    );
    expect(frames).toEqual([
      { kind: "source_system", refId: "crm", cardIds: ["t1", "t2"], x: 0, y: 0, width: 320, height: 40 + 200 + 32 + 104 + 32 },
      { kind: "source_system", refId: "erp", cardIds: ["t3"], x: 0, y: 408 + 96, width: 320, height: 272 },
    ]);
    expect(positions.get("t1")).toEqual({ x: 32, y: 40 });
    expect(positions.get("t2")).toEqual({ x: 32, y: 40 + 200 + 32 });
    expect(positions.get("t3")).toEqual({ x: 32, y: 504 + 40 });
  });

  it("puts concept frames 240 px right of the widest source frame, two columns above two entities", () => {
    const { frames, positions } = arrangeIntoFrames(
      [{ refId: "crm", cards: [c("t1", 200, 400)] }],
      [
        { refId: "customer", cards: [c("e1"), c("e2", 100), c("e3")] },
        { refId: "sales", cards: [c("e4")] },
        { refId: "empty", cards: [] },
      ],
    );
    const left = 400 + 64 + 240;
    expect(frames.map((f) => [f.refId, f.x, f.y, f.width])).toEqual([
      ["crm", 0, 0, 464],
      ["customer", left, 0, 64 + 2 * 256 + 32],
      ["sales", left, 408 + 96, 320], // customer: columns 232 and 368 high, 368 - 32 + 40 + 32 = 408
    ]);
    expect(positions.get("e1")).toEqual({ x: left + 32, y: 40 });
    expect(positions.get("e2")).toEqual({ x: left + 32 + 256 + 32, y: 40 });
    expect(positions.get("e3")).toEqual({ x: left + 32 + 256 + 32, y: 40 + 104 + 32 }); // the shorter column
  });

  it("keeps every position on the 8 px grid by rounding heights up", () => {
    const { positions, frames } = arrangeIntoFrames([{ refId: "crm", cards: [c("a", 121), c("b", 77)] }], [{ refId: "x", cards: [c("e", 93)] }]);
    for (const p of positions.values()) expect([p.x % 8, p.y % 8]).toEqual([0, 0]);
    for (const f of frames) expect([f.x % 8, f.y % 8, f.width % 8, f.height % 8]).toEqual([0, 0, 0, 0]);
  });

  it("places concept frames at the left edge when there are no tables", () => {
    expect(arrangeIntoFrames([], [{ refId: "x", cards: [c("e")] }]).frames[0]).toMatchObject({ x: 0, y: 0 });
  });
});
