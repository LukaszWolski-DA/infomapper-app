// S4P-10 (slice 4p, item 9): the C-08 diagnosis, no fix. The initial render of “Performance test” at the overview, as
// S1A-14 measures it (navigation start to the first frame with every card and line drawn), five cold loads in fresh
// browser contexts after one warm-up, each traced (Chrome DevTools Protocol), measurement build only (MEASURE=1
// MEASURE_BUILD=production; the normal run leaves it out). Each load is split into:
//   - the document: navigation start to the end of the HTML response (the server renders the page, the data inside it);
//   - the main thread's own work by kind (each event's self time, so nested events count once): script (parsing,
//     compiling and running JavaScript, React's work inside it), style and layout, paint and layerize, HTML parsing,
//     other;
//   - the rest: the main thread waiting (network for the scripts and fonts, the GPU, idle).
// Results in test-results/S4P-10.json. The raw trace of each load is kept (Łukasz before step 5) in
// .data/measure/s4p10-traces/<time>/load-<n>.json (git-ignored; never committed), for `scripts/c08-waiting.ts`, which
// breaks the waiting after the document down: network requests in flight, compositor, raster and GPU thread time, and
// the main thread's idle gaps.

import fs from "node:fs";
import path from "node:path";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test } from "../slice-01a/fixtures";
import { signInAs } from "../slice-01a/helpers";
import { LARGE_URL, MEASURE_USE, saveResults } from "../slice-01b/measure";

test.use(MEASURE_USE);

type TraceEvent = { name: string; ph: string; ts: number; dur?: number; pid: number; tid: number; cat: string; args?: { name?: string } };

const KIND: [RegExp, string][] = [
  [/^(EvaluateScript|v8\.compile|v8\.compileModule|v8\.evaluateModule|v8\.run|FunctionCall|TimerFire|EventDispatch|RunMicrotasks|FireAnimationFrame|V8\.GC.*|MajorGC|MinorGC|v8\.produceCache|v8\.parseOnBackground|CompileScript|CompileCode|ScriptStreamer.*)$/, "script"],
  [/^(UpdateLayoutTree|RecalculateStyles|Layout|ScheduleStyleRecalculation|InvalidateLayout|UpdateLayout|ParseAuthorStyleSheet)$/, "style and layout"],
  [/^(Paint|PrePaint|Layerize|UpdateLayer|UpdateLayerTree|Commit|CompositeLayers|PaintImage|Decode.*)$/, "paint and layerize"],
  [/^ParseHTML$/, "HTML parsing"],
];
const kindOf = (name: string) => KIND.find(([re]) => re.test(name))?.[1] ?? "other";
const TRACE_DIR = path.resolve(".data", "measure", "s4p10-traces", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));

