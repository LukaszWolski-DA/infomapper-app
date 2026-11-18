// The canvas scroll watch (fix/e2e-visible-clicks): counts the scroll events of React Flow's wrapper (`.react-flow`)
// and the canvas (`.im-canvas`) in every page of every context of the test (the test's own and those made with
// `browser.newContext`, such as `newSession`'s second person). Both elements are `overflow:hidden`, so a person never
// scrolls them; a scroll there comes from Playwright scrolling an element into view (a click without a position, a
// hover, a drag, a fill) or from the browser and the app (typing in a text field partly outside the canvas). React Flow
// scrolls its wrapper back on a later frame, which is how a click got lost in S3B-06; nothing scrolls `.im-canvas` back,
// so the canvas stays shifted on that page. `settle.ts`'s fixture fails a test with a scroll away from 0, except by one
// rule (`noteTyping`: the browser keeping a note's text cursor in view), and adds an annotation `canvas-scroll` for every
// test with a scroll event. With each scroll
// go the page's last input event before it, the focused element and the first events after it, so the cause can be told
// without a trace. Canvas clicks go through `clickVisible` (`canvas-click.ts`), which never scrolls.

import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

/** The annotation's type; `scripts/e2e-summary.ts` lists the tests that have one. */
export const CANVAS_SCROLL = "canvas-scroll";

/** The note's text box (`NoteLayer.tsx`), whose typing the browser keeps in view by scrolling React Flow's wrapper. */
export const NOTE_TEXT = "input-note-text";
/**
 * How long after the note's text box lost the focus a scroll event still counts as its typing's: the browser scrolls
 * while the caret moves and dispatches the event on a later frame, after Ctrl+Enter may have closed the editor.
 */
export const NOTE_LEFT_MS = 100;

type PageEvent = { type: string; target: string; at: number };
export type Scroll = {
  kind: "scroll";
  on: "react-flow" | "im-canvas";
  left: number;
  top: number;
  at: number;
  before: PageEvent | null;
  focus: string;
  /** Whether the focused element was the note's text box when the event came. */
  noteFocus: boolean;
  /** When the note's text box last lost the focus on that page (ms), or null. */
  noteLeftAt: number | null;
  page: number;
};
type Rec = Scroll | ({ kind: "event"; page: number } & PageEvent);

const records = new WeakMap<BrowserContext, Rec[]>();
/** The contexts watched since the current test began (tests run one at a time in a worker). */
let watched: BrowserContext[] = [];
const pageIds = new WeakMap<Page, number>();
let nextPage = 1;
const PATCHED = Symbol.for("im.canvasScrollWatch");

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
  let noteLeftAt: number | null = null;
  document.addEventListener(
    "focusout",
    (e) => {
      if (e.target instanceof Element && e.target.getAttribute("data-testid") === "input-note-text") noteLeftAt = Date.now();
    },
    true,
  );
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
        noteFocus: document.activeElement?.getAttribute("data-testid") === "input-note-text",
        noteLeftAt,
      });
      followUntil = at + 1500;
      moved = false;
    },
    true,
  );
}

/** Starts the watch in a context (once) and counts it for the current test. */
export async function watchCanvasScrolls(context: BrowserContext): Promise<void> {
  if (!watched.includes(context)) watched.push(context);
  if (records.has(context)) return;
  const list: Rec[] = [];
  records.set(context, list);
  await context.exposeBinding("__imCanvasScroll", ({ page }, rec: Rec) => {
    if (!pageIds.has(page)) pageIds.set(page, nextPage++);
    list.push({ ...rec, page: pageIds.get(page)! });
  });
  await context.addInitScript(pageScript);
}

/** Watches every context the browser makes from now on (`browser.newContext`, once per browser). */
export function watchNewContexts(browser: Browser): void {
  const b = browser as Browser & { [PATCHED]?: true };
  if (b[PATCHED]) return;
  b[PATCHED] = true;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args: Parameters<Browser["newContext"]>) => {
    const context = await newContext(...args);
    await watchCanvasScrolls(context);
    return context;
  };
}

/** The annotation a test adds when it scrolls the canvas on purpose (`fixes/visible-clicks.spec.ts` shows the hazard). */
export const CANVAS_SCROLL_ON_PURPOSE = "canvas-scroll-on-purpose";

