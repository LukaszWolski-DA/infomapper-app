// Where to go after unlocking an organization (slice 8, item 4, F14): back to the page asked for, but only to a page of
// one of that organization's workspaces, so `next` can never send anyone to another site or another organization.

import { isUuid, type Uuid } from "./ids";

const ID = "[0-9a-f-]{36}";

/**
 * A workspace's pages: its home `/w/{id}`, a project's `/w/{id}/p/{id}` and a canvas's `/w/{id}/p/{id}/c/{id}`, with an
 * optional query of plain characters (the project home's `?map=`, `?row=`, `?system=`). No scheme, no host, no `//`,
 * no backslash, no dots, no encoded characters.
 */
const WORKSPACE_PAGE = new RegExp(`^/w/(${ID})(?:/p/(${ID})(?:/c/(${ID}))?)?(?:\\?[A-Za-z0-9_=&:-]*)?$`);

/**
 * Returns `next` when it is a page of one of the organization's workspaces, else null (the caller then lands as AD-07
 * says).
 */
export function safeReturnPath(next: string | null | undefined, organizationWorkspaceIds: ReadonlySet<Uuid>): string | null {
  if (!next || next.length > 300) return null;
  const match = WORKSPACE_PAGE.exec(next);
  if (!match) return null;
  const [, workspaceId, ...rest] = match;
  if (!isUuid(workspaceId!) || rest.some((id) => id !== undefined && !isUuid(id))) return null;
  return organizationWorkspaceIds.has(workspaceId!) ? next : null;
}