test("S4P-10: the C-08 diagnosis, initial render of “Performance test” split into document, main-thread work by kind, and waiting", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(600_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const data = generate();
  const cards = data.cards.length;
  const lines = data.mappings.length + data.relationships.length;
  await page.goto("/sign-in");
  await page.evaluate((k) => localStorage.removeItem(k), "infomapper:view:01a0f9e9-2014-7c80-a0f5-6d2e8b4c1f03");

  const loads: Record<string, unknown>[] = [];
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, storageState: await page.context().storageState() });
    const p = await context.newPage();
    await p.addInitScript(
      ([cards, lines]) => {
        const w = window as unknown as { __stableAt?: number };
        const check = () => {
          const ready =
            document.querySelector('[data-testid="area-canvas"][data-ready="true"]') &&
            document.querySelectorAll(".react-flow__node").length === cards &&
            document.querySelectorAll('[data-testid="line-mapping"], [data-testid="line-relationship"]').length === lines;
          if (ready) requestAnimationFrame((t) => (w.__stableAt = t));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      },
      [cards, lines] as const,
    );
    const session = await context.newCDPSession(p);
    const cdp = session as unknown as { send: (m: string, x?: unknown) => Promise<unknown>; on: (e: string, f: (x: never) => void) => void; once: (e: string, f: () => void) => void };
    const events: TraceEvent[] = [];
    cdp.on("Tracing.dataCollected", (e: { value: TraceEvent[] }) => events.push(...e.value));
    if (i > 0) {
      await cdp.send("Tracing.start", {
        traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "v8.execute", "v8", "blink", "blink.user_timing", "loading", "toplevel", "cc", "gpu", "viz", "netlog", "__metadata"] },
        transferMode: "ReportEvents",
      });
    }
    await p.goto(LARGE_URL);
    await p.waitForFunction(() => (window as unknown as { __stableAt?: number }).__stableAt, undefined, { timeout: 60_000 });
    const nav = await p.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const scripts = performance.getEntriesByType("resource").filter((r) => (r as PerformanceResourceTiming).initiatorType === "script") as PerformanceResourceTiming[];
      return {
        stableAt: Math.round((window as unknown as { __stableAt: number }).__stableAt),
        responseStart: Math.round(n.responseStart),
        responseEnd: Math.round(n.responseEnd),
        documentKiB: Math.round(n.transferSize / 1024),
        domInteractive: Math.round(n.domInteractive),
        domContentLoaded: Math.round(n.domContentLoadedEventEnd),
        scripts: scripts.length,
        scriptsKiB: Math.round(scripts.reduce((s, r) => s + r.transferSize, 0) / 1024),
        lastScriptEnd: Math.round(Math.max(0, ...scripts.map((r) => r.responseEnd))),
      };
    });
    if (i > 0) {
      await cdp.send("Tracing.end");
      await new Promise<void>((done) => cdp.once("Tracing.tracingComplete", () => done()));
      // the renderer's main thread: where the page's HTML is parsed
      const main = events.find((e) => e.name === "ParseHTML");
      const navStart = events.filter((e) => e.name === "navigationStart" && e.pid === main?.pid).sort((a, b) => b.ts - a.ts)[0]?.ts ?? 0;
      const end = navStart + nav.stableAt * 1000;
      // as DevTools' performance panel: its timeline events, V8's compiling and running, and the tasks around them (Blink's
      // internal events inside them would otherwise take their self time)
      const counted = (e: TraceEvent) => e.cat.includes("devtools.timeline") || /^v8\.(compile|compileModule|evaluateModule|run|parseOnBackground)$/.test(e.name) || e.name === "RunTask";
      const slices = events.filter((e) => e.ph === "X" && e.dur && counted(e) && main && e.pid === main.pid && e.tid === main.tid && e.ts >= navStart && e.ts < end).sort((a, b) => a.ts - b.ts || b.dur! - a.dur!);
      // self time: an event's duration less its children's
      const self = new Map<string, number>();
      const stack: { e: TraceEvent; children: number }[] = [];
      const close = (upTo: number) => {
        while (stack.length && stack[stack.length - 1]!.e.ts + stack[stack.length - 1]!.e.dur! <= upTo) {
          const { e, children } = stack.pop()!;
          const k = kindOf(e.name);
          self.set(k, (self.get(k) ?? 0) + Math.max(0, e.dur! - children));
          if (stack.length) stack[stack.length - 1]!.children += e.dur!;
        }
      };
      for (const e of slices) {
        close(e.ts);
        stack.push({ e, children: 0 });
      }
      close(Infinity);
      const busy = [...self.values()].reduce((a, b) => a + b, 0) / 1000;
      // the raw trace, for the waiting's breakdown (git-ignored)
      fs.mkdirSync(TRACE_DIR, { recursive: true });
      fs.writeFileSync(path.join(TRACE_DIR, `load-${i}.json`), JSON.stringify({ nav, navStart, mainPid: main?.pid, mainTid: main?.tid, events }));
      loads.push({
        ...nav,
        traced: { events: events.length, mainSlices: slices.length, navigationStart: navStart > 0 },
        mainThreadMs: Object.fromEntries([...self].map(([k, v]) => [k, Math.round(v / 1000)])),
        mainThreadBusyMs: Math.round(busy),
        waitingMs: Math.round(nav.stableAt - busy),
      });
    }
    await context.close();
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const pick = (k: string) => median(loads.map((l) => l[k] as number));
  const kinds = ["script", "style and layout", "paint and layerize", "HTML parsing", "other"];
  saveResults("S4P-10", {
    browser: browser.version(),
    traces: TRACE_DIR,
    loads,
    median: {
      stableAt: pick("stableAt"),
      responseEnd: pick("responseEnd"),
      domContentLoaded: pick("domContentLoaded"),
      lastScriptEnd: pick("lastScriptEnd"),
      mainThreadBusyMs: pick("mainThreadBusyMs"),
      waitingMs: pick("waitingMs"),
      ...Object.fromEntries(kinds.map((k) => [k, median(loads.map((l) => ((l.mainThreadMs as Record<string, number>)[k] ?? 0)))])),
    },
  });
});
