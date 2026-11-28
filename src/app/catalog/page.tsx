// InfoCatalog's page (slice 39, S39-01, S39-03): only for a person who reads an organization's InfoCatalog. Without
// the licence, as a guest, or for an organization the person does not read (`?org=`), the address answers "not found"
// (the app's not-found page): nothing tells a person without the licence that InfoCatalog exists. Every address under it
// that no route has is not found as well.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CatalogHome, catalogOrganization, catalogReadableFor } from "@/compose/catalog-pages";
import { getDataStore, isPostgresMode } from "@/data";
import { LAST_WORKSPACE_COOKIE } from "../_lib/preferences";
import { getSession } from "../_lib/session";

export default async function Catalog({ searchParams }: { searchParams: Promise<{ org?: string | string[] }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const { user } = session;
  const readable = await catalogReadableFor(user.id, session.unlocked);
  if (!readable.length) notFound();
  const asked = (await searchParams).org;
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  const lastWorkspace = last ? (await getDataStore().workspaces.listForUser(user.id)).find((w) => w.id === last) : undefined;
  const organization = catalogOrganization(readable, typeof asked === "string" ? asked : asked ? "" : null, lastWorkspace);
  if (!organization) notFound();
  return <CatalogHome user={{ name: user.display_name, email: user.email, online: isPostgresMode() }} organization={organization} />;
}
