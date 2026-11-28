"use server";

// InfoCatalog's search as the person types (slice 39, S39-03, C1): one server request per search, the rights checked
// inside the catalog index; the answer is the page's view. A state the person may not read answers "not found".

import { catalogItemView, catalogReadableFor, catalogSearchView, stateOf, type CatalogItemView, type CatalogState, type CatalogView } from "@/compose/catalog";
import { getSession } from "../_lib/session";

export async function catalogSearchAction(input: CatalogState): Promise<{ ok: true; view: CatalogView } | { ok: false }> {
  const session = await getSession();
  if (!session || typeof input?.org !== "string") return { ok: false };
  const state = stateOf({ q: input.q, scope: input.scope ?? undefined, kind: input.kind, item: input.item ?? undefined }, input.org);
  const readable = await catalogReadableFor(session.user.id, session.unlocked);
  const view = await catalogSearchView(session.user.id, session.unlocked, readable, state);
  return view ? { ok: true, view } : { ok: false };
}

/** One item's drawer (S39-04): "not found" (`ok: false`) for an item the person may not read, as for one that is gone. */
export async function catalogItemAction(org: string, ref: string): Promise<{ ok: true; item: CatalogItemView } | { ok: false }> {
  const session = await getSession();
  if (!session || typeof org !== "string" || typeof ref !== "string") return { ok: false };
  const readable = await catalogReadableFor(session.user.id, session.unlocked);
  const item = await catalogItemView(session.user.id, session.unlocked, readable, org, ref);
  return item ? { ok: true, item } : { ok: false };
}
