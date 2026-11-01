// Runs before every page request:
// - the measurement-only production build (AD-31) answers this machine only;
// - optimistic session check: without a session cookie, every page except /sign-in redirects there
//   (the real check, user exists and development only, runs on the server in getSession(): a signed cookie,
//   a known user, development only; slice 8);
// - remembers the last used workspace and project per workspace (AD-07) in preference cookies: on page loads only,
//   and only when the value changes. A cookie written during a server action makes Next.js refresh the page
//   (x-action-revalidated), so writing them on every request refreshed every page after every action, even a
//   refused one (this made S0-08 flaky).
// - a canvas thumbnail's drawing (slice 12b, PRD P5) is not a page: without a session cookie it answers 401 instead of
//   the redirect (an image cannot follow it), and it remembers nothing, so its cached answer carries no cookie.

import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE } from "@/app/_lib/dev-session";
import { isLocalHost, isMeasurementBuild } from "@/data/local/measure-mode";
import {
  idsFromPath,
  LAST_PROJECTS_COOKIE,
  LAST_WORKSPACE_COOKIE,
  preferenceCookieOptions,
  rememberProject,
} from "@/app/_lib/preferences";

/** A thumbnail's drawing (`/w/{workspaceId}/thumbnail/{canvasId}`). */
const THUMBNAIL_PATH = /^\/w\/[^/]+\/thumbnail\/[^/]+$/;

export function proxy(request: NextRequest) {
  if (isMeasurementBuild() && !isLocalHost(request.headers.get("host"))) return new NextResponse("Not found", { status: 404 });
  const { pathname } = request.nextUrl;
  if (pathname === "/sign-in") return NextResponse.next();
  const thumbnail = THUMBNAIL_PATH.test(pathname);
  if (!request.cookies.has(DEV_SESSION_COOKIE)) return thumbnail ? new NextResponse(null, { status: 401 }) : NextResponse.redirect(new URL("/sign-in", request.url));

  const response = NextResponse.next();
  if (thumbnail || request.method !== "GET" || request.headers.has("next-action")) return response;
  const { workspaceId, projectId } = idsFromPath(pathname);
  if (workspaceId && request.cookies.get(LAST_WORKSPACE_COOKIE)?.value !== workspaceId) {
    response.cookies.set(LAST_WORKSPACE_COOKIE, workspaceId, preferenceCookieOptions);
  }
  if (workspaceId && projectId) {
    const before = request.cookies.get(LAST_PROJECTS_COOKIE)?.value;
    const value = rememberProject(before, workspaceId, projectId);
    if (value !== before) response.cookies.set(LAST_PROJECTS_COOKIE, value, preferenceCookieOptions);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
