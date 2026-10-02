// Optimistic check before rendering: without a session cookie, every page except /sign-in redirects there.
// The real check (user exists, development only) runs on the server in requireSessionUser().

import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE } from "@/app/_lib/dev-session";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/sign-in") return NextResponse.next();
  if (request.cookies.has(DEV_SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
