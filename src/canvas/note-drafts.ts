// A note's text draft (slice 14a, D-66; step 1 answer 4): one per note, kept by the canvas for the page, shown by the
// note on the canvas and adopted by the note panel's text field. The note's data keeps the stored text; the draft is
// what the person typed, from the moment a save of it starts until it is stored or dropped:
// - a save starts: the draft's text is the value sent; its base is the stored text it started from (after a conflict,
//   the newest stored text: only "Keep mine" saves then);
// - a save is stored: the draft ends when its text is the stored one; text typed after it stays, on the new base;
// - a refusal keeps the draft with its kind: `mark` (a stale version or a save cut behind a refusal: the conflict line
//   or "Not saved", by its base), `locked` ("Not saved", editable), `copy` (a permission or the archive: read-only); an
//   invalid input keeps it for correcting, unmarked; a note not found takes it with it.
// The store is outside React's state: a note's box reads its own draft (`useNoteDraft`), so a draft, its mark, "Use this"
// or "Keep mine" never re-render the canvas (S14A-13). While any note has a draft, leaving the page asks first (slice
// 14b, `leave-guard.ts`).

import { useSyncExternalStore } from "react";
import { guard, release } from "@/ui/leave-guard";

export type NoteDraftRefusal = "mark" | "locked" | "copy";

export interface NoteDraft {
  /** The text the person typed. */
  text: string;
  /** The stored text the draft started from. */
  base: string;
  /** The value of the newest save on its way, until it is answered. */
  sent: string | null;
  /** Why its last save was refused; null while it is on its way, or after an invalid input. */
  refusal: NoteDraftRefusal | null;
}

/** What a refusal's code makes of a draft: its kind, `gone` (the note was deleted), or nothing (it stays unmarked). */
export function draftRefusal(code: string): NoteDraftRefusal | "gone" | null {
  if (code === "stale_version" || code === "cut") return "mark";
  if (code === "locked") return "locked";
  if (code === "forbidden" || code === "archived") return "copy";
  if (code === "not_found") return "gone";
  return null;
}

/** Whether the draft is in conflict with the stored text: refused as stale while someone else changed the text. */
export const inConflict = (d: NoteDraft | null | undefined, stored: string): boolean => !!d && d.refusal === "mark" && d.base !== stored;

/** What leaving a note's editor with `text` does: saves it, keeps it as the draft (a conflict), drops it, or nothing. */
export function onLeave(d: NoteDraft | null | undefined, text: string, stored: string): "save" | "keep" | "drop" | "none" {
  if (inConflict(d, stored)) return "keep";
  if (!d) return text === stored ? "none" : "save";
  if (d.sent !== null && text === d.sent) return "none";
  if (d.sent === null && text === stored) return "drop";
  return "save";
}

export class NoteDrafts {
  private drafts = new Map<string, NoteDraft>();
  private listeners = new Set<() => void>();

  get = (id: string): NoteDraft | null => this.drafts.get(id) ?? null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(id: string, d: NoteDraft | null): void {
    if (d) this.drafts.set(id, d);
    else if (!this.drafts.delete(id)) return;
    guard(this, this.drafts.size > 0);
    for (const l of this.listeners) l();
  }

  /** The canvas closed: its drafts go with its page, and leaving no longer asks for them. */
  close(): void {
    release(this);
  }

  /** A save of `text` starts; `stored` is the note's stored text now. */
  start(id: string, text: string, stored: string): void {
    const e = this.get(id);
    this.set(id, { text, base: !e || inConflict(e, stored) ? stored : e.base, sent: text, refusal: null });
  }

  /** A save was stored: the note's text is now `stored`. */
  stored(id: string, stored: string): void {
    const e = this.get(id);
    if (!e) return;
    if (e.text === stored) this.set(id, null);
    else this.set(id, { ...e, base: stored, sent: e.sent === stored ? null : e.sent });
  }

  /** A save was refused (or cut) with `code`. */
  refused(id: string, code: string): void {
    const e = this.get(id);
    if (!e) return;
    const kind = draftRefusal(code);
    if (kind === "gone") this.set(id, null);
    else this.set(id, { ...e, sent: null, refusal: kind });
  }

  /** Text typed while a conflict shows: kept as the draft, not saved. */
  keepText(id: string, text: string): void {
    const e = this.get(id);
    if (e && e.text !== text) this.set(id, { ...e, text });
  }

  /** "Use this", Escape: the draft ends and the stored text shows. */
  drop(id: string): void {
    this.set(id, null);
  }

  /** Only the notes still on the canvas keep their drafts (a note deleted elsewhere takes its draft with it). */
  retain(ids: ReadonlySet<string>): void {
    for (const id of [...this.drafts.keys()]) if (!ids.has(id)) this.set(id, null);
  }
}

/** A canvas without notes' drafts (outside a canvas). */
export const NO_NOTE_DRAFTS = new NoteDrafts();

/** The draft of one note; the component re-renders only when that note's draft changes. */
export function useNoteDraft(drafts: NoteDrafts, id: string): NoteDraft | null {
  return useSyncExternalStore(
    drafts.subscribe,
    () => drafts.get(id),
    () => drafts.get(id),
  );
}
