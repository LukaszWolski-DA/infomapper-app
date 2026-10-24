"use client";

// Selection places (slice 6b, D-38; step 1 answers 3–5): a selection on the canvas is a place in the browser's history.
// Selecting one item pushes an entry without a URL (`history.pushState(null, "")`: no route, no request, no render) and
// keeps the selection in the places store under the new entry's key (`history-places.ts`); the same item again records
// nothing, and so do a deselection, a multi-selection and a bundle. A selection made on arrival (`?card`, `?label`,
// `?req`, `?note`) belongs to the page's own entry. Back or Forward onto an entry selects its place (`ui.showPlace`:
// as a click, never opening the details panel, centred when off screen), or nothing for the page's own entry; a place
// that no longer exists becomes the canvas without a selection and a toast. A traversal to a place on another canvas
// lets the route change first; the canvas drawn after it applies the place once it is mounted. A reload starts without a
// selection. Renders nothing; reads the selection from the canvas context, never re-renders `ModelCanvas` itself.

import { usePathname, useSearchParams } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/ui/components/toast";
import { navigationApi, readPlace, savePlace, traversal, type Place } from "@/ui/history-places";
import { canvasReady } from "./canvas-ready";
import { CanvasUiCtx, type PlaceGone } from "./context";
import { useValue } from "./value-store";
import type { Selection } from "./line-data";

const GONE: Record<PlaceGone, string> = {
  card: "That card is no longer on this canvas.",
  row: "That row is no longer on this canvas.",
  map: "That mapping no longer exists.",
  rel: "That relationship no longer exists.",
  frame: "That frame is no longer on this canvas.",
  note: "That note is no longer on this canvas.",
  req: "That requirement no longer exists.",
  label: "That label no longer exists.",
  element: "That element no longer exists.",
  // slice 7a: a system disappears when the import that created it is undone
  source_system: "That source system no longer exists.",
};

const ARRIVAL = ["card", "label", "req", "note"];

/** The place a selection stands for, or null when it is not one (nothing, several items, a bundle). */
const placeOf = (canvasId: string, sel: Selection): Place | null => (!sel || sel.t === "multi" || sel.t === "bundle" ? null : { canvasId, sel });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SelectionHistory({ canvasId, labelIds }: { canvasId: string; labelIds: readonly string[] }) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pagePath] = useState(pathname);
  // a selection asked for by the address the page was opened with: it belongs to the page's own entry
  const arrival = useRef(ARRIVAL.some((k) => search.has(k)));
  // the selection a traversal is applying: not recorded again
  const applying = useRef(false);
  const latest = useRef({ ui, toast, labelIds });
  useEffect(() => {
    latest.current = { ui, toast, labelIds };
  });

  // the address lost its arrival parameter (the canvas drops it once it has selected): later selections push
  useEffect(() => {
    if (!ARRIVAL.some((k) => search.has(k))) arrival.current = false;
  }, [search]);

  // recording
  useEffect(() => {
    const nav = navigationApi();
    const key = nav?.currentEntry?.key;
    if (!nav || !key) return;
    if (applying.current) {
      applying.current = false;
      return;
    }
    const place = placeOf(canvasId, ui.selection);
    if (!place) return;
    let storage: Storage;
    try {
      storage = window.sessionStorage;
    } catch {
      return;
    }
    const keys = () => nav.entries().map((e) => e.key);
    const current = readPlace(storage, key);
    if (current && same(current, place)) return;
    if (arrival.current) {
      arrival.current = false;
      savePlace(storage, key, place, keys());
      return;
    }
    window.history.pushState(null, "");
    savePlace(storage, nav.currentEntry!.key, place, keys());
  }, [ui.selection, canvasId]);

  // applying a place: the entry's own, or nothing for the page's entry
  const apply = useRef((place: Place | null) => {
    const { ui, toast, labelIds } = latest.current;
    const target: Selection = place?.sel as Selection ?? null;
    if (!same(ui.selection, target)) applying.current = true;
    if (!target) {
      ui.select(null);
      return;
    }
    if (target.t === "label" && !labelIds.includes(target.id)) {
      if (ui.selection) applying.current = true;
      ui.select(null);
      toast(GONE.label);
      return;
    }
    const gone = ui.showPlace(target);
    if (gone) toast(GONE[gone]);
  });

  useEffect(() => {
    const onPop = () => {
      const nav = navigationApi();
      const key = nav?.currentEntry?.key;
      if (!nav || !key) return;
      let place: Place | null = null;
      try {
        place = readPlace(window.sessionStorage, key);
      } catch {
        // blocked storage: no place
      }
      // another page: the route changes first, the canvas drawn after it applies the place (`traversal.key`)
      if (window.location.pathname !== pagePath || (place && place.canvasId !== canvasId)) return;
      apply.current(place);
    };
    // capture phase, ahead of Next.js's own listener (see `HistoryNav`)
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [pagePath, canvasId]);

  // arriving by a traversal from another page: once the canvas is ready (its view set, its nodes there), the place of
  // the entry the traversal landed on
  const mounted = useValue(canvasReady);
  useEffect(() => {
    const key = navigationApi()?.currentEntry?.key;
    if (!mounted || !key || traversal.key !== key) return;
    traversal.key = null;
    let place: Place | null = null;
    try {
      place = key ? readPlace(window.sessionStorage, key) : null;
    } catch {
      // blocked storage: no place
    }
    if (place && place.canvasId === canvasId) apply.current(place);
  }, [mounted, canvasId]);

  return null;
}
