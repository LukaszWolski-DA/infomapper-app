// The canvas scroll watch (fix/e2e-visible-clicks): counts the scroll events of React Flow's wrapper (`.react-flow`)
// and the canvas (`.im-canvas`). Both are `overflow:hidden`, so a person never scrolls them; a scroll there comes from
// Playwright scrolling an element into view (a click, a hover, a drag, a fill) or from the app itself (a `focus()`
// without `preventScroll`). React Flow scrolls its wrapper back on a later frame, which is how a click got lost in
// S3B-06. Report only, for now: `settle.ts`'s fixture adds an annotation `canvas-scroll` and prints a line for a test
// with any such scroll, and never fails it. With each scroll go the page's last input event before it and the first
// few after it (their type and target), so the cause can be told without a trace.

import type { BrowserContext, TestInfo } from "@playwright/test";

/** The annotation's type; `scripts/e2e-summary.ts` lists the tests that have one. */
export const CANVAS_SCROLL = "canvas-scroll";

type PageEvent = { type: string; target: string; at: number };
type Scroll = { kind: "scroll"; on: string; left: number; top: number; at: number; before: PageEvent | null; focus: string };
type Rec = Scroll | ({ kind: "event" } & PageEvent);

const records = new WeakMap<BrowserContext, Rec[]>();

/** In the page: report every scroll of the two elements, the event before it and the events in the 1.5 s after it. */
function pageScript(): void {
  if (window !== window.top) return;
  const send = (rec: unknown) => {
    const f = (window as unknown as { __imCanvasScroll?: (r: unknown) => void }).__imCanvasScroll;
    if (f) void Promise.resolve(f(rec)).catch(() => {});
  };
  const describe = (el: EventTarget | null): string => {
    if (!(el instanceof Element)) return el === document ? "document" : "";
    const ids: string[] = [];
    for (let e: Element | null = el; e && ids.length < 2; e = e.parentElement) {
      const id = e.getAttribute("data-testid");
      if (id) ids.push(id);
    }
    const cls = [...el.classList].slice(0, 2).join(".");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${ids.length ? " in " + ids.join(" < ") : ""}`;
  };
  let last: { type: string; target: string; at: number } | null = null;
  let followUntil = 0;
  let moved = false;
  const KINDS = ["pointerdown", "pointerup", "click", "contextmenu", "dblclick", "keydown", "input", "focusin", "dragstart"];
  for (const type of KINDS)
    document.addEventListener(
      type,
      (e) => {
        const rec = { type, target: describe(e.target), at: Date.now() };
        last = rec;
        if (rec.at < followUntil) send({ kind: "event", ...rec });
      },
      true,
    );
  document.addEventListener(
    "pointermove",
    (e) => {
      const at = Date.now();
      if (at < followUntil && !moved) {
        moved = true;
        send({ kind: "event", type: "pointermove", target: describe(e.target), at });
      }
    },
    true,
  );
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.matches(".react-flow, .im-canvas")) return;
      const at = Date.now();
      send({
        kind: "scroll",
        on: t.classList.contains("im-canvas") ? "im-canvas" : "react-flow",
        left: t.scrollLeft,
        top: t.scrollTop,
        at,
        before: last && at - last.at < 2000 ? last : null,
        focus: describe(document.activeElement),
      });
      followUntil = at + 1500;
      moved = false;
    },
    true,
  );
}

/** Starts the watch in a context (once). */
export async function watchCanvasScrolls(context: BrowserContext): Promise<void> {
  if (records.has(context)) return;
  const list: Rec[] = [];
  records.set(context, list);
  await context.exposeBinding("__imCanvasScroll", (_source, rec: Rec) => void list.push(rec));
  await context.addInitScript(pageScript);
}

/** What the watch saw in a context: the scrolls away from 0 (each with its causes) and every scroll event. */
export function canvasScrolls(context: BrowserContext, since: number): { away: number; events: number; text: string } {
  const list = records.get(context) ?? [];
  const scrolls = list.filter((r): r is Scroll => r.kind === "scroll");
  const away = scrolls.filter((s) => s.left !== 0 || s.top !== 0);
  const parts = away.slice(0, 8).map((s) => {
    const after = list.filter((r) => r.kind === "event" && r.at >= s.at && r.at - s.at < 1500).slice(0, 3) as PageEvent[];
    const ev = (e: PageEvent) => `${e.type} ${e.target}`;
    return (
      `+${Math.round((s.at - since) / 100) / 10}s ${s.on} ${s.left},${s.top}` +
      ` | before: ${s.before ? ev(s.before) : "–"} | focus: ${s.focus || "–"} | after: ${after.map(ev).join("; ") || "–"}`
    );
  });
  return { away: away.length, events: scrolls.length, text: parts.join(" || ") + (away.length > 8 ? ` || … ${away.length - 8} more` : "") };
}

/** Records the watch's finding on the test (report only: never fails it). */
export function reportCanvasScrolls(context: BrowserContext, since: number, testInfo: TestInfo): void {
  const { away, events, text } = canvasScrolls(context, since);
  if (events === 0) return;
  testInfo.annotations.push({ type: CANVAS_SCROLL, description: `${away} away, ${events} events: ${text}` });
  console.log(`[canvas-scroll] ${testInfo.file.replace(/\\/g, "/").split("/e2e/").pop()}:${testInfo.line} ${testInfo.title.slice(0, 60)}: ${away} away, ${events} events`);
}
