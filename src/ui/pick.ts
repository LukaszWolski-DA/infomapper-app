// The picker's rules (slice 17, D-72; prototype openPick, renderPick): one small list at a screen point, filtered by
// typing. A single choice picks at once; with `multi` the items are check items and a button confirms. Kept apart from
// the component so the rules have unit tests.

export interface PickItem {
  id: string;
  label: string;
  /** Shown before the label in the monospace font (a requirement's key). */
  key?: string;
  /** A swatch before the label (a concept's colour). */
  color?: string;
  /** Already done: shown checked and disabled (a requirement linked already). */
  done?: boolean;
}

export interface PickOptions {
  /** The screen point the picker opens at (its top-left corner, kept on the screen). */
  at: { x: number; y: number };
  title: string;
  /** A line under the title. */
  note?: string;
  placeholder: string;
  /** The text when there are no items at all. */
  empty: string;
  /** The title of a done item. */
  doneTitle?: string;
  items: readonly PickItem[];
  multi?: boolean;
  /** The confirm button's text for `n` checked items (`multi` only). */
  confirm?: (n: number) => string;
  /** A button in the footer, which closes the picker and runs `act`. */
  extra?: { label: string; act: () => void };
  /**
   * Slice 21 (D-76): an item that creates one from the typed text, last in the list, while the text equals no item's
   * label (`createText`). `act` gets the text with its extra spaces removed. A single choice only.
   */
  create?: { label: (text: string) => string; act: (text: string) => void };
  /** The chosen ids: one for a single choice, the checked ones for `multi`. */
  pick: (ids: string[]) => void;
  testId?: string;
}

/**
 * The items the filter leaves, by the label and the key, case ignored (prototype pickVisible). Slice 21: extra spaces
 * are ignored on both sides, as the create item compares (`pickNorm`), so a name typed with extra spaces still shows
 * its item (the prototype's filter keeps them, and showed neither the item nor the create item).
 */
export function visibleItems(items: readonly PickItem[], query: string): PickItem[] {
  const q = pickNorm(query);
  if (!q) return [...items];
  return items.filter((it) => pickNorm(`${it.label} ${it.key ?? ""}`).includes(q));
}

/** What a list without items says: the empty text, or that nothing matches the filter. */
export function noneText(options: Pick<PickOptions, "items" | "empty">, query: string): string {
  return options.items.length ? `Nothing matches “${query.trim()}”.` : options.empty;
}

/** A label as the create item compares it (the prototype's `pkNorm`): trimmed, inner spaces collapsed, case ignored. */
export const pickNorm = (text: string): string => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The create item's text (slice 21, D-76): the typed text with its extra spaces removed, while it equals no item's
 * label (case and extra spaces ignored); "" with an empty filter, an exact match or no create option.
 */
export function createText(options: Pick<PickOptions, "items" | "create">, query: string): string {
  const text = query.trim().replace(/\s+/g, " ");
  if (!options.create || !text) return "";
  const norm = pickNorm(text);
  return options.items.some((it) => pickNorm(it.label) === norm) ? "" : text;
}

/**
 * Enter in the filter field: with `multi` it confirms when something is checked; a single choice picks the one
 * enabled item left, else nothing. Slice 21 (D-72 kept): the create item (`create`, its text) is taken only when no
 * item is left, so "sal" + Enter still picks Sales beside “New concept “sal””. Returns what Enter does.
 */
export function enterAction(multi: boolean, enabled: readonly PickItem[], checked: number, create = ""): { confirm: true } | { pick: string } | { create: string } | null {
  if (multi) return checked ? { confirm: true } : null;
  if (enabled.length === 1) return { pick: enabled[0]!.id };
  return !enabled.length && create ? { create } : null;
}

/**
 * ↓ and ↑ between the enabled items: `at` is the focused item's index, −1 for the field. ↓ goes to the next item and
 * from the last to the first; ↑ goes to the previous item and from the first back to the field (−1).
 */
export function nextFocus(at: number, count: number, key: "ArrowDown" | "ArrowUp"): number {
  if (!count) return -1;
  if (key === "ArrowDown") return at + 1 < count ? at + 1 : 0;
  return at <= 0 ? -1 : at - 1;
}

/** The picker's top-left corner, kept 8 px inside the window. */
export function clampAt(at: { x: number; y: number }, size: { width: number; height: number }, win: { width: number; height: number }) {
  return {
    x: Math.max(8, Math.min(at.x, win.width - size.width - 8)),
    y: Math.max(8, Math.min(at.y, win.height - size.height - 8)),
  };
}
