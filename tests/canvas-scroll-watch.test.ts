import { describe, expect, it } from "vitest";
import { judgeScrolls, NOTE_LEFT_MS, type Scroll } from "../e2e/canvas-scroll-watch";

// The canvas scroll watch's rule (fix/e2e-visible-clicks): which scrolls of the canvas fail a test. The one allowed is the
// browser keeping a note's text cursor in view by scrolling React Flow's wrapper, which React Flow scrolls back.

const scroll = (at: number, left: number, over: Partial<Scroll> = {}): Scroll => ({
  kind: "scroll",
  on: "react-flow",
  left,
  top: 0,
  at,
  before: null,
  focus: "",
  noteFocus: false,
  noteLeftAt: null,
  page: 1,
  ...over,
});

describe("the canvas scroll watch's rule", () => {
  it("allows the wrapper's scroll while the note's text box has the focus, once it is scrolled back", () => {
    const typing = scroll(100, 20, { noteFocus: true });
    const { away, excused } = judgeScrolls([typing, scroll(116, 0)]);
    expect(excused).toEqual([typing]);
    expect(away).toEqual([]);
  });

  it("allows it just after the text box lost the focus (the event on a later frame, after Ctrl+Enter), not later", () => {
    const justAfter = scroll(150, 30, { noteLeftAt: 150 - NOTE_LEFT_MS });
    const later = scroll(400, 30, { noteLeftAt: 400 - NOTE_LEFT_MS - 1 });
    const { away, excused } = judgeScrolls([justAfter, scroll(160, 0), later, scroll(410, 0)]);
    expect(excused).toEqual([justAfter]);
    expect(away).toEqual([later]);
  });

  it("fails a note's scroll that stays, one on another page, and every scroll of .im-canvas", () => {
    const stays = scroll(100, 20, { noteFocus: true });
    const otherPage = scroll(200, 20, { noteFocus: true });
    const canvas = scroll(300, 96, { on: "im-canvas", noteFocus: true });
    const { away } = judgeScrolls([stays, otherPage, scroll(210, 0, { page: 2 }), canvas, scroll(310, 0, { on: "im-canvas" })]);
    expect(away).toEqual([stays, otherPage, canvas]);
  });

  it("fails a click's scroll (no note focused), scrolled back or not", () => {
    const click = scroll(100, 94);
    expect(judgeScrolls([click, scroll(116, 0)]).away).toEqual([click]);
  });
});
