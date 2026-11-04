// Drafts of fields whose panel closed (slice 13, item 5a, answer 7): a text field that unmounts with a draft, or whose
// save is refused after it unmounted, leaves the draft here, and a field of the same object and field takes it back when
// it mounts again. Only in the page's memory, never in the browser's storage: a draft is kept for the page (its path) it
// was typed on, and gone after a reload or on another page. While a draft is kept for the page shown, leaving the page
// asks first (slice 14b, `leave-guard.ts`).

import { hold, release } from "./leave-guard";

/** A kept draft: the text, the stored value it started from, and whether a save of it was refused. */
export interface KeptDraft {
  text: string;
  base: string;
  refused: boolean;
}

const kept = new Map<string, KeptDraft & { path: string }>();

const here = (): string => (typeof window === "undefined" ? "" : window.location.pathname);

/** A draft kept for the page shown: the person can open its panel again and find it (slice 14b). */
const keptHere = (): boolean => [...kept.values()].some((k) => k.path === here());
/** The guard holds while any draft is kept; leaving asks only when one is kept for the page shown. */
const guardKept = (): void => (kept.size ? hold(kept, keptHere) : release(kept));

/** Keeps the draft of field `key` (`fieldKey`) on this page. */
export function keepDraft(key: string, draft: KeptDraft): void {
  kept.set(key, { ...draft, path: here() });
  guardKept();
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
  guardKept();
  if (!k || k.path !== here()) return null;
  return { text: k.text, base: k.base, refused: k.refused };
}

/** Objects deleted while their drafts were on their way (a `not_found` refusal): none of their drafts is kept. */
const gone = new Set<string>();
const objectOf = (key: string): string => key.split(":")[0] ?? key;

/** The object of field `key` was deleted: its kept drafts go, and none is kept again (slice 13, answer 8). */
export function markGone(key: string): void {
  const object = objectOf(key);
  gone.add(object);
  for (const k of [...kept.keys()]) if (objectOf(k) === object) kept.delete(k);
  guardKept();
}

/** Whether the object of field `key` was deleted (`markGone`). */
export const isGone = (key: string): boolean => gone.has(objectOf(key));

/** A field of the object mounts again (an undo brought it back): its drafts are kept again. */
export function unmarkGone(key: string): void {
  gone.delete(objectOf(key));
}

/** Drops the kept draft of field `key` (its save was stored). */
export function dropDraft(key: string): void {
  kept.delete(key);
  guardKept();
}
