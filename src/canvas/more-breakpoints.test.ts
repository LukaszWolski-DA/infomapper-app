import { describe, expect, it } from "vitest";
import { inMore, MORE_BUTTON, MORE_FOCUS, MORE_NAMES, MORE_TOOLS } from "./more-breakpoints";

// Slice 38 (B2): the groups leave the canvas toolbar by its room, in slice 6a's order, and each wrapper's container query
// says the same width as the menu's comparison.
describe("“More” by the toolbar's room", () => {
  const groups = [MORE_NAMES, MORE_FOCUS, MORE_TOOLS];

  it("leaves in slice 6a's order: the names, then Focus and the notation, then the tools", () => {
    expect(MORE_NAMES.at).toBeGreaterThan(MORE_FOCUS.at);
    expect(MORE_FOCUS.at).toBeGreaterThan(MORE_TOOLS.at);
  });

  it("writes each width once: the container query, the menu's comparison and “More”'s button agree", () => {
    for (const g of groups) expect(g.inBar).toBe(`@max-[${g.at}px]:hidden`);
    expect(MORE_BUTTON).toBe(`@min-[${MORE_NAMES.at}px]:hidden`);
  });

  it("keeps every group in the toolbar at 1,280 px with both panels at their defaults (652 px of room)", () => {
    for (const g of groups) expect(inMore(g, 1280 - 264 - 340 - 24)).toBe(false);
  });

  it("puts a group in “More” below its width, and none before the first report", () => {
    expect(inMore(MORE_NAMES, MORE_NAMES.at - 1)).toBe(true);
    expect(inMore(MORE_NAMES, MORE_NAMES.at)).toBe(false);
    expect(inMore(MORE_TOOLS, 300)).toBe(true);
    for (const g of groups) expect(inMore(g, null)).toBe(false);
  });
});
