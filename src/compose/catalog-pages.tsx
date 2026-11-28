// InfoCatalog's pages from the composition root (slice 39, S39-01): the landing zone at `/` and the catalog's page at
// `/catalog`, rendered by `src/app` through here, as InfoDocumenter's are (`documents-pages.tsx`). What the person reads
// comes from the catalog index (`store.catalog`, the rights inside it), never from a filter of its own.

import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { CatalogOrganization } from "@/domain/permissions";
import type { Workspace } from "@/domain/types";
import { CatalogLanding, type LandingProps } from "@/modules/infocatalog/app/landing";
import { CatalogPage, type CatalogPageProps } from "@/modules/infocatalog/app/catalog-page";
import { CATALOG_TABLES, catalogItemCount } from "./catalog";
export { catalogReadableFor } from "./catalog";
import { STORE_SCHEMA } from "./tables";

type PlatformUser = LandingProps["user"];

/** The catalog an address opens: the organization asked for when the person reads it, else the default one. */
export function catalogOrganization(readable: readonly CatalogOrganization[], asked: string | null | undefined, lastWorkspace: Workspace | undefined): CatalogOrganization | null {
  if (asked) return readable.find((o) => o.id === asked) ?? null;
  // S39-01: the last used workspace's organization when it holds the licence, else the first licensed one
  return readable.find((o) => o.id === lastWorkspace?.organization_id) ?? readable[0] ?? null;
}

export interface LandingInput {
  user: PlatformUser & { id: Uuid };
  unlocked: ReadonlySet<Uuid>;
  readable: readonly CatalogOrganization[];
  /** The workspaces the person has a role in, in unlocked organizations (InfoMapper's tile). */
  workspaces: readonly Workspace[];
  last: Workspace | undefined;
}

export async function LandingPage({ user, unlocked, readable, workspaces, last }: LandingInput) {
  const organization = catalogOrganization(readable, null, last)!;
  const read = organization.workspaces.length ? await getDataStore(STORE_SCHEMA).catalog.read(user.id, unlocked, { organizationId: organization.id, workspaceId: null }, CATALOG_TABLES) : null;
  return (
    <CatalogLanding
      user={user}
      firstName={user.name.trim().split(/\s+/)[0] ?? user.name}
      mapper={{ workspaces: workspaces.length, last: last?.name ?? workspaces[0]?.name ?? null }}
      catalog={{ organization: organization.name, organizationId: organization.id, items: catalogItemCount(read), workspaces: organization.workspaces.length }}
    />
  );
}

export function CatalogHome(props: Omit<CatalogPageProps, "organization"> & { organization: CatalogOrganization }) {
  return <CatalogPage {...props} organization={props.organization} />;
}
