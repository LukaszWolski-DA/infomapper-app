// Development sign-in (AD-29): the session is an http-only cookie naming a seeded or created user and the organizations
// unlocked in this session (slice 8, P4, F1). It is signed (HMAC-SHA256 with a server secret, compared in constant
// time), so editing it in the browser ends the session instead of changing who you are. It exists only in development
// and in the measurement-only build (AD-31); a normal production build refuses the cookie and hides /sign-in.

import { createHmac, timingSafeEqual } from "node:crypto";
import { isLocalModeAllowed } from "@/data/local/measure-mode";
import { isUuid, type Uuid } from "@/domain/ids";

export const DEV_SESSION_COOKIE = "infomapper_dev_session";

export const isDevSignInEnabled = (): boolean => isLocalModeAllowed();

/** Who is signed in and which organizations this session has unlocked with their password (P4). */
export interface DevSession {
  userId: Uuid;
  unlocked: Uuid[];
}

interface Payload {
  v: 1;
  u: Uuid;
  o: Uuid[];
  at: number;
}

const sign = (data: string, secret: Buffer) => createHmac("sha256", secret).update(data).digest();

/** The cookie's value: `base64url(payload).base64url(signature)`. */
export function encodeSession(session: DevSession, secret: Buffer, now: number = Date.now()): string {
  const payload: Payload = { v: 1, u: session.userId, o: [...new Set(session.unlocked)], at: now };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret).toString("base64url")}`;
}

/** The session in a cookie, or null when there is none, development sign-in is off, or the cookie was not signed here. */
export function decodeSession(value: string | undefined, secret: Buffer): DevSession | null {
  if (!isDevSignInEnabled() || !value) return null;
  const [data, signature, rest] = value.split(".");
  if (!data || !signature || rest !== undefined) return null;
  const given = Buffer.from(signature, "base64url");
  const expected = sign(data, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<Payload>;
  } catch {
    return null;
  }
  if (payload.v !== 1 || !isUuid(payload.u) || !Array.isArray(payload.o) || !payload.o.every((o) => isUuid(o))) return null;
  return { userId: payload.u, unlocked: payload.o };
}

export const devCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: false,
} as const;
