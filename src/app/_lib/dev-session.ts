// Development sign-in (AD-29): the session is an http-only cookie holding the user id of a seeded user.
// It exists only in development; a production build refuses the cookie and hides /sign-in.

import { isUuid, type Uuid } from "@/domain/ids";

export const DEV_SESSION_COOKIE = "infomapper_dev_session";

export const isDevSignInEnabled = (): boolean => process.env.NODE_ENV !== "production";

/** The user id in a development session cookie, or null when there is none or development sign-in is off. */
export function userIdFromDevCookie(value: string | undefined): Uuid | null {
  if (!isDevSignInEnabled()) return null;
  return isUuid(value) ? value : null;
}

export const devCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: false,
} as const;
