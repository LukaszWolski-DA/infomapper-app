import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_LOOK } from "../types";
import { applyLookPatch, isHidden, sameLook } from "./canvas-look";

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
