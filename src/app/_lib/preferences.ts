// Per-browser navigation preferences (data model §12: not stored on the server): the last used workspace
// (landing after sign-in, AD-07) and the last used project per workspace. Kept in cookies so the server can
// read them while rendering; the proxy writes them as you navigate.

import { isUuid, type Uuid } from "@/domain/ids";

export const LAST_WORKSPACE_COOKIE = "infomapper_last_workspace";
export const LAST_PROJECTS_COOKIE = "infomapper_last_projects";
const MAX_REMEMBERED_PROJECTS = 30;

export const preferenceCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** workspace id -> last project id, from the cookie value. Anything malformed is ignored. */
export function parseLastProjects(value: string | undefined): Record<Uuid, Uuid> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([k, v]) => isUuid(k) && isUuid(v))) as Record<Uuid, Uuid>;
  } catch {
    return {};
  }
}

export function rememberProject(value: string | undefined, workspaceId: Uuid, projectId: Uuid): string {
  const entries = Object.entries(parseLastProjects(value)).filter(([k]) => k !== workspaceId);
  entries.push([workspaceId, projectId]);
  return JSON.stringify(Object.fromEntries(entries.slice(-MAX_REMEMBERED_PROJECTS)));
}

/** The workspace and project ids in an app path like /w/{ws}/p/{project}/c/{canvas}. */
export function idsFromPath(pathname: string): { workspaceId: Uuid | null; projectId: Uuid | null } {
  const m = /^\/w\/([^/]+)(?:\/p\/([^/]+))?/.exec(pathname);
  const workspaceId = m?.[1] && isUuid(m[1]) ? m[1] : null;
  const projectId = workspaceId && m?.[2] && isUuid(m[2]) ? m[2] : null;
  return { workspaceId, projectId };
}
