// Tracing for measuring to the screen (slice 4b-1, step 2): a Chrome trace around a stretch of a measuring spec, saved
// raw to `.data/measure/` (git-ignored, never committed) and analysed by `scripts/lib/to-screen.ts`.
//
// `TO_SCREEN=1` switches the measuring specs to their traced mode (`npm run measure:canvas -- --to-screen` sets it);
// without it they measure as before. `TRACE_DIR` names the folder (the sitting's `traces/round-<n>-<side>`), else
// `.data/measure/traces-<time>`.

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { FULL_CATEGORIES, LIGHT_CATEGORIES, type TraceEvent } from "../../scripts/lib/to-screen";

export const TO_SCREEN = process.env.TO_SCREEN === "1";
/** The pause after each switch, so the next one starts from a settled screen (step 0). */
export const PAUSE_MS = 1200;
/** Switches per case and run in the traced mode (on and off each). */
export const SETTLED_PAIRS = Number(process.env.SETTLED_PAIRS ?? 10);

const DIR = path.resolve(process.env.TRACE_DIR ?? path.join(".data", "measure", `traces-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`));

type Cdp = {
  send: (method: string, params?: unknown) => Promise<unknown>;
  on: (event: string, f: (x: never) => void) => void;
  once: (event: string, f: (x: never) => void) => void;
  detach: () => Promise<void>;
};

/**
 * The trace buffer, in KiB. Chrome's default records until its buffer is full and then drops the rest without a word:
 * slice 4p's C-08 traces stopped about 0.6 s into a 1.4 s load (found in slice 4b-1, step 2). Every trace asks for a
 * large buffer, and a trace that still lost data is refused (`dataLossOccurred`).
 */
export const TRACE_BUFFER_KB = 512 * 1024;

/**
 * Starts a trace of the page: `full` for switches (main thread, compositor, raster, presents), `light` for pans
 * (presents and frame reports only). Returns the stop, which gives the events.
 */
export async function startTrace(page: Page, set: "full" | "light"): Promise<{ stop: () => Promise<TraceEvent[]> }> {
  return startTraceWith(page, set === "full" ? FULL_CATEGORIES : LIGHT_CATEGORIES);
}

/** A trace with the given categories, the large buffer and the data-loss check. */
export async function startTraceWith(page: Page, categories: readonly string[]): Promise<{ stop: () => Promise<TraceEvent[]> }> {
  const cdp = (await page.context().newCDPSession(page)) as unknown as Cdp;
  const events: TraceEvent[] = [];
  cdp.on("Tracing.dataCollected", (e: { value: TraceEvent[] }) => events.push(...e.value));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: categories, recordMode: "recordUntilFull", traceBufferSizeInKb: TRACE_BUFFER_KB }, transferMode: "ReportEvents" });
  return {
    stop: async () => {
      await cdp.send("Tracing.end");
      const lost = await new Promise<boolean>((done) => cdp.once("Tracing.tracingComplete", (e: { dataLossOccurred?: boolean }) => done(!!e.dataLossOccurred)));
      await cdp.detach();
      if (lost) throw new Error(`The trace lost data (its buffer of ${TRACE_BUFFER_KB} KiB was full): measure a shorter stretch.`);
      return events;
    },
  };
}

/** Saves a trace with what the spec knows about it; returns the file. */
export function saveTrace(name: string, events: readonly TraceEvent[], extra: Record<string, unknown> = {}): string {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${name.replace(/[^\w.-]+/g, "_")}.json`);
  fs.writeFileSync(file, JSON.stringify({ name, ...extra, events }));
  return file;
}
