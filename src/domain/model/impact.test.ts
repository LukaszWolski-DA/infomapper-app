import { describe, expect, it } from "vitest";
import { requirementsImpactRow } from "./impact";

describe("the delete dialog's requirements row (slice 4a, after step 3)", () => {
  it("names the requirements that lose the entity from their scope, singular and plural", () => {
    expect(requirementsImpactRow(["REQ-101", "REQ-102", "REQ-103", "REQ-105"])).toEqual(["4 requirements", "lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-105"]);
    expect(requirementsImpactRow(["REQ-104"])).toEqual(["1 requirement", "loses it from its scope: REQ-104"]);
    expect(requirementsImpactRow([])).toEqual(["0 requirements", "–"]);
  });

  it("names the first five keys and counts the rest", () => {
    const keys = Array.from({ length: 8 }, (_, i) => `REQ-${101 + i}`);
    expect(requirementsImpactRow(keys)).toEqual(["8 requirements", "lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-104, REQ-105 and 3 more"]);
    expect(requirementsImpactRow(keys.slice(0, 5))[1]).toBe("lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-104, REQ-105");
  });
});
