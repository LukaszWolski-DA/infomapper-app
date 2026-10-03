import { describe, expect, it } from "vitest";
import { isUuid, uuidv7, uuidv7Time } from "./ids";

describe("uuidv7 (AD-11)", () => {
  it("creates valid version 7 UUIDs with the RFC 9562 variant", () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("encodes the creation time", () => {
    // A time later than any id made so far, because ids never go back in time.
    const ms = Date.UTC(2029, 9, 2, 12, 0, 0);
    expect(uuidv7Time(uuidv7(ms))).toBe(ms);
  });

  it("is strictly increasing, also within one millisecond", () => {
    const ms = Date.UTC(2030, 0, 1);
    const list = Array.from({ length: 5000 }, () => uuidv7(ms));
    for (let i = 1; i < list.length; i++) expect(list[i]! > list[i - 1]!).toBe(true);
    expect(new Set(list).size).toBe(list.length);
  });

  it("stays increasing when the clock goes backwards", () => {
    const a = uuidv7(Date.UTC(2031, 0, 1));
    const b = uuidv7(Date.UTC(2020, 0, 1));
    expect(b > a).toBe(true);
  });

  it("rejects things that are not UUIDs", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("01900000-0000-7000-8000-00000000000G")).toBe(false);
  });
});
