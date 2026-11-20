import "server-only";
// Supabase Auth's admin calls (slice 33, Q3, F1): the only place in `src/` that reads SUPABASE_SECRET_KEY. Server only
// (`server-only` fails a build that would bring it to the browser; CI also scans the built client files for the key,
// `scripts/check-client-bundle.ts`). Never logs the key, an e-mail, a password or an account's id: a failure is logged
// by its error code only. On the local adapter nothing here is called (no accounts).

import { createClient } from "@supabase/supabase-js";
import { isPostgresMode } from "@/data/mode";
import { supabaseConfig } from "./supabase-config";

/** D10: what "Invite person", the reset link and "Change password…" say on a server without the secret key. */
export const NOT_SET_UP = "This server is not set up for invitations yet.";
export const NOT_SET_UP_REFUSAL = "This server is not set up for invitations yet, so nothing was created.";

/** Whether invitations and passwords work here: always locally; on Postgres only with the secret key. */
export function invitationsReady(): boolean {
  return !isPostgresMode() || !!process.env.SUPABASE_SECRET_KEY?.trim();
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient(supabaseConfig().url, key, options).auth.admin;
}

const logFailure = (what: string, code: string | undefined) => console.error(`Auth: ${what} failed (${code ?? "no code"}).`);

export type AccountResult = { ok: true; id: string } | { ok: false; reason: "exists" | "weak" | "failed" };

/** A confirmed account (no e-mail sent), marked with what made it (`app_metadata`, F10: a later Join may reuse it). */
export async function createAccount(email: string, password: string, madeBy: { invitation: string } | { reset: string }): Promise<AccountResult> {
  const { data, error } = await admin().createUser({ email, password, email_confirm: true, app_metadata: madeBy });
  if (!error && data.user) return { ok: true, id: data.user.id };
  if (error?.code === "email_exists" || error?.code === "user_already_exists") return { ok: false, reason: "exists" };
  if (error?.code === "weak_password") return { ok: false, reason: "weak" };
  logFailure("creating an account", error?.code);
  return { ok: false, reason: "failed" };
}

/** Removes an account this server made a moment ago (a Join or a reset whose rows were then refused, Q6). */
export async function deleteAccount(id: string): Promise<boolean> {
  const { error } = await admin().deleteUser(id);
  if (error) logFailure("removing an account", error.code);
  return !error;
}

/** Sets an account's password. */
export async function setAccountPassword(id: string, password: string): Promise<{ ok: true } | { ok: false; reason: "weak" | "failed" }> {
  const { error } = await admin().updateUserById(id, { password });
  if (!error) return { ok: true };
  if (error.code === "weak_password") return { ok: false, reason: "weak" };
  logFailure("setting a password", error.code);
  return { ok: false, reason: "failed" };
}

/**
 * An account with this e-mail that an earlier Join of the same invitation (or use of the same reset link) made and could
 * not remove again (F10), or null. Paged through the accounts; in development they are few.
 */
export async function accountMadeBy(email: string, madeBy: { invitation: string } | { reset: string }): Promise<string | null> {
  const [key, value] = Object.entries(madeBy)[0]!;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin().listUsers({ page, perPage: 1000 });
    if (error) {
      logFailure("listing accounts", error.code);
      return null;
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return (found.app_metadata as Record<string, unknown> | undefined)?.[key] === value ? found.id : null;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Whether the password signs in to the account with this e-mail (Q7): on a client of its own, without cookies, whose
 * session is ended at once (its own only), so the person's session is never touched. The account's id, or null.
 */
export async function passwordSignsIn(email: string, password: string): Promise<string | null> {
  const { url, publishableKey } = supabaseConfig();
  const client = createClient(url, publishableKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  await client.auth.signOut({ scope: "local" });
  return data.user.id;
}
