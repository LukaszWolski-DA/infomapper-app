// Interactions to the screen and pans as presented frames (slice 4b-1, step 2): the settled loops the measuring specs
// share, each switch bracketed in the page by `performance.measure("sw:<on|off>:<k>")`, traced and analysed by
// `scripts/lib/to-screen.ts`. The in-page time each loop returns is 4p's method (to the first setTimeout after the next
// rAF; the lasso: to the rAF of the frame with its marks) and stays as the breakdown.

import type { Page } from "@playwright/test";
import { presentedFrames, summariseSwitches, switchesOf, type PresentedFrames, type SwitchResult } from "../../scripts/lib/to-screen";
import { PAUSE_MS, saveTrace, startTrace } from "./trace";

export type InPage = { dir: string; k: number; ms: number }[] | { error: string };

export type SwitchSummary = ReturnType<typeof summariseSwitches>;

/**
 * Traces `run` (the spec's settled loop) from a settled screen, saves the trace and returns the switches summarised per
 * direction (`byDir.on`, `byDir.off`): in page and to the screen (median, p95, max), the split, the switches not settled.
 */
export async function tracedSwitches(page: Page, name: string, run: () => Promise<InPage>): Promise<{ error: string } | { trace: string; byDir: SwitchSummary }> {
  await page.waitForTimeout(PAUSE_MS);
  const trace = await startTrace(page, "full");
  await page.waitForTimeout(PAUSE_MS);
  const inPage = await run();
  await page.waitForTimeout(500);
  const events = await trace.stop();
  if ("error" in inPage) return { error: inPage.error };
  const switches: SwitchResult[] = switchesOf(events);
  const file = saveTrace(name, events, { kind: "switches" });
  return { trace: file, byDir: summariseSwitches(switches) };
}

/**
 * Traces one pan (the spec's own driver and rAF recording, `pan`), bracketed as `pan:<name>`, and returns its presented
 * frames next to the rAF figures recorded in the same run.
 */
export async function tracedPan<T>(page: Page, name: string, pan: () => Promise<T>): Promise<{ raf: T; presented: PresentedFrames | null; trace: string }> {
  const trace = await startTrace(page, "light");
  await page.evaluate(() => ((window as unknown as { __imPanT0: number }).__imPanT0 = performance.now()));
  const raf = await pan();
  await page.evaluate((n) => performance.measure(n, { start: (window as unknown as { __imPanT0: number }).__imPanT0 }), `pan:${name}`);
  await page.waitForTimeout(300);
  const events = await trace.stop();
  const file = saveTrace(`pan-${name}`, events, { kind: "pan" });
  return { raf, presented: presentedFrames(events, `pan:${name}`), trace: file };
}

/** Fading switched by the measuring hook (`__imFade`): on, then off, `n` times, each from a settled screen. */
export const fadingLoop = (page: Page, request: unknown, key: string, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([request, key, n, pause]) => {
      const set = (window as unknown as { __imFade: (r: unknown) => void }).__imFade;
      const shown = () => !!document.querySelector(`[data-testid="layer-fade"][data-fade="${key}"]`);
      const gone = () => !document.querySelector('[data-testid="layer-fade"]');
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          set(dir === "on" ? request : null);
          const done = dir === "on" ? shown : gone;
          while (!done() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `fading ${dir} ${k}: not shown` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await new Promise((res) => setTimeout(res, pause));
        }
      }
      return out;
    },
    [request, key, n, pause] as const,
  ) as Promise<InPage>;

/** C-10 (S1B-10): a mapped row in view hovered (on), then the pane (off), `n` times, each from a settled screen. */
export const hoverLoop = (page: Page, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([n, pause]) => {
      const pane = document.querySelector(".react-flow__pane")!;
      const p = pane.getBoundingClientRect();
      const rows = [...document.querySelectorAll<HTMLElement>(".row[data-row]")]
        .filter((r) => {
          const b = r.getBoundingClientRect();
          return b.top > p.top + 10 && b.bottom < p.bottom - 10 && b.left > p.left && b.right < p.right && r.querySelector(".st.ok, .st.warn");
        })
        .slice(0, 40);
      if (!rows.length) return { error: "no mapped rows in view" };
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          if (dir === "on") rows[k % rows.length]!.querySelector(".nm")!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
          else pane.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
          const done = () => (dir === "on" ? !!document.querySelector('[data-testid="hover-row"]') : !document.querySelector('[data-testid="hover-row"]'));
          while (!done() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `hover ${dir} ${k}: not shown` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await new Promise((res) => setTimeout(res, pause));
        }
      }
      return out;
    },
    [n, pause] as const,
  ) as Promise<InPage>;

/**
 * S2A-14's lasso around the whole view, `n` times from a settled screen: timed from the pointerup's timestamp to the rAF
 * of the frame with `count` marks (S2A-14's method); Escape clears the selection between lassos, untimed.
 */
export async function lassoLoop(page: Page, box: { x: number; y: number; width: number; height: number }, marks: string, count: number, n: number, pause = PAUSE_MS): Promise<InPage> {
  await page.evaluate(() => {
    const w = window as unknown as { __imUp?: number; __imUpOn?: boolean };
    if (!w.__imUpOn) window.addEventListener("pointerup", (e) => (w.__imUp = e.timeStamp), { capture: true });
    w.__imUpOn = true;
  });
  const out: { dir: string; k: number; ms: number }[] = [];
  for (let k = 0; k < n; k++) {
    await page.keyboard.press("Escape");
    await page.waitForFunction((m) => document.querySelectorAll(m).length === 0, marks);
    await page.waitForTimeout(pause);
    await page.evaluate(() => ((window as unknown as { __imUp?: number }).__imUp = undefined));
    await page.mouse.move(box.x + 3, box.y + 3);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) await page.mouse.move(box.x + 3 + ((box.width - 6) * s) / 8, box.y + 3 + ((box.height - 6) * s) / 8);
    const waiting = page.evaluate(
      ([k, marks, count]) =>
        new Promise<number>((done) => {
          const w = window as unknown as { __imUp?: number };
          const tick = () => {
            if (w.__imUp !== undefined && document.querySelectorAll(marks).length >= count) {
              requestAnimationFrame((t) => {
                performance.measure(`sw:on:${k}`, { start: w.__imUp!, end: t });
                done(t - w.__imUp!);
              });
            } else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      [k, marks, count] as const,
    );
    await page.mouse.up();
    out.push({ dir: "on", k, ms: +(await waiting).toFixed(1) });
  }
  await page.waitForTimeout(pause);
  return out;
}
