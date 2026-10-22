// Places in the browser's history (slice 6b, D-38). The browser's history is the only history: pages are the entries
// Next.js makes, and a selection is an entry of its own, pushed without a URL (`history.pushState(null, "")`), so
// nothing routes, fetches or renders. What an entry stands for is kept here, in `sessionStorage` under the entry's
// Navigation API key, never in `history.state`: Next.js rewrites the current entry's state after every router update (a
// write's refresh), while the key belongs to the history slot and stays (step 1, section 8). Keys whose entry left the
// tab's history are pruned on every write.

/** The part of the Navigation API the app uses (Baseline since January 2026; TypeScript 5.9's DOM lib lacks it). */
export interface NavigationEntryLike {
  key: string;
  index: number;
}
export interface NavigationLike extends EventTarget {
  currentEntry: NavigationEntryLike | null;
  canGoBack: boolean;
  canGoForward: boolean;
  entries: () => NavigationEntryLike[];
}

/** The browser's Navigation API, or null where it is missing (then the buttons are hidden and our keys are off). */
export const navigationApi = (): NavigationLike | null =>
  typeof window !== "undefined" && "navigation" in window ? ((window as unknown as { navigation: NavigationLike }).navigation ?? null) : null;

const PREFIX = "infomapper:place:";

/** What a history entry stands for beyond its page: a selection on a canvas (slice 6b, step 3). */
export interface Place {
  /** The canvas the selection is on. */
  canvasId: string;
  /** The selection, as the canvas stores it. */
  sel: unknown;
}

export function readPlace(storage: Storage, key: string): Place | null {
  try {
    const raw = storage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

/** Keeps a place for an entry and forgets the places of entries no longer in the tab's history. */
export function savePlace(storage: Storage, key: string, place: Place | null, liveKeys: Iterable<string>): void {
  try {
    if (place) storage.setItem(PREFIX + key, JSON.stringify(place));
    else storage.removeItem(PREFIX + key);
  } catch {
    // blocked or full storage: the place is simply not remembered
  }
  prunePlaces(storage, liveKeys);
}

/** Removes the places whose entry is gone (the browser cut it off or dropped it); returns how many. */
export function prunePlaces(storage: Storage, liveKeys: Iterable<string>): number {
  const live = new Set(liveKeys);
  const gone: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(PREFIX) && !live.has(k.slice(PREFIX.length))) gone.push(k);
    }
    for (const k of gone) storage.removeItem(k);
  } catch {
    return 0;
  }
  return gone.length;
}
