// A fresh page from the server against what the canvas shows (slice 3a, step 5 for notes; slice 3b, step 1 for frames
// and cards). After a write the page is rendered again, but a page started by one write can read the data before a
// later write lands and arrive after it: taken as it is, it would put an older state back (a card or frame jumps back
// after a move, and the canvas then sends its old version with the next move, which is refused). Moves and resizes do
// not refresh the page, so nothing would correct it before a reload. The rules, the same for notes, frames and cards:
// - a row with writes still on their way keeps what the canvas shows;
// - a row the canvas knows at a higher version than the page keeps the canvas's (versions only grow, an undo too);
// - a row deleted here stays gone while the page has it at the version it had when deleted (an undo of the delete
//   brings it back at a higher version);
// - a row the page does not have stays when it was created after the page read the data (`readAt`, server time); one
//   created before was deleted meanwhile (an undo of its creation) and goes.

import type { Uuid } from "@/domain/ids";

export interface FreshRow {
  id: Uuid;
  version: number;
  /** ISO timestamp of the row's creation (server time). */
  createdAt: string;
}

export interface FreshOptions<T extends FreshRow> {
  /** When the page read the data (server time); null: unknown, so rows missing from it go. */
  readAt: string | null;
  /** Writes still on their way for a row (a drag in progress counts as one). */
  pendingOf: (id: Uuid) => number;
  /** Rows deleted here, at the version they had then. */
  deletedHere?: ReadonlyMap<Uuid, number>;
  /** The version the canvas knows for a row (its last write's); default: the row's own. */
  versionOf?: (row: T) => number;
  /** What the canvas shows when it keeps its own row against the page's (default: its own row as it is). */
  keep?: (here: T, page: T) => T;
}

/** The rows after a fresh page: the page's, except where the canvas's are newer (see the file's comment). */
export function mergeFresh<T extends FreshRow>(local: readonly T[], page: readonly T[], o: FreshOptions<T>): T[] {
  const mine = new Map(local.map((r) => [r.id, r]));
  const versionOf = o.versionOf ?? ((r: T) => r.version);
  const out: T[] = [];
  for (const p of page) {
    const deletedAt = o.deletedHere?.get(p.id);
    if (deletedAt !== undefined && p.version <= deletedAt) continue;
    const here = mine.get(p.id);
    out.push(here && (o.pendingOf(p.id) > 0 || versionOf(here) > p.version) ? (o.keep ? o.keep(here, p) : here) : p);
  }
  const onPage = new Set(page.map((r) => r.id));
  for (const r of local) if (!onPage.has(r.id) && o.readAt !== null && r.createdAt > o.readAt) out.push(r);
  return out;
}

/**
 * The versions the canvas takes from a fresh page for its next writes: only those that grow, and none for a row with
 * writes on their way (it keeps its own). Returned, not set, so the canvas's hooks set them where they keep them.
 */
export function grownVersions(
  page: readonly Pick<FreshRow, "id" | "version">[],
  known: (id: Uuid) => number | undefined,
  pendingOf: (id: Uuid) => number,
): [Uuid, number][] {
  return page.filter((r) => !(pendingOf(r.id) > 0) && r.version > (known(r.id) ?? 0)).map((r) => [r.id, r.version]);
}
