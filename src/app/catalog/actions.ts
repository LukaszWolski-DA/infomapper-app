"use server";

// InfoCatalog's search as the person types (slice 39, S39-03, C1): one server request per search, the rights checked
// inside the catalog index; the answer is the page's view. A state the person may not read answers "not found".

import { catalogReadableFor, catalogSearchView, stateOf, type CatalogState, type CatalogView } from "@/compose/catalog";
import { getSession } from "../_lib/session";

export async function catalogSearchAction(input: CatalogState): Promise<{ ok: true; view: CatalogView } | { ok: false }> {
  const session = await getSession();
  if (!session || typeof input?.org !== "string") return { ok: false };
  const state = stateOf({ q: input.q, scope: input.scope ?? undefined, kind: input.kind }, input.org);
  const readable = await catalogReadableFor(session.user.id, session.unlocked);
  const view = await catalogSearchView(session.user.id, session.unlocked, readable, state);
  return view ? { ok: true, view } : { ok: false };
}
