import { afterEach, describe, expect, it } from "vitest";
import type { DataStore } from "./ports";
import { countStatement, countWait, newTimingRecord, setTimingSource, spanUnion, TIMING_ENV, timedStore, timingSummary, type TimingRecord } from "./timing";

const before = process.env[TIMING_ENV];
afterEach(() => {
  if (before === undefined) delete process.env[TIMING_ENV];
  else process.env[TIMING_ENV] = before;
  setTimingSource(() => null);
});

/** A store with one repository whose read takes a little while. */
const fakeStore = () =>
  ({
    projects: { list: async () => (await new Promise((r) => setTimeout(r, 5)), ["p"]), get: async () => null },
    apply: async () => ({ ok: true }),
  }) as unknown as DataStore;

describe("the timing record (slice 29, Q9)", () => {
  it("counts overlapping spans once", () => {
    expect(spanUnion([[0, 10], [5, 15], [20, 25]])).toBe(20);
    expect(spanUnion([[0, 10], [2, 3]])).toBe(10);
    expect(spanUnion([])).toBe(0);
  });

  it("counts each port call, its span, the statements and the waits into the current record", async () => {
    process.env[TIMING_ENV] = "1";
    const record: TimingRecord = newTimingRecord();
    setTimingSource(() => record);
    const store = timedStore(fakeStore());
    await Promise.all([store.projects.list("w"), store.projects.list("w"), store.projects.get("w", "p")]);
    countStatement(4);
    countStatement(6);
    countWait(2);
    const s = timingSummary(record);
    expect(s).toMatchObject({ calls: 3, statements: 2, statementMs: 10, waitMs: 2 });
    expect(s.readMs).toBeGreaterThan(0);
    expect(s.readMs).toBeLessThanOrEqual(s.totalMs);
  });

  it("gives the reads' answers unchanged and leaves apply uncounted", async () => {
    process.env[TIMING_ENV] = "1";
    const record = newTimingRecord();
    setTimingSource(() => record);
    const store = timedStore(fakeStore());
    expect(await store.projects.list("w")).toEqual(["p"]);
    await store.apply({} as never);
    expect(record.calls).toBe(1);
  });

  it("counts nothing while INFOMAPPER_TIMING is not 1", async () => {
    delete process.env[TIMING_ENV];
    const record = newTimingRecord();
    setTimingSource(() => record);
    await timedStore(fakeStore()).projects.list("w");
    countStatement(3);
    expect(record).toMatchObject({ calls: 0, statements: 0 });
  });
});
