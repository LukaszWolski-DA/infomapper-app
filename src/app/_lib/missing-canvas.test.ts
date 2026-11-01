import { describe, expect, it } from "vitest";
import { missingCanvasWay, type MissingCanvas } from "./missing-canvas";

// The way out of a canvas page whose canvas is not there (D-38), for `loadShell` and for the canvas page's own read:
// slice 12a found a canvas's delete landing between the two reads (`page.tsx`, which used `find(…)!`). That race cannot
// be driven from a test without a switch in the app, so the branch is tested here (Łukasz, before step 4).

const WS = "w1", P = "p1", C = "c-gone", FIRST = "c-first", SECOND = "c-second";
const base = (over: Partial<MissingCanvas> = {}): MissingCanvas => ({
  workspaceId: WS,
  projectId: P,
  canvasId: C,
  projectLive: true,
  links: [{ canvas_id: FIRST }, { canvas_id: SECOND }],
  ownAction: false,
  next: null,
  projectGoneByMe: false,
  ...over,
});

describe("missingCanvasWay (slice 12a)", () => {
  it("a canvas deleted between loadShell's read and the page's: the project's first canvas with the notice, as an arrival at a deleted canvas", () => {
    expect(missingCanvasWay(base())).toEqual({ to: `/w/${WS}/p/${P}/c/${FIRST}?moved=1` });
  });

  it("drawn again after your own action: the canvas it chose, else the first, without the notice", () => {
    expect(missingCanvasWay(base({ ownAction: true, next: SECOND }))).toEqual({ to: `/w/${WS}/p/${P}/c/${SECOND}` });
    expect(missingCanvasWay(base({ ownAction: true, next: "elsewhere" }))).toEqual({ to: `/w/${WS}/p/${P}/c/${FIRST}` });
  });

  it("never opens the missing canvas itself, even while its link is still read; no other canvas: not found", () => {
    expect(missingCanvasWay(base({ links: [{ canvas_id: C }, { canvas_id: SECOND }] }))).toEqual({ to: `/w/${WS}/p/${P}/c/${SECOND}?moved=1` });
    expect(missingCanvasWay(base({ links: [{ canvas_id: C }] }))).toEqual({ notFound: true });
  });

  it("a project that no longer exists: the workspace home with “That project no longer exists.”, or silently after your own action that removed it (F2)", () => {
    expect(missingCanvasWay(base({ projectLive: false, links: [] }))).toEqual({ to: `/w/${WS}?gone=project` });
    expect(missingCanvasWay(base({ projectLive: false, links: [], ownAction: true }))).toEqual({ to: `/w/${WS}?gone=project` });
    expect(missingCanvasWay(base({ projectLive: false, links: [], ownAction: true, projectGoneByMe: true }))).toEqual({ to: `/w/${WS}` });
    // the cookie alone, without the action's own drawing (a later visit), keeps the toast
    expect(missingCanvasWay(base({ projectLive: false, links: [], projectGoneByMe: true }))).toEqual({ to: `/w/${WS}?gone=project` });
  });
});
