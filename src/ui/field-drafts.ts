// Drafts of fields whose panel closed (slice 13, item 5a, answer 7): a text field that unmounts with a draft, or whose
// save is refused after it unmounted, leaves the draft here, and a field of the same object and field takes it back when
// it mounts again. Only in the page's memory, never in the browser's storage: a draft is kept for the page (its path) it
// was typed on, and gone after a reload or on another page.

/** A kept draft: the text, the stored value it started from, and whether a save of it was refused. */
export interface KeptDraft {
  text: string;
  base: string;
  refused: boolean;
}

const kept = new Map<string, KeptDraft & { path: string }>();

const here = (): string => (typeof window === "undefined" ? "" : window.location.pathname);

/** Keeps the draft of field `key` (`fieldKey`) on this page. */
export function keepDraft(key: string, draft: KeptDraft): void {
  kept.set(key, { ...draft, path: here() });
}

/** Changes a kept draft (a refusal that arrived after its field unmounted); nothing when there is none. */
export function updateDraft(key: string, change: Partial<KeptDraft>): boolean {
  const k = kept.get(key);
  if (!k) return false;
  kept.set(key, { ...k, ...change });
  return true;
}

/** Takes the kept draft of field `key` out of the store; one typed on another page is dropped. */
export function takeDraft(key: string): KeptDraft | null {
  const k = kept.get(key);
  kept.delete(key);
  if (!k || k.path !== here()) return null;
  return { text: k.text, base: k.base, refused: k.refused };
}

/** Drops the kept draft of field `key` (its save was stored). */
export function dropDraft(key: string): void {
  kept.delete(key);
}
