// The browser's warning before the page is left (slice 14b, items 8–9, O5–O6): a reload, a closed tab or another site
// asks first while the page has unsaved text: a refused draft, a note's draft, a save on its way, or a focused field
// with typed text not yet sent. Each source holds the guard under its own key while it has such text and releases it
// when it no longer has; the `beforeunload` listener is on `window` only while something holds (Firefox keeps a page
// with the listener out of its back-forward cache), and the browser shows its own fixed text. Nothing here is React
// state: holding and releasing never render anything. Next.js's own navigations (links, Back and Forward between the
// app's pages) fire no `beforeunload`, so they never ask (O6).

type Check = () => boolean;

/** What holds the guard: a key with an optional check asked when the page is about to be left. */
const holds = new Map<unknown, Check | null>();
/** Saves on their way, per key (`track`). */
const onTheWay = new Map<unknown, number>();

/** Whether the page would ask before it is left: something holds, and its check (if any) says yes. */
export function asksToStay(): boolean {
  for (const check of holds.values()) if (!check || check()) return true;
  return false;
}

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!asksToStay()) return;
  e.preventDefault();
  // older browsers ask only when it is set; the text is the browser's own
  e.returnValue = "";
}

/**
 * Holds the guard under `key` (one source: a field, a store), with an optional `check` asked when the page is about to
 * be left (for a source whose unsaved state can change with nothing to tell it, such as the page's path).
 */
export function hold(key: unknown, check: Check | null = null): void {
  if (typeof window === "undefined") return;
  if (!holds.size) window.addEventListener("beforeunload", onBeforeUnload);
  holds.set(key, check);
}

/** Releases the guard held under `key`; the listener goes with the last one. */
export function release(key: unknown): void {
  if (!holds.delete(key) || holds.size) return;
  window.removeEventListener("beforeunload", onBeforeUnload);
}

/** Holds or releases under `key`: the one call a source makes whenever its unsaved state may have changed. */
export function guard(key: unknown, unsaved: boolean): void {
  if (unsaved) hold(key);
  else release(key);
}

/** Holds the guard under `key` while `save` is on its way (with every other save tracked under the same key). */
export function track<T>(key: unknown, save: Promise<T>): Promise<T> {
  onTheWay.set(key, (onTheWay.get(key) ?? 0) + 1);
  hold(key);
  const done = () => {
    const left = (onTheWay.get(key) ?? 1) - 1;
    if (left > 0) return void onTheWay.set(key, left);
    onTheWay.delete(key);
    release(key);
  };
  save.then(done, done);
  return save;
}

/** Whether the listener is on the window (tests). */
export const isListening = (): boolean => holds.size > 0;
