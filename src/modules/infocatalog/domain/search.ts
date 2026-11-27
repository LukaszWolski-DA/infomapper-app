// InfoCatalog's search (slice 39, S39-03, C1 as answered): over the items of the readable workspaces in scope, with the
// tabs ("All" first, then InfoMapper's and the modules' in their order), the counts per tab, the first 200 results and
// how many more. Pure; the matching, ranking and highlight are InfoMapper's domain (`@/domain/catalog/match`).
// - The order: the tier, then the tabs' order (and a tab's kinds in its order), then the workspace's place in the scope
//   (by name), then the item's place in its kind's model order.
// - An empty query: nothing on "All" (the page shows its examples); on a tab, every item of it in that order (Browse).

import { catalogQuery, definitionLine, highlightRanges, indexCatalogItem, matchTier, type CatalogTier, type DefinitionLine, type IndexedCatalogItem, type TextRange } from "@/domain/catalog/match";
import type { CatalogItem, CatalogTab } from "@/domain/catalog/items";
import type { Uuid } from "@/domain/ids";

/** "All": every tab's items. */
export const ALL_TAB = "all";

/** How many results an answer holds (the PRD: the first 200 drawn, then "{n} more: narrow the search"). */
export const RESULT_LIMIT = 200;

export interface CatalogResult {
  readonly item: CatalogItem;
  /** Null when browsing (no query). */
  readonly tier: CatalogTier | null;
  readonly nameRanges: readonly TextRange[];
  readonly pathRanges: readonly TextRange[];
  readonly definition: DefinitionLine | null;
}

export interface CatalogAnswer {
  /** Results per tab key, "all" included, before the tab's filter. */
  readonly counts: Readonly<Record<string, number>>;
  readonly results: readonly CatalogResult[];
  /** Results of the tab beyond the limit. */
  readonly more: number;
}

export interface CatalogIndex {
  readonly tabs: readonly CatalogTab[];
  readonly items: readonly IndexedCatalogItem[];
  readonly tabOf: ReadonlyMap<string, string>;
  readonly kindRank: ReadonlyMap<string, number>;
  readonly workspaceRank: ReadonlyMap<Uuid, number>;
}

/** The index of one read: the items folded once, the tabs, the workspaces in the scope's order. */
export function catalogIndex(items: readonly CatalogItem[], tabs: readonly CatalogTab[], workspaces: readonly Uuid[]): CatalogIndex {
  const tabOf = new Map<string, string>();
  const kindRank = new Map<string, number>();
  for (const t of tabs) for (const k of t.kinds) {
    tabOf.set(k, t.key);
    kindRank.set(k, kindRank.size);
  }
  return {
    tabs,
    // an item of a kind no tab holds is never shown
    items: items.filter((i) => tabOf.has(i.kind)).map(indexCatalogItem),
    tabOf,
    kindRank,
    workspaceRank: new Map(workspaces.map((id, i) => [id, i])),
  };
}

export function searchCatalog(index: CatalogIndex, query: string, tab: string = ALL_TAB, limit: number = RESULT_LIMIT): CatalogAnswer {
  const q = catalogQuery(query);
  const browsing = q.words.length === 0;
  const counts: Record<string, number> = { [ALL_TAB]: 0 };
  for (const t of index.tabs) counts[t.key] = 0;
  const hits: { x: IndexedCatalogItem; tier: CatalogTier | null }[] = [];
  for (const x of index.items) {
    const tier = browsing ? null : matchTier(x, q);
    if (!browsing && tier === null) continue;
    const key = index.tabOf.get(x.item.kind)!;
    counts[ALL_TAB]!++;
    counts[key]!++;
    if (tab === ALL_TAB ? !browsing : key === tab) hits.push({ x, tier });
  }
  const rank = (h: (typeof hits)[number]) => [h.tier ?? 0, index.kindRank.get(h.x.item.kind)!, index.workspaceRank.get(h.x.item.workspaceId) ?? Number.MAX_SAFE_INTEGER, h.x.item.order];
  hits.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! - rb[i]!;
    return 0;
  });
  const results = hits.slice(0, limit).map(({ x, tier }) => ({
    item: x.item,
    tier,
    nameRanges: highlightRanges(x.item.name, q.words),
    pathRanges: highlightRanges(x.item.path, q.words),
    definition: definitionLine(x.item.definition, q.words),
  }));
  return { counts, results, more: Math.max(0, hits.length - limit) };
}
