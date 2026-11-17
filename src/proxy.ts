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
// - on Postgres (slice 29, step 3): the session is Supabase's. `getClaims()` checks it (locally, ES256) and refreshes an
//   expired one, writing its cookies on the response (`@supabase/ssr`), as Supabase's guide does; without a valid one a
//   page redirects to /sign-in. A thumbnail's path is never refreshed (F9, AD-32: its answer carries no `Set-Cookie`):
//   it only needs the cookie to be there, and its route checks the session itself. A refresh during a server action
//   (about once an hour) refreshes the page, as the preference cookies would.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE } from "@/app/_lib/dev-session";
import { isSupabaseAuthCookie, supabaseConfig } from "@/app/_lib/supabase-config";
import { isLocalHost, isMeasurementBuild } from "@/data/local/measure-mode";
import { isPostgresMode } from "@/data/mode";
import {
  idsFromPath,
  LAST_PROJECTS_COOKIE,
  LAST_WORKSPACE_COOKIE,
  preferenceCookieOptions,
  rememberProject,
} from "@/app/_lib/preferences";

/** A thumbnail's drawing (`/w/{workspaceId}/thumbnail/{canvasId}`). */
const THUMBNAIL_PATH = /^\/w\/[^/]+\/thumbnail\/[^/]+$/;

export async function proxy(request: NextRequest) {
  if (isMeasurementBuild() && !isLocalHost(request.headers.get("host"))) return new NextResponse("Not found", { status: 404 });
  const { pathname } = request.nextUrl;
  if (pathname === "/sign-in") return NextResponse.next();
  const thumbnail = THUMBNAIL_PATH.test(pathname);
  if (isPostgresMode()) return postgresProxy(request, thumbnail);
  if (!request.cookies.has(DEV_SESSION_COOKIE)) return thumbnail ? new NextResponse(null, { status: 401 }) : NextResponse.redirect(new URL("/sign-in", request.url));
  return withPreferences(request, NextResponse.next(), thumbnail);
}

/** On Postgres: Supabase's session, refreshed and checked here; the thumbnail's path untouched (F9). */
async function postgresProxy(request: NextRequest, thumbnail: boolean): Promise<NextResponse> {
  if (thumbnail) {
    return request.cookies.getAll().some((c) => isSupabaseAuthCookie(c.name)) ? NextResponse.next() : new NextResponse(null, { status: 401 });
  }
  const { url, publishableKey } = supabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const redirect = NextResponse.redirect(new URL("/sign-in", request.url));
    // the cookies Supabase cleared or replaced go with the redirect
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return withPreferences(request, response, false);
}

/** The preference cookies (AD-07), on page loads only and only when they change. */
function withPreferences(request: NextRequest, response: NextResponse, thumbnail: boolean): NextResponse {
  if (thumbnail || request.method !== "GET" || request.headers.has("next-action")) return response;
  const { workspaceId, projectId } = idsFromPath(request.nextUrl.pathname);
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
