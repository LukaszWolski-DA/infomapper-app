import { describe, expect, it } from "vitest";
import { contextCookieName, formatContextCookie, parseContextCookie } from "./working-context-cookie";

describe("the working context's cookie (slice 3b, Q1)", () => {
  it("is one per person and workspace, and carries the label and its name", () => {
    expect(contextCookieName("u1", "w1")).toBe("im-ctx.u1.w1");
    const id = "01900000-0000-7000-8000-00000000a101";
    expect(parseContextCookie(formatContextCookie(id, "CR 23 – é"))).toEqual({ labelId: id, name: "CR 23 – é" });
    expect(parseContextCookie(id)).toEqual({ labelId: id, name: "" });
  });
  it("ignores anything else", () => {
    expect(parseContextCookie(undefined)).toBeNull();
    expect(parseContextCookie("nope:CR-23")).toBeNull();
    expect(parseContextCookie("01900000-0000-7000-8000-00000000a101:%E0%A4%A")).toEqual({ labelId: "01900000-0000-7000-8000-00000000a101", name: "" });
  });
});