/** Marks the current test as scrolling the canvas on purpose: its scrolls are reported, not failed. */
export function scrollsOnPurpose(testInfo: TestInfo, why: string): void {
  testInfo.annotations.push({ type: CANVAS_SCROLL_ON_PURPOSE, description: why });
}

/** A new test: no context watched yet. */
export function beginCanvasWatch(): void {
  watched = [];
}

const fileOf = (testInfo: TestInfo) => testInfo.file.replace(/\\/g, "/").split("/e2e/").pop()!;

/** Whether a later scroll of the same element on the same page returned it to 0. */
export const scrolledBack = (s: Scroll, scrolls: readonly Scroll[]): boolean =>
  scrolls.some((o) => o !== s && o.page === s.page && o.on === s.on && o.at >= s.at && o.left === 0 && o.top === 0);

/**
 * The one scroll the watch allows: React Flow's wrapper scrolled while a note's text box has the focus (or lost it within
 * `NOTE_LEFT_MS`), and scrolled back. `.im-canvas` never.
 */
export const noteTyping = (s: Scroll, scrolls: readonly Scroll[]): boolean =>
  s.on === "react-flow" && (s.noteFocus || (s.noteLeftAt !== null && s.at >= s.noteLeftAt && s.at - s.noteLeftAt <= NOTE_LEFT_MS)) && scrolledBack(s, scrolls);

/** Splits the scrolls away from 0 into those that fail the test and those `noteTyping` allows. */
export function judgeScrolls(scrolls: readonly Scroll[]): { away: Scroll[]; excused: Scroll[] } {
  const moved = scrolls.filter((s) => s.left !== 0 || s.top !== 0);
  const excused = moved.filter((s) => noteTyping(s, scrolls));
  return { away: moved.filter((s) => !excused.includes(s)), excused };
}

/** What the watch saw in the current test's contexts: each scroll away from 0 with its causes, and every scroll event. */
export function canvasScrolls(since: number): { away: Scroll[]; excused: Scroll[]; events: number; describe: (s: Scroll) => string } {
  const all = watched.flatMap((c) => records.get(c) ?? []);
  const scrolls = all.filter((r): r is Scroll => r.kind === "scroll");
  const { away, excused } = judgeScrolls(scrolls);
  const describe = (s: Scroll) => {
    const after = all.filter((r) => r.kind === "event" && r.page === s.page && r.at >= s.at && r.at - s.at < 1500).slice(0, 3) as PageEvent[];
    const back = scrolledBack(s, scrolls);
    const ev = (e: PageEvent) => `${e.type} ${e.target}`;
    return (
      `+${Math.round((s.at - since) / 100) / 10}s page ${s.page} ${s.on} ${s.left},${s.top} ${back ? "scrolled back" : "stayed"}` +
      ` | before: ${s.before ? ev(s.before) : "–"} | focus: ${s.focus || "–"} | after: ${after.map(ev).join("; ") || "–"}`
    );
  };
  return { away, excused, events: scrolls.length, describe };
}

/** Records the watch's finding on the test and fails it for a scroll away from 0 that `noteTyping` does not allow. */
export function finishCanvasWatch(since: number, testInfo: TestInfo): void {
  const file = fileOf(testInfo);
  const { away, excused, events, describe } = canvasScrolls(since);
  watched = [];
  if (events === 0) return;
  const list = (xs: Scroll[]) => xs.slice(0, 8).map(describe).join(" || ") + (xs.length > 8 ? ` || … ${xs.length - 8} more` : "");
  const description = `${away.length} away, ${excused.length} excused, ${events} events: ${list([...away, ...excused].sort((a, b) => a.at - b.at))}`;
  testInfo.annotations.push({ type: CANVAS_SCROLL, description });
  console.log(`[canvas-scroll] ${file}:${testInfo.line} ${testInfo.title.slice(0, 60)}: ${description}`);
  if (away.length > 0 && !testInfo.annotations.some((a) => a.type === CANVAS_SCROLL_ON_PURPOSE))
    throw new Error(
      `The canvas scrolled ${away.length} time(s) in this test (the canvas scroll watch, e2e/canvas-scroll-watch.ts). ` +
        `Click canvas elements with clickVisible (e2e/canvas-click.ts). ${list(away)}`,
    );
}
