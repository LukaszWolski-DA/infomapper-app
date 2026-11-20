// The seed the contract suite loads is at one time, the one it is given (fix/contract-seed-clock): `seedRows(t)` never
// reads the real clock. A demo step that does would put rows at the moment the test runs beside the suite's fixed-time
// commands, and the two adapters' stored orders (AD-12) would differ once the real time passes the commands' time.
// The system clock is moved far after and before the seed's time, so a real-time row shows on any day.

import { afterEach, describe, expect, it, vi } from "vitest";
import { seedRows } from "../scripts/lib/seed-rows";
import { AT, contractClock } from "./contract/shared";

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;

/** "table.field" of every time in the rows that is not `at`. */
function otherTimes(at: string): string[] {
  const out = new Set<string>();
  const db = seedRows(new Date(at)) as unknown as Record<string, unknown>;
  for (const [table, rows] of Object.entries(db)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows as Record<string, unknown>[]) for (const [field, value] of Object.entries(row)) if (typeof value === "string" && ISO.test(value) && value !== at) out.add(`${table}.${field}`);
  }
  return [...out].sort();
}

describe("the contract suite's seed is at the time it is given", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const now of ["2030-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z"]) {
    it(`holds no time but its own with the system clock at ${now.slice(0, 10)}`, () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(now) });
      expect(otherTimes(AT.toISOString())).toEqual([]);
    });
  }

  it("the suite's clock starts after every seed row and adds a second per command", () => {
    const ctxOf = contractClock("01a1c000");
    const first = ctxOf("someone");
    const second = ctxOf("someone");
    expect(Date.parse(first.now)).toBeGreaterThan(AT.getTime());
    expect(Date.parse(second.now) - Date.parse(first.now)).toBe(1000);
    expect(first.newId()).toBe("01a1c000-0000-7000-8000-000000000001");
  });
});
