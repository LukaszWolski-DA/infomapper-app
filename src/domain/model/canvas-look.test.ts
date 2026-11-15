import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_LOOK } from "../types";
import { applyLookPatch, isHidden, sameLook } from "./canvas-look";

describe("the page outline in the look (slice 27, step 4, Q6)", () => {
  const outline = { paper: "A3", orientation: "portrait", pt: 6 } as const;
  it("is a key present only while on; a patch without it keeps it; Show all's patch keeps it", () => {
    const on = applyLookPatch(DEFAULT_CANVAS_LOOK, { pageOutline: outline });
    expect(on).toEqual({ ...DEFAULT_CANVAS_LOOK, pageOutline: outline });
    expect(applyLookPatch(on, { layer: "all", hideEntityRelationships: false, hideSourceRelationships: false })).toEqual(on);
    expect(applyLookPatch(on, { pageOutline: null })).toEqual(DEFAULT_CANVAS_LOOK);
    // a look stored before slice 27 reads as off
    expect(applyLookPatch({ background: "white", grid: "none", layer: "all" }, {}).pageOutline).toBeUndefined();
  });
  it("compares outlines by their parts", () => {
    const on = applyLookPatch(DEFAULT_CANVAS_LOOK, { pageOutline: outline });
    expect(sameLook(on, applyLookPatch(DEFAULT_CANVAS_LOOK, { pageOutline: { ...outline } }))).toBe(true);
    expect(sameLook(on, applyLookPatch(DEFAULT_CANVAS_LOOK, { pageOutline: { ...outline, pt: 7 } }))).toBe(false);
    expect(sameLook(on, DEFAULT_CANVAS_LOOK)).toBe(false);
  });
});

describe("a canvas's relationship lines by kind (slice 16, item 3, D-71)", () => {
  it("stores a hidden kind as true and drops the key of a kind shown", () => {
    const hidden = applyLookPatch(DEFAULT_CANVAS_LOOK, { hideEntityRelationships: true });
    expect(hidden).toEqual({ ...DEFAULT_CANVAS_LOOK, hideEntityRelationships: true });
    expect(applyLookPatch(hidden, { hideEntityRelationships: false })).toEqual(DEFAULT_CANVAS_LOOK);
    expect(applyLookPatch(hidden, { hideSourceRelationships: true })).toEqual({ ...DEFAULT_CANVAS_LOOK, hideEntityRelationships: true, hideSourceRelationships: true });
  });

  it("keeps the hidden kinds through a patch of the background, grid or layer", () => {
    const both = { ...DEFAULT_CANVAS_LOOK, hideEntityRelationships: true as const, hideSourceRelationships: true as const };
    expect(applyLookPatch(both, { layer: "mappings", grid: "none" })).toEqual({ background: "grey", grid: "none", layer: "mappings", hideEntityRelationships: true, hideSourceRelationships: true });
  });

  it("reads a look stored before slice 16 (three keys) as both kinds shown", () => {
    expect(isHidden(DEFAULT_CANVAS_LOOK, "hideEntityRelationships")).toBe(false);
    expect(isHidden(DEFAULT_CANVAS_LOOK, "hideSourceRelationships")).toBe(false);
    expect(applyLookPatch(DEFAULT_CANVAS_LOOK, {})).toEqual(DEFAULT_CANVAS_LOOK);
  });

  it("compares looks with the hidden kinds", () => {
    expect(sameLook(DEFAULT_CANVAS_LOOK, { ...DEFAULT_CANVAS_LOOK })).toBe(true);
    expect(sameLook(DEFAULT_CANVAS_LOOK, { ...DEFAULT_CANVAS_LOOK, hideSourceRelationships: true })).toBe(false);
  });
});
