// Runs before every page request:
// - optimistic session check: without a session cookie, every page except /sign-in redirects there
//   (the real check, user exists and development only, runs on the server in requireSessionUser());
// - remembers the last used workspace and project per workspace (AD-07) in preference cookies.

import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE } from "@/app/_lib/dev-session";
import {
  idsFromPath,
  LAST_PROJECTS_COOKIE,
  LAST_WORKSPACE_COOKIE,
  preferenceCookieOptions,
  rememberProject,
} from "@/app/_lib/preferences";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/sign-in") return NextResponse.next();
  if (!request.cookies.has(DEV_SESSION_COOKIE)) return NextResponse.redirect(new URL("/sign-in", request.url));

  const response = NextResponse.next();
  const { workspaceId, projectId } = idsFromPath(pathname);
  if (workspaceId) response.cookies.set(LAST_WORKSPACE_COOKIE, workspaceId, preferenceCookieOptions);
  if (workspaceId && projectId) {
    const value = rememberProject(request.cookies.get(LAST_PROJECTS_COOKIE)?.value, workspaceId, projectId);
    response.cookies.set(LAST_PROJECTS_COOKIE, value, preferenceCookieOptions);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
