"use server";

// The two link pages' actions (slice 33, PT3, PT5, Q6): Join an invitation, set a password with a reset link. Public:
// the link's token is the only key, so they run without a session (`runCommandAs`, the actor being the person who joins
// or sets their password). Every answer that refuses says nothing changed, and nothing did:
// - Postgres: the Auth account is made first (marked with the invitation, F10), then the rows in one write; when the write
//   is refused the account is removed again; then the person is signed in through Supabase's cookies, as the sign-in
//   action does (AD-04's note: these actions write the session's cookies too).
// - Locally (D3): no Auth; the person is signed in with the development session, only the invitation's organization
//   unlocked (D-58: a person's other organizations stay locked).
// After any refused Join the invitation is read again: when it no longer works, the answer is the one message (F26:
// a second Join of the same link is refused by the adapter as a conflict or a stale row, by adapter).

import { getDataStore, isPostgresMode } from "@/data";
import { STORE_SCHEMA } from "@/compose/tables";
import {
  acceptInvitation,
  checkPersonPassword,
  INVITATION_GONE,
  invitationPage,
  redeemPasswordReset,
  RESET_GONE,
  resetPage,
} from "@/domain/commands/invitations";
import { uuidv7 } from "@/domain/ids";
import { ACCOUNT_SIGN_IN_REFUSED } from "../_lib/account-texts";
import { hashOfToken } from "../_lib/link-tokens";
import { workspaceHref } from "../_lib/paths";
import { ACCOUNT_IN_THE_WAY, ENTER_PASSWORD, NOTHING_CHANGED, PASSWORD_REFUSED_BY_SERVER } from "../_lib/password-texts";
import { acceptStateFor, resetStateFor } from "../_lib/people-links";
import { runCommandAs, type ActionResult } from "../_lib/run-command";
import { getSession, writeSession } from "../_lib/session";
import { supabaseServer } from "../_lib/supabase";
import { accountMadeBy, createAccount, deleteAccount, invitationsReady, NOT_SET_UP, setAccountPassword } from "../_lib/supabase-admin";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const GONE = { ok: false as const, code: "not_found" as const, message: INVITATION_GONE };
const RESET_IS_GONE = { ok: false as const, code: "not_found" as const, message: RESET_GONE };
const now = () => new Date().toISOString();

export interface JoinInput {
  token: string;
  /** A new person's name. */
  name?: string;
  /** Online: the new password (twice) for a new account, or the existing account's password. */
  password?: string;
  passwordAgain?: string;
}

/** Join (PT3): the person, their memberships and the invitation accepted; then signed in, landing on the workspace. */
export async function joinAction(input: JoinInput): Promise<ActionResult<{ href: string }>> {
  const tokenHash = hashOfToken(input?.token);
  if (!tokenHash) return GONE;
  const store = getDataStore(STORE_SCHEMA);
  const online = isPostgresMode();
  const state = await acceptStateFor(store, tokenHash);
  const page = invitationPage(state, tokenHash, now(), online);
  if (page.kind === "gone") return GONE;
  if (page.kind === "archived") return { ok: false, code: "archived", message: `${page.workspace} is archived, so nobody can join it now. Nothing was changed.` };
  const name = str(input?.name);
  const password = str(input?.password);
  const invitation = state.invitation!;
  // what the answer says when the write was refused: the link no longer working, or the command's own message
  const refusedJoin = async (r: { code: string; message: string; fields?: Record<string, string> }): Promise<ActionResult<{ href: string }>> => {
    const again = invitationPage(await acceptStateFor(store, tokenHash), tokenHash, now(), online);
    if (again.kind === "gone") return GONE;
    return { ok: false, code: r.code as never, message: r.message, ...(r.fields ? { fields: r.fields } : {}) };
  };

  if (!online) {
    // D3: locally no password; the person is signed in with only this organization unlocked
    const actorId = state.account?.id ?? uuidv7();
    const r = await runCommandAs(actorId, async (ctx) => acceptInvitation(ctx, await acceptStateFor(store, tokenHash), { tokenHash, ...(state.account ? {} : { name }), authUserId: null }));
    if (!r.ok) return refusedJoin(r);
    const current = await getSession();
    await writeSession(r.value.userId, current?.user.id === r.value.userId ? [...current.unlocked, r.value.organizationId] : [r.value.organizationId]);
    return { ok: true, value: { href: workspaceHref(r.value.workspaceId) } };
  }

  if (!invitationsReady()) return { ok: false, code: "forbidden", message: NOT_SET_UP };

  if (page.kind === "existing") {
    // "Sign in and join": the account's password first; a wrong one changes nothing
    if (!password) return { ok: false, code: "invalid", message: ENTER_PASSWORD, fields: { password: ENTER_PASSWORD } };
    const supabase = await supabaseServer({ write: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email: invitation.email, password });
    if (error || !data.user) return { ok: false, code: "forbidden", message: ACCOUNT_SIGN_IN_REFUSED, fields: { password: ACCOUNT_SIGN_IN_REFUSED } };
    const account = state.account!;
    const r = await runCommandAs(account.id, async (ctx) => acceptInvitation(ctx, await acceptStateFor(store, tokenHash), { tokenHash, authUserId: data.user.id }));
    if (!r.ok) {
      await supabase.auth.signOut({ scope: "local" });
      return refusedJoin(r);
    }
    return { ok: true, value: { href: workspaceHref(r.value.workspaceId) } };
  }

  // a new person ("new"), or a person without an Auth account ("account", D5): the account first
  if (page.kind === "new" && !name.trim()) return { ok: false, code: "invalid", message: "Enter your name.", fields: { name: "Enter your name." } };
  const weak = checkPersonPassword(password, str(input?.passwordAgain));
  if (weak) return { ok: false, code: "invalid", message: weak.message, ...(weak.fields ? { fields: weak.fields } : {}) };
  const madeBy = { invitation: invitation.id };
  let authId: string;
  let madeNow = false;
  const made = await createAccount(invitation.email, password, madeBy);
  if (made.ok) {
    authId = made.id;
    madeNow = true;
  } else if (made.reason === "exists") {
    // F10: an account an earlier Join of this invitation made and could not remove; anything else is in the way
    const earlier = await accountMadeBy(invitation.email, madeBy);
    if (!earlier) return { ok: false, code: "conflict", message: ACCOUNT_IN_THE_WAY };
    const set = await setAccountPassword(earlier, password);
    if (!set.ok) return set.reason === "weak" ? { ok: false, code: "invalid", message: PASSWORD_REFUSED_BY_SERVER, fields: { password: PASSWORD_REFUSED_BY_SERVER } } : { ok: false, code: "unexpected", message: NOTHING_CHANGED };
    authId = earlier;
  } else if (made.reason === "weak") {
    return { ok: false, code: "invalid", message: PASSWORD_REFUSED_BY_SERVER, fields: { password: PASSWORD_REFUSED_BY_SERVER } };
  } else return { ok: false, code: "unexpected", message: NOTHING_CHANGED };

  const actorId = state.account?.id ?? uuidv7();
  const r = await runCommandAs(actorId, async (ctx) =>
    acceptInvitation(ctx, await acceptStateFor(store, tokenHash), { tokenHash, ...(state.account ? {} : { name }), authUserId: authId }),
  );
  if (!r.ok) {
    if (madeNow) await deleteAccount(authId);
    return refusedJoin(r);
  }
  const { error } = await (await supabaseServer({ write: true })).auth.signInWithPassword({ email: invitation.email, password });
  // the person joined; should the sign-in fail, the start page takes the same password
  if (error) return { ok: true, value: { href: "/sign-in" } };
  return { ok: true, value: { href: workspaceHref(r.value.workspaceId) } };
}

