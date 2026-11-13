"use client";

// The editor's preview (slice 26, PRD items 3 to 6; acceptance F2, F3, F7, Q3, Q4): the document's content tree drawn as
// real pages by Paged.js 0.4.3 or as the quick sheet, by the mode:
// - **Auto** (the default, kept per tab for the session): real pages while the last layout of this document in this
//   page took less than the threshold (1,000 ms, Q3); after a slower one every change shows the quick sheet at once with
//   "Pages out of date…" and "Update pages", which lays out real pages once (its time is the new last one);
// - **Exact pages**: real pages after every change; **Quick preview**: the quick sheet only.
//
// A layout runs off screen into a container of its own and replaces the shown pages only when it is done, so the old
// pages (or the quick sheet) stay visible meanwhile (P4); a newer change **stops** the running layout (F7: Paged.js's
// next page answers with a refusal, so its flow ends; its styles go with it). The quick sheet is the same renderer and
// look at the page's width (`DocumentHtml` with `quick`, F3, D8). The zoom is CSS `zoom` on the shown pages; "Fit width"
// follows the middle's width through a `ResizeObserver` (no layout read in a commit). A click in the preview selects its
// section (P5), a double-click goes to its heading (D9); the selected section is outlined.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { DocumentTree } from "../domain/document";
import { DOCUMENT_LOOK_CSS, documentCss, PAGES_SCREEN_CSS, QUICK_SHEET_CSS } from "../ui/document-css";
import { DocumentHtml } from "../ui/document-html";
import { LAYING_OUT, LAYOUT_FAILED, pagesText } from "./paged-view";

export type PreviewMode = "auto" | "exact" | "quick";
export type PreviewZoom = "fit" | "0.75" | "1";

/** Auto's threshold (Q3: the measured split between the demo's documents and "Performance test"). */
export const LAYOUT_THRESHOLD_MS = 1000;
/** The page's width in CSS pixels, A4 portrait (210 mm). */
const PAGE_WIDTH_PX = (210 * 96) / 25.4;

export const PREVIEW_TEXTS = {
  modeTitle:
    "Auto: real pages while they lay out quickly, otherwise the quick sheet until you update them. Exact: real pages after every change. Quick: one sheet per page break, at once.",
  modes: [
    ["auto", "Auto"],
    ["exact", "Exact pages"],
    ["quick", "Quick preview"],
  ] as const,
  zooms: [
    ["fit", "Fit width"],
    ["0.75", "75 %"],
    ["1", "100 %"],
  ] as const,
  stale: (ms: number) => `Pages out of date: this document took ${(ms / 1000).toFixed(1)} s to lay out, so the preview shows the quick sheet while you edit.`,
  update: "Update pages",
  /** The prototype's note above the pages: the sections skipped while their module is off. */
  skipped: (module: string, labels: readonly string[]) => `Skipped while ${module} is off: ${labels.join(", ")}.`,
} as const;

interface PagedPreviewer {
  preview(content: Node, stylesheets: Record<string, string>[], renderTo: HTMLElement): Promise<unknown>;
  polisher: { destroy(): void };
  chunker: { destroy(): void; renderAsync: (...args: unknown[]) => Promise<unknown> };
}

let pagedModule: Promise<{ Previewer: new () => PagedPreviewer }> | null = null;
const loadPaged = () => (pagedModule ??= import("pagedjs") as unknown as Promise<{ Previewer: new () => PagedPreviewer }>);

/** A layout's pages and the Paged.js that drew them (its styles live while its pages are shown). */
interface Layout {
  previewer: PagedPreviewer;
  host: HTMLDivElement;
}

const STOPPED = "stopped";

/** Ends a layout's Paged.js: its styles out of the head, its pages with their container. */
function destroy(layout: Layout | null) {
  if (!layout) return;
  try {
    layout.previewer.polisher.destroy();
    layout.previewer.chunker.destroy();
  } catch {
    // already gone with the page
  }
  layout.host.remove();
}

export interface PreviewHandle {
  /** Scrolls the shown pages to a section (P5); "doc": the title page. */
  scrollTo(sec: string): void;
  /** Real pages now, then the browser's print dialog (Print / PDF). */
  print(): void;
}

