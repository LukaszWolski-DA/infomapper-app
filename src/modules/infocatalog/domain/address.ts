// InfoCatalog's state in its address (slice 39, C7): `/catalog?org=…&q=…&scope=…&kind=…`. Read leniently: a missing or
// odd value reads as its default, so an edited address still opens a page (the rights decide what it shows).

import { isUuid } from "@/domain/ids";
import { itemRefText, parseItemRef } from "./item";
import { ALL_TAB } from "./search";
import type { CatalogState } from "./view";

/** The longest query a search takes (longer text is cut). */
export const QUERY_MAX = 200;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (typeof v === "string" ? v : undefined);

export function stateOf(params: Params, org: string): CatalogState {
  const scope = one(params.scope);
  const kind = one(params.kind);
  return {
    org,
    q: (one(params.q) ?? "").slice(0, QUERY_MAX),
    scope: scope && isUuid(scope) ? scope : null,
    kind: kind && /^[a-z-]{1,40}$/.test(kind) ? kind : ALL_TAB,
    item: itemOf(one(params.item)),
  };
}

/** An item's reference as the address holds it; an odd one is kept (cut) so the page answers "not found". */
function itemOf(text: string | undefined): string | null {
  if (text === undefined || text === "") return null;
  const ref = parseItemRef(text);
  return ref ? itemRefText(ref) : text.slice(0, 120);
}

/** The state as an address: only what differs from the defaults. */
export function addressOf(state: CatalogState): string {
  const p = new URLSearchParams({ org: state.org });
  if (state.q) p.set("q", state.q);
  if (state.scope) p.set("scope", state.scope);
  if (state.kind !== ALL_TAB) p.set("kind", state.kind);
  if (state.item) p.set("item", state.item);
  return `/catalog?${p.toString()}`;
}
