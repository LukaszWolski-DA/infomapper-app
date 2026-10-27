import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDataStore } from "@/data";
import { sessionSecret } from "@/data/local/session-secret";
import type { Uuid } from "@/domain/ids";
import type { AppUser } from "@/domain/types";
import { decodeSession, DEV_SESSION_COOKIE, devCookieOptions, encodeSession } from "./dev-session";

export interface Session {
  user: AppUser;
  /** The organizations this session has unlocked with their password (slice 8, P4). */
  unlocked: ReadonlySet<Uuid>;
}

/**
 * The signed-in person and the organizations unlocked in this session, or null. Refuses the development cookie in
 * production, an unsigned or edited cookie (F1) and ids of unknown users.
 */
export async function getSession(): Promise<Session | null> {
  const session = decodeSession((await cookies()).get(DEV_SESSION_COOKIE)?.value, sessionSecret());
  if (!session) return null;
  const user = await getDataStore().users.get(session.userId);
  return user ? { user, unlocked: new Set(session.unlocked) } : null;
}

/** The signed-in user, or null. */
export async function getSessionUser(): Promise<AppUser | null> {
  return (await getSession())?.user ?? null;
}

/** The signed-in user; without a valid session, redirects to /sign-in. */
export async function requireSessionUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Starts or replaces the session (a server action only: cookies cannot be written while a page renders). */
export async function writeSession(userId: Uuid, unlocked: Iterable<Uuid>): Promise<void> {
  (await cookies()).set(DEV_SESSION_COOKIE, encodeSession({ userId, unlocked: [...unlocked] }, sessionSecret()), devCookieOptions);
}
