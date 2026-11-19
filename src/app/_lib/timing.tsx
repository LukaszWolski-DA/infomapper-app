import "server-only";
// Where a request's timing record lives (slice 29, step 4, Q9, F15), with INFOMAPPER_TIMING=1 only:
// - a route handler or a server action that measures itself runs in `withTiming` (an AsyncLocalStorage: every read
//   awaited inside it, however deep, writes to its record);
// - a page's render shares one record through React's per-request `cache`, read by `TimingRecord` at the page's end.
// Imported by `session.ts`, which every page, action and route loads before it reads, so the source is set first.
// Numbers only: no id, name or value goes into a record, a header, the page or a log line.

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { isTimingOn, newTimingRecord, setTimingSource, timingSummary, type TimingRecord as Record, type TimingSummary } from "@/data/timing";

const scoped = new AsyncLocalStorage<Record>();
/** The page render's record: one per request (React's `cache` is scoped to a server render). */
const renderRecord = cache((): Record => newTimingRecord());

setTimingSource(() => scoped.getStore() ?? renderRecord());

/**
 * Runs `work` with its own record; hands the record's summary to `report` when it is done. Inside another `withTiming`
 * (slice 30: the import's route around its write's `runCommand`) it writes to that record, so the outer one counts all.
 */
export async function withTiming<T>(work: () => Promise<T>, report: (summary: TimingSummary, result: T) => void): Promise<T> {
  if (!isTimingOn()) return work();
  const outer = scoped.getStore();
  if (outer) {
    const result = await work();
    report(timingSummary(outer), result);
    return result;
  }
  const record = newTimingRecord();
  const result = await scoped.run(record, work);
  report(timingSummary(record), result);
  return result;
}

/** The `Server-Timing` header of a summary (route handlers only: a page cannot set headers, F15). */
export const serverTimingHeader = (s: TimingSummary): string =>
  [
    `db;dur=${s.statementMs};desc="${s.calls} calls, ${s.statements} statements"`,
    `wait;dur=${s.waitMs}`,
    `read;dur=${s.readMs}`,
    // slice 30: a write's lock wait and transaction, when the request wrote
    ...(s.applyMs ? [`lock;dur=${s.lockWaitMs}`, `apply;dur=${s.applyMs}`] : []),
    `total;dur=${s.totalMs}`,
  ].join(", ");

/**
 * The page's record as hidden JSON (`data-testid="im-timing"`), for the measuring spec; nothing is drawn. Placed last in
 * a page, it counts the reads made before it renders (the page's own and the shell's; a part of the page rendered after
 * it, such as a module's tab, is not counted).
 */
export function TimingRecord() {
  if (!isTimingOn()) return null;
  const summary = timingSummary(renderRecord());
  return <script type="application/json" data-testid="im-timing" dangerouslySetInnerHTML={{ __html: JSON.stringify(summary) }} />;
}
