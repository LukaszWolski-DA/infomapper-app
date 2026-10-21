"use client";

// Focus (slice 4b-1, PRD items 20–23; D-22; prototype #tFocus, V.focus, focusCtx): fades everything not connected to
// the selection. On and off from the toolbar button, the card and row menus (“Focus on this” / “Turn Focus off”) and its
// chip in the view-state bar (×; in the status bar until slice 6a). Momentary: never saved, off after a reload and when
// switching canvas. Every role may use it.
// The on/off state is a store of its own (`focusOn`), and `FocusDriver` turns it and the selection into a fade request
// (`fade.ts`), so switching Focus never re-renders the canvas; only the fading draws again (S4B1-13).

import { memo, useContext, useEffect, useRef } from "react";
import type { Uuid } from "@/domain/ids";
import { useToast } from "@/ui/components/toast";
import type { CardData } from "./card-data";
import { CanvasUiCtx } from "./context";
import { focusOn, requestFade, type FocusTarget } from "./fade";
import type { Selection } from "./line-data";
import { useValue } from "./value-store";

export const FOCUS_HINT = "Focus fades everything not connected to what you select.";

/**
 * What Focus is on for a selection (PRD item 21): a card (its entity or table), a row (its attribute or column), a
 * mapping, a relationship, a frame (its cards), several items (their cards; frames stand for theirs, notes add nothing;
 * requirement cards for their requirements, slice 4b-2) or a requirement. Nothing for no selection, a note, a label, a bundle or an element not on this canvas: then Focus
 * stays on and fades nothing (prototype `relatedOf`).
 */
export function focusTargetOf(selection: Selection, cards: readonly Pick<CardData, "id" | "kind" | "targetId" | "frameId">[]): FocusTarget | null {
  if (!selection) return null;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const several = (frameIds: ReadonlySet<string>, entities: Uuid[], tables: Uuid[], requirements: Uuid[] = []): FocusTarget | null => {
    for (const c of cards) if (c.frameId && frameIds.has(c.frameId)) (c.kind === "ent" ? entities : tables).push(c.targetId);
    if (!entities.length && !tables.length && !requirements.length) return null;
    const unique = (ids: Uuid[]) => [...new Set(ids)].sort();
    return { t: "several", entities: unique(entities), tables: unique(tables), ...(requirements.length ? { requirements: unique(requirements) } : {}) };
  };
  switch (selection.t) {
    case "card": {
      const c = byId.get(selection.id);
      return c ? { t: c.kind === "ent" ? "entity" : "table", id: c.targetId } : null;
    }
    case "row": {
      const c = byId.get(selection.cardId);
      return c ? { t: c.kind === "ent" ? "attribute" : "column", id: selection.id } : null;
    }
    case "map":
      return { t: "mapping", id: selection.id };
    case "rel":
      return { t: "relationship", id: selection.id };
    case "frame":
      return several(new Set([selection.id]), [], []);
    case "multi": {
      const entities: Uuid[] = [], tables: Uuid[] = [], requirements: Uuid[] = [], frames = new Set<string>();
      for (const k of selection.keys) {
        const id = k.slice(k.indexOf(":") + 1);
        if (k.startsWith("entity:")) entities.push(id);
        else if (k.startsWith("source:")) tables.push(id);
        else if (k.startsWith("frame:")) frames.add(id);
        else if (k.startsWith("req:")) requirements.push(id);
      }
      return several(frames, entities, tables, requirements);
    }
    case "req":
      return { t: "requirement", id: selection.id };
    default:
      return null;
  }
}

/**
 * Turns Focus and the selection into the fade request. Renders nothing. While Focus is off it leaves the request alone
 * (the measuring hook switches fading too); turning Focus off clears it. Leaving the canvas, or switching to another
 * one, turns Focus off (PRD item 22).
 */
export const FocusDriver = memo(function FocusDriver({ target, canvasId }: { target: FocusTarget | null; canvasId: string }) {
  const on = useValue(focusOn);
  const was = useRef(false);
  // the target is worked out again on every canvas render (a drag moves the cards): a request with the same key changes
  // nothing (`requestFade`)
  useEffect(() => {
    if (on) requestFade(target ? { focus: target } : null);
    else if (was.current) requestFade(null);
    was.current = on;
  }, [on, target]);
  useEffect(
    () => () => {
      focusOn.set(false);
      requestFade(null);
    },
    [canvasId],
  );
  return null;
});

/** Turns Focus on or off; turning it on with nothing selected says what it does (prototype). */
export function toggleFocus(selection: Selection, toast: (text: string) => void): void {
  const next = !focusOn.get();
  focusOn.set(next);
  if (next && !selection) toast(FOCUS_HINT);
}

/** The toolbar's Focus button (prototype #tFocus): after the layer switch; every role has it. No keyboard shortcut. */
export function FocusButton() {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const on = useValue(focusOn);
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Fade everything not connected to the selection"
      data-testid="button-focus"
      onClick={() => toggleFocus(ui.selection, toast)}
      className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-md px-2 text-im-ink-2 hover:bg-im-hover hover:text-im-ink aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.4] [stroke-linecap:round]" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v2.5M8 12v2.5M1.5 8h2.5M12 8h2.5" />
      </svg>
      <span className="hidden lg:inline">Focus</span>
    </button>
  );
}
