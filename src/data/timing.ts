// The timing record (slice 29, step 4, Q9, F15): per request, the port calls a page or a resource makes, the SQL
// statements behind them, the time those statements took, the time spent waiting for a connection, and the time the
// reads spanned. On only with INFOMAPPER_TIMING=1 (Vercel's Preview environment); off, `getDataStore` hands out the store
// unwrapped and nothing is counted. Numbers only: no id, name or value of the model goes into a record.
//
// Which request a read belongs to is the app's to say (`setTimingSource`, `src/app/_lib/timing.ts`): this layer knows no
// request. Measure, don't fix (DB7): the record changes nothing the store does.

import type { DataStore } from "./ports";

export const TIMING_ENV = "INFOMAPPER_TIMING";
export const isTimingOn = (): boolean => process.env[TIMING_ENV] === "1";

export interface TimingRecord {
  /** When the record began (`performance.now()`). */
  readonly started: number;
  calls: number;
  statements: number;
  /** The statements' own time, added up (they may overlap on several connections). */
  statementMs: number;
  /** Time spent waiting for a pool connection, added up. */
  waitMs: number;
  /** Each port call's start and end, to tell the reads' span from their sum. */
  readonly spans: [number, number][];
  /** A write's wait for its workspace's (and organization's) lock, and its whole transaction (slice 30, S30-13). */
  lockWaitMs: number;
  applyMs: number;
}

export const newTimingRecord = (): TimingRecord => ({ started: performance.now(), calls: 0, statements: 0, statementMs: 0, waitMs: 0, spans: [], lockWaitMs: 0, applyMs: 0 });

let source: () => TimingRecord | null = () => null;

/** The app says which record the current request writes to (or none). */
export function setTimingSource(find: () => TimingRecord | null): void {
  source = find;
}

/** The current request's record, or null (timing off, or no request known). */
export const currentTiming = (): TimingRecord | null => (isTimingOn() ? source() : null);

/** One SQL statement's time, from the Postgres adapter's pool. */
export function countStatement(ms: number): void {
  const r = currentTiming();
  if (!r) return;
  r.statements++;
  r.statementMs += ms;
}

/** Time waiting for a connection, from the pool. */
export function countWait(ms: number): void {
  const r = currentTiming();
  if (r) r.waitMs += ms;
}

/** A write's lock wait and its transaction's time, from the Postgres adapter's `apply` (slice 30). */
export function countWrite(lockWaitMs: number, applyMs: number): void {
  const r = currentTiming();
  if (!r) return;
  r.lockWaitMs += lockWaitMs;
  r.applyMs += applyMs;
}

/** The total length of the time covered by the spans (overlaps counted once). */
export function spanUnion(spans: readonly [number, number][]): number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [s, e] of sorted) {
    if (e <= end) continue;
    total += e - Math.max(s, end);
    end = e;
  }
  return total;
}

export interface TimingSummary {
  calls: number;
  statements: number;
  /** The statements' time added up. */
  statementMs: number;
  waitMs: number;
  /** The time the port calls spanned (wall-clock, overlaps once). */
  readMs: number;
  /** From the record's start to now. */
  totalMs: number;
  /** Writes only (slice 30): the lock's wait and the write's transaction. */
  lockWaitMs: number;
  applyMs: number;
}

const round = (ms: number) => Math.round(ms * 10) / 10;

export function timingSummary(r: TimingRecord): TimingSummary {
  return {
    calls: r.calls,
    statements: r.statements,
    statementMs: round(r.statementMs),
    waitMs: round(r.waitMs),
    readMs: round(spanUnion(r.spans)),
    totalMs: round(performance.now() - r.started),
    lockWaitMs: round(r.lockWaitMs),
    applyMs: round(r.applyMs),
  };
}

/** The store with every repository call counted and timed into the current request's record. */
export function timedStore(store: DataStore): DataStore {
  const timed = <F extends (...args: never[]) => unknown>(fn: F): F =>
    (async (...args: never[]) => {
      const r = currentTiming();
      const start = performance.now();
      try {
        return await fn(...args);
      } finally {
        if (r) {
          r.calls++;
          r.spans.push([start, performance.now()]);
        }
      }
    }) as unknown as F;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(store)) {
    if (typeof value === "function") out[key] = key === "apply" ? value : timed(value as (...args: never[]) => unknown);
    else if (value && typeof value === "object") {
      const repo: Record<string, unknown> = {};
      for (const [name, fn] of Object.entries(value)) repo[name] = typeof fn === "function" ? timed((fn as (...args: never[]) => unknown).bind(value)) : fn;
      out[key] = repo;
    } else out[key] = value;
  }
  return out as unknown as DataStore;
}
