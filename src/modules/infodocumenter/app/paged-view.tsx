"use client";

// The document laid out in A4 pages in the browser (slice 25, step 4; F28, F29): Paged.js 0.4.3 (the pinned npm package,
// loaded only here, never on the server) takes a copy of the source the server rendered (React's DOM, so the model's
// texts stay text nodes) and the document's own CSS, and draws the pages into a container React does not render into.
// "Laying out pages…" meanwhile, "{n} pages" after. Print opens the browser's dialog on the laid-out pages; `print`
// (the form's Print, `?print=1`) opens it once they are ready. Leaving the page removes Paged.js's styles.

import { useEffect, useRef, useState } from "react";
import { PAGES_SCREEN_CSS } from "../ui/document-css";

export const LAYING_OUT = "Laying out pages…";
export const pagesText = (n: number) => `${n} page${n === 1 ? "" : "s"}`;
export const LAYOUT_FAILED = "The pages could not be laid out. Reload the page to try again.";

type State = { kind: "laying" } | { kind: "done"; pages: number; ms: number } | { kind: "failed" };

interface PagedPreviewer {
  preview(content: Node, stylesheets: Record<string, string>[], renderTo: HTMLElement): Promise<unknown>;
  polisher: { destroy(): void };
  chunker: { destroy(): void };
}

export function PagedView({ sourceId, css, print }: { sourceId: string; css: string; print: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ kind: "laying" });

  useEffect(() => {
    let gone = false;
    let previewer: PagedPreviewer | null = null;
    // the hidden wrapper's content: the document as React rendered it
    const source = document.getElementById(sourceId)?.firstElementChild;
    const target = host.current;
    if (!source || !target) return;
    const started = performance.now();
    (async () => {
      const { Previewer } = (await import("pagedjs")) as unknown as { Previewer: new () => PagedPreviewer };
      if (gone) return;
      previewer = new Previewer();
      await previewer.preview(source.cloneNode(true), [{ "infodocumenter.css": css }], target);
      if (gone) return;
      const pages = target.querySelectorAll(".pagedjs_page").length;
      setState({ kind: "done", pages, ms: Math.round(performance.now() - started) });
      if (print) window.print();
    })().catch((e: unknown) => {
      // the page says so; the reason goes to the console for a bug report (no model text in it)
      console.error("Paged.js:", e instanceof Error ? e.message : e);
      if (!gone) setState({ kind: "failed" });
    });
    return () => {
      gone = true;
      try {
        previewer?.polisher.destroy();
        previewer?.chunker.destroy();
      } catch {
        // already gone with the page
      }
      target.replaceChildren();
    };
  }, [sourceId, css, print]);

  const ready = state.kind === "done";
  return (
    <div data-testid="document-pages" data-state={state.kind} data-pages={ready ? state.pages : undefined} data-layout-ms={ready ? state.ms : undefined}>
      <style>{PAGES_SCREEN_CSS}</style>
      <div className="mb-3 flex items-center gap-3 print:hidden">
        <span data-testid="text-pages" className="text-[12px] text-im-ink-3" role="status">
          {state.kind === "laying" ? LAYING_OUT : state.kind === "failed" ? LAYOUT_FAILED : pagesText(state.pages)}
        </span>
        <button
          type="button"
          data-testid="button-print"
          disabled={!ready}
          onClick={() => window.print()}
          className="h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:opacity-50"
        >
          Print
        </button>
      </div>
      <div ref={host} className="im-doc-host" data-testid="document-host" />
    </div>
  );
}
