import { describe, expect, it } from "vitest";
import { PART_COUNT, PART_STARTS, partFolders } from "../e2e/parts";

// The full e2e run's parts (slice 14b, item 1, F18): every folder runs in exactly one part, in Playwright's order.
const FOLDERS = ["fixes", "measure", "slice-00", "slice-02c", "slice-03a", "slice-06b", "slice-07a", "slice-09", "slice-10a", "slice-14a", "slice-14b"];

describe("e2e parts", () => {
  it("has four parts", () => {
    expect(PART_COUNT).toBe(4);
    expect(PART_STARTS).toEqual(["slice-03a", "slice-07a", "slice-10a"]);
  });

  it("puts every folder in exactly one part, in order", () => {
    const parts = [1, 2, 3, 4].map((p) => partFolders(p, FOLDERS));
    expect(parts.flat()).toEqual(FOLDERS);
    expect(parts).toEqual([
      ["fixes", "measure", "slice-00", "slice-02c"],
      ["slice-03a", "slice-06b"],
      ["slice-07a", "slice-09"],
      ["slice-10a", "slice-14a", "slice-14b"],
    ]);
  });

  it("starts each later part at its first folder", () => {
    for (const [i, start] of PART_STARTS.entries()) expect(partFolders(i + 2, FOLDERS)[0]).toBe(start);
  });

  it("refuses a part that does not exist", () => {
    expect(() => partFolders(0, FOLDERS)).toThrow("E2E_PART must be 1 to 4");
    expect(() => partFolders(5, FOLDERS)).toThrow("E2E_PART must be 1 to 4");
  });
});
