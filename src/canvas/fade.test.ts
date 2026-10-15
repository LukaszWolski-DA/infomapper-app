import { describe, expect, it, vi } from "vitest";
import { currentFade, fadeKey, requestFade, subscribeFade } from "./fade";

describe("the fading request (slice 4p)", () => {
  it("has a key per request", () => {
    expect(fadeKey(null)).toBe("");
    expect(fadeKey({ focus: "e1" })).toBe("focus:e1");
    expect(fadeKey({ lens: "r1" })).toBe("lens:r1");
  });

  it("notifies its listeners once per change, not for the same request again", () => {
    requestFade(null);
    const seen = vi.fn();
    const off = subscribeFade(seen);
    requestFade({ focus: "e1" });
    requestFade({ focus: "e1" });
    expect(currentFade()).toEqual({ focus: "e1" });
    requestFade({ lens: "r1" });
    requestFade(null);
    requestFade(null);
    expect(seen).toHaveBeenCalledTimes(3);
    off();
    requestFade({ focus: "e2" });
    expect(seen).toHaveBeenCalledTimes(3);
    requestFade(null);
  });
});