interface Props {
  /** The tree to show; a new object means a change (the editor builds it only when the recipe or the model changed). */
  tree: DocumentTree | null;
  mode: PreviewMode;
  zoom: PreviewZoom;
  /** The threshold (`LAYOUT_THRESHOLD_MS`, or the test hook's). */
  threshold: () => number;
  selected: string;
  onSelect: (sec: string) => void;
  onOpen: (sec: string) => void;
  /** The notes on sections skipped while their module is off (`PREVIEW_TEXTS.skipped`). */
  skipped: readonly string[];
  /** The busy text and the page count, for the top bar. */
  onStatus: (text: string) => void;
}

type Shown = "none" | "pages" | "quick";

export const DocumentPreview = forwardRef<PreviewHandle, Props>(function DocumentPreview({ tree, mode, zoom, threshold, selected, onSelect, onOpen, skipped, onStatus }, ref) {
  const scroller = useRef<HTMLDivElement>(null);
  const pagesBox = useRef<HTMLDivElement>(null);
  const offscreen = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const quickBox = useRef<HTMLDivElement>(null);
  const shownLayout = useRef<Layout | null>(null);
  const running = useRef<{ layout: Layout; stop: () => void } | null>(null);
  const lastMs = useRef<number | null>(null);
  const printAfter = useRef(false);
  const [shown, setShown] = useState<Shown>("none");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pages, setPages] = useState(0);
  const [stale, setStale] = useState<number | null>(null);
  /** "Update pages" and Print: one layout of real pages whatever Auto's last time was. */
  const force = useRef(false);
  const [trigger, setTrigger] = useState(0);
  const [layouts, setLayouts] = useState(0);
  const [lastShownMs, setLastShownMs] = useState<number | null>(null);
  const [fit, setFit] = useState(1);

  // "Fit width" from the middle's width, reported after the browser's layout
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setFit(Math.min(1, (w - 48) / PAGE_WIDTH_PX));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Stops the running layout, if any: its next page is refused, so its flow ends; its container goes. */
  const stopRunning = () => {
    running.current?.stop();
    running.current = null;
  };

  // each new tree, mode or "Update pages": the quick sheet at once, or real pages laid out off screen
  useEffect(() => {
    if (!tree) return;
    const forced = force.current || printAfter.current;
    force.current = false;
    const slow = mode === "auto" && lastMs.current !== null && lastMs.current >= threshold() && !forced;
    const quick = mode === "quick" || slow;
    stopRunning();
    if (quick && !forced) {
      setShown("quick");
      setBusy(false);
      setStale(slow ? lastMs.current : null);
      return;
    }
    setStale(null);
    const from = source.current?.firstElementChild;
    const box = offscreen.current;
    if (!from || !box) return;
    const host = document.createElement("div");
    host.className = "im-doc-host";
    box.appendChild(host);
    let stopped = false;
    setBusy(true);
    setFailed(false);
    const css = documentCss(tree.frame);
    const content = from.cloneNode(true);
    (async () => {
      const { Previewer } = await loadPaged();
      if (stopped) {
        host.remove();
        return;
      }
      const previewer = new Previewer();
      const layout: Layout = { previewer, host };
      running.current = {
        layout,
        stop: () => {
          stopped = true;
          // Paged.js has no cancel: its next page is refused, which ends its flow (Q3)
          previewer.chunker.renderAsync = () => Promise.reject(new Error(STOPPED));
          destroy(layout);
        },
      };
      const started = performance.now();
      await previewer.preview(content, [{ "infodocumenter.css": css }], host);
      if (stopped) return;
      const ms = Math.round(performance.now() - started);
      running.current = null;
      lastMs.current = ms;
      // the swap: the new pages in, the old ones (and their styles) out
      const old = shownLayout.current;
      shownLayout.current = layout;
      pagesBox.current?.replaceChildren(host);
      destroy(old);
      setPages(host.querySelectorAll(".pagedjs_page").length);
      setLastShownMs(ms);
      setLayouts((n) => n + 1);
      setShown("pages");
      setBusy(false);
      if (printAfter.current) {
        printAfter.current = false;
        window.print();
      }
    })().catch((e: unknown) => {
      if (stopped) return;
      running.current = null;
      host.remove();
      // the old pages stay; the reason goes to the console for a bug report (no model text in it)
      console.error("Paged.js:", e instanceof Error ? e.message : e);
      setBusy(false);
      setFailed(true);
    });
    return () => {
      stopped = true;
    };
    // `trigger` is "Update pages" and Print; the threshold is read when a change comes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, mode, trigger]);

  // leaving the editor: every layout and its styles go
  useEffect(
    () => () => {
      stopRunning();
      destroy(shownLayout.current);
      shownLayout.current = null;
    },
    [],
  );

  const status = busy ? LAYING_OUT : failed ? LAYOUT_FAILED : shown === "pages" ? pagesText(pages) : "";
  useEffect(() => onStatus(status), [status, onStatus]);

  // the selected section outlined in what is shown (a DOM write after the commit)
  useEffect(() => {
    const roots = [pagesBox.current, quickBox.current];
    for (const root of roots) {
      if (!root) continue;
      for (const el of root.querySelectorAll(".dselsec")) el.classList.remove("dselsec");
      if (selected === "doc") continue;
      for (const el of root.querySelectorAll(`[data-sec="${CSS.escape(selected)}"]`)) if (el.classList.contains("dsec")) el.classList.add("dselsec");
    }
  }, [selected, shown, layouts, tree]);

  useImperativeHandle(ref, () => ({
    scrollTo(sec: string) {
      const root = shown === "quick" ? quickBox.current : pagesBox.current;
      const box = scroller.current;
      const el = root?.querySelector(`[data-sec="${CSS.escape(sec)}"]`);
      if (!el || !box) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16;
      box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    },
    print() {
      if (shown === "pages" && !busy && stale === null) window.print();
      else {
        printAfter.current = true;
        setTrigger((n) => n + 1);
      }
    },
  }));

  const pick = (e: React.MouseEvent, then: (sec: string) => void) => {
    const sec = (e.target as Element).closest?.("[data-sec]")?.getAttribute("data-sec");
    if (sec) then(sec);
  };
  const zoomValue = zoom === "fit" ? fit : Number(zoom);
  const state = busy ? "laying" : failed ? "failed" : shown === "pages" ? "done" : shown;
  return (
    <div
      ref={scroller}
      className="relative min-h-0 overflow-auto bg-im-canvas px-6 py-4"
      data-testid="document-pages"
      data-state={state}
      data-shown={shown}
      data-pages={shown === "pages" ? pages : undefined}
      data-layout-ms={lastShownMs ?? undefined}
      data-layouts={layouts}
      onClick={(e) => pick(e, onSelect)}
      onDoubleClick={(e) => pick(e, onOpen)}
    >
      <style>{PAGES_SCREEN_CSS + DOCUMENT_LOOK_CSS + QUICK_SHEET_CSS + PREVIEW_CSS}</style>
      {stale !== null && (
        <div className="de-note mb-3 flex flex-wrap items-center gap-2.5 rounded-lg bg-im-logical-soft px-3.5 py-2 text-[12.5px]" data-testid="note-stale">
          {PREVIEW_TEXTS.stale(stale)}
          <button type="button" className={smallButton} data-testid="button-update-pages" onClick={() => {
              force.current = true;
              setTrigger((n) => n + 1);
            }}
          >
            {PREVIEW_TEXTS.update}
          </button>
        </div>
      )}
      {skipped.map((text) => (
        <div key={text} className="mb-3 rounded-lg bg-im-warn-soft px-3.5 py-2 text-[12.5px]" data-testid="note-skipped">
          {text}
        </div>
      ))}
      {/* the source Paged.js lays out: React's DOM, so every model text stays a text node */}
      <div hidden ref={source}>
        {tree && <DocumentHtml tree={tree} />}
      </div>
      <div ref={offscreen} aria-hidden className="pointer-events-none absolute left-[-20000px] top-0 invisible" />
      <div ref={pagesBox} hidden={shown !== "pages"} style={{ zoom: zoomValue }} data-testid="document-host" />
      <div ref={quickBox} hidden={shown !== "quick"} style={{ zoom: zoomValue }} className="im-doc-quick" data-testid="document-quick-box">
        {tree && shown === "quick" && <DocumentHtml tree={tree} quick />}
      </div>
    </div>
  );
});

/** The selected section's outline and the pointer on sections (the prototype's `.dselsec`). */
const PREVIEW_CSS = `
[data-testid="document-pages"] [data-sec]{cursor:pointer}
[data-testid="document-pages"] .dsec:hover{outline:1px solid #C9D1DA;outline-offset:2mm}
[data-testid="document-pages"] .dsec.dselsec{outline:1.5px solid #3346C4;outline-offset:2mm}
@media print{.im-doc-quick,[data-testid="note-stale"],[data-testid="note-skipped"]{display:none!important}}
`;

const smallButton = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:opacity-50";
