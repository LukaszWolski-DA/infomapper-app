// InfoCatalog's page (slice 39, S39-01, S39-03): only for a person who reads an organization's InfoCatalog. Without
// the licence, as a guest, or for an organization or a workspace the person does not read (`?org=`, `?scope=`), the
// address answers "not found" (the app's not-found page): nothing tells a person without the licence that InfoCatalog
// exists. Every address under it that no route has is not found as well. The search's state is in the address (C7), so
// a reload shows the same search: the page renders its first answer on the server, the browser asks again as the person
// types (`catalogSearchAction`). An item's own address (`item=`, step 6) opens its drawer; the browser reads another item
// with `catalogItemAction`.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CatalogHome, catalogOrganization, catalogReadableFor } from "@/compose/catalog-pages";
import { catalogItemView, catalogSearchView, stateOf } from "@/compose/catalog";
import { getDataStore, isPostgresMode } from "@/data";
import { LAST_WORKSPACE_COOKIE } from "../_lib/preferences";
import { getSession } from "../_lib/session";
import { catalogItemAction, catalogSearchAction } from "./actions";

type Params = Record<string, string | string[] | undefined>;

export default async function Catalog({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const { user } = session;
  const readable = await catalogReadableFor(user.id, session.unlocked);
  if (!readable.length) notFound();
  const params = await searchParams;
  const asked = params.org;
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  const lastWorkspace = last ? (await getDataStore().workspaces.listForUser(user.id)).find((w) => w.id === last) : undefined;
  const organization = catalogOrganization(readable, typeof asked === "string" ? asked : asked ? "" : null, lastWorkspace);
  if (!organization) notFound();
  const state = stateOf(params, organization.id);
  const view = await catalogSearchView(user.id, session.unlocked, readable, state);
  if (!view) notFound();
  // slice 39 (S39-04, C7): an item's own address opens its drawer; one the person may not read is not found
  const item = state.item ? await catalogItemView(user.id, session.unlocked, readable, organization.id, state.item) : null;
  if (state.item && !item) notFound();
  return (
    <CatalogHome
      user={{ name: user.display_name, email: user.email, online: isPostgresMode() }}
      organization={organization}
      organizations={readable.map((o) => ({ id: o.id, name: o.name }))}
      view={view}
      search={catalogSearchAction}
      item={item}
      openItem={catalogItemAction}
    />
  );
}