/**
 * "Set password" (PT5): the new password, the link used, the person signed in; their other sessions end (D4, within an
 * hour: the proxy checks access tokens on its own). The password is set before the link is marked used: a link revoked
 * in the moment between (or used twice at once) still leaves the password set (a known limitation).
 */
export async function setPasswordAction(input: { token: string; password: string; passwordAgain: string }): Promise<ActionResult<{ href: string }>> {
  if (!isPostgresMode()) return RESET_IS_GONE;
  if (!invitationsReady()) return { ok: false, code: "forbidden", message: NOT_SET_UP };
  const tokenHash = hashOfToken(input?.token);
  if (!tokenHash) return RESET_IS_GONE;
  const store = getDataStore(STORE_SCHEMA);
  const state = await resetStateFor(store, tokenHash);
  const page = resetPage(state, tokenHash, now());
  if (page.kind === "gone") return RESET_IS_GONE;
  const password = str(input?.password);
  const weak = checkPersonPassword(password, str(input?.passwordAgain));
  if (weak) return { ok: false, code: "invalid", message: weak.message, ...(weak.fields ? { fields: weak.fields } : {}) };
  const person = state.person!;

  // the person's account: the linked one, or one made now (D5)
  const linked = await store.users.getAuthUserId(person.id);
  let authId: string;
  let madeNow = false;
  if (linked) {
    const set = await setAccountPassword(linked, password);
    if (!set.ok) return set.reason === "weak" ? { ok: false, code: "invalid", message: PASSWORD_REFUSED_BY_SERVER, fields: { password: PASSWORD_REFUSED_BY_SERVER } } : { ok: false, code: "unexpected", message: NOTHING_CHANGED };
    authId = linked;
  } else {
    const made = await createAccount(person.email, password, { reset: state.reset!.id });
    if (!made.ok) return made.reason === "weak" ? { ok: false, code: "invalid", message: PASSWORD_REFUSED_BY_SERVER, fields: { password: PASSWORD_REFUSED_BY_SERVER } } : made.reason === "exists" ? { ok: false, code: "conflict", message: ACCOUNT_IN_THE_WAY } : { ok: false, code: "unexpected", message: NOTHING_CHANGED };
    authId = made.id;
    madeNow = true;
  }
  const r = await runCommandAs(person.id, async (ctx) => redeemPasswordReset(ctx, await resetStateFor(store, tokenHash), { tokenHash, authUserId: madeNow ? authId : null }));
  if (!r.ok) {
    if (madeNow) await deleteAccount(authId);
    return resetPage(await resetStateFor(store, tokenHash), tokenHash, now()).kind === "gone" ? RESET_IS_GONE : { ok: false, code: r.code as never, message: r.message };
  }
  const supabase = await supabaseServer({ write: true });
  const { error } = await supabase.auth.signInWithPassword({ email: person.email, password });
  if (error) return { ok: true, value: { href: "/sign-in" } };
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, value: { href: "/" } };
}

