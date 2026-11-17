import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDataStore, isPostgresMode } from "@/data";
import { sessionSecret } from "@/data/local/session-secret";
import type { Uuid } from "@/domain/ids";
import type { AppUser } from "@/domain/types";
import { decodeSession, DEV_SESSION_COOKIE, devCookieOptions, encodeSession } from "./dev-session";
import { supabaseServer } from "./supabase";

export interface Session {
  user: AppUser;
  /**
   * The organizations this session has unlocked with their password (slice 8, P4). On Postgres every organization the
   * person belongs to (slice 29, DB5): Supabase Auth signs the person in, and no organization password exists there.
   */
  unlocked: ReadonlySet<Uuid>;
}

/**
 * The signed-in person and the organizations unlocked in this session, or null. Refuses the development cookie in
 * production, an unsigned or edited cookie (F1) and ids of unknown users. On Postgres (slice 29, DB5): the Supabase
 * session, never the development cookie.
 */
export async function getSession(): Promise<Session | null> {
  if (isPostgresMode()) return postgresSession();
  const session = decodeSession((await cookies()).get(DEV_SESSION_COOKIE)?.value, sessionSecret());
  if (!session) return null;
  const user = await getDataStore().users.get(session.userId);
  return user ? { user, unlocked: new Set(session.unlocked) } : null;
}

/**
 * The Supabase session (slice 29, step 3): `getClaims()` checks the access token locally against the project's JWKS
 * (ES256, L2); its `sub` names the Auth account, and `app_user.auth_user_id` the person. An account linked to nobody is
 * no session. Once per request (React's `cache`).
 */
const postgresSession = cache(async (): Promise<Session | null> => {
  const { data, error } = await (await supabaseServer()).auth.getClaims();
  const authUserId = data?.claims.sub;
  if (error || !authUserId) return null;
  const store = getDataStore();
  const user = await store.users.getByAuthUserId(authUserId);
  if (!user) return null;
  const organizations = await store.organizations.listForUser(user.id);
  return { user, unlocked: new Set(organizations.map((o) => o.id)) };
});

/** The signed-in user, or null. */
export async function getSessionUser(): Promise<AppUser | null> {
  return (await getSession())?.user ?? null;
}

/** Starts or replaces the session (a server action only: cookies cannot be written while a page renders). */
export async function writeSession(userId: Uuid, unlocked: Iterable<Uuid>): Promise<void> {
  if (isPostgresMode()) throw new Error("The development session is the local adapter's (slice 29, DB5).");
  (await cookies()).set(DEV_SESSION_COOKIE, encodeSession({ userId, unlocked: [...unlocked] }, sessionSecret()), devCookieOptions);
}
