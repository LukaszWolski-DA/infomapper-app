import { describe, expect, it } from "vitest";
import { DEFAULT_SIDE_PANELS, clampWidth, formatSidePanelsCookie, parseSidePanelsCookie, sidePanelsCookieName } from "./side-panels-cookie";

describe("side panels cookie (slice 5a)", () => {
  it("is one cookie per person", () => {
    expect(sidePanelsCookieName("u1")).toBe("im-panels.u1");
  });

  it("reads back what it wrote", () => {
    const s = { left: false, right: true, leftWidth: 300, rightWidth: 500 };
    expect(formatSidePanelsCookie(s)).toBe("l0.r1.300.500");
    expect(parseSidePanelsCookie(formatSidePanelsCookie(s))).toEqual(s);
  });

  it("gives the defaults, both panels shown, for a missing or unreadable value", () => {
    for (const v of [undefined, null, "", "garbage", "l2.r1.264.340", "l1.r1.264", "l1.r1.264.340.1", "l1.r1.-5.340"]) {
      expect(parseSidePanelsCookie(v)).toEqual(DEFAULT_SIDE_PANELS);
    }
    expect(DEFAULT_SIDE_PANELS).toEqual({ left: true, right: true, leftWidth: 264, rightWidth: 340 });
  });

  it("keeps widths within the prototype's limits", () => {
    expect(clampWidth("left", 100)).toBe(200);
    expect(clampWidth("left", 9999)).toBe(520);
    expect(clampWidth("right", 100)).toBe(280);
    expect(clampWidth("right", 9999)).toBe(640);
    expect(clampWidth("right", 300.4)).toBe(300);
    expect(parseSidePanelsCookie("l1.r0.9999.10")).toEqual({ left: true, right: false, leftWidth: 520, rightWidth: 280 });
  });
});
