// npx tsx scripts/pg-auth-check.ts (slice 29, step 3): what the accounts script and the sign-in rely on, checked on
// infomapper-dev before anything uses it. Prints statuses only, never a key, a password or an address of a person.
//   1. The Data API is off (its REST endpoint does not answer data) and Auth answers: its settings, sign-ups off.
//   2. With the secret key, auth.admin.createUser makes a confirmed throwaway account although sign-ups are off.
//   3. That account signs in with the publishable key (Auth works with the Data API off), and getClaims checks its token.
//   4. A public sign-up is refused as sign-ups are off (`signup_disabled`).
//   5. The throwaway account is deleted again.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadPgEnv, required } from "./lib/pg-env";

async function main(): Promise<number> {
  loadPgEnv();
  const url = required("SUPABASE_URL");
  const publishable = required("SUPABASE_PUBLISHABLE_KEY");
  const secret = required("SUPABASE_SECRET_KEY");
  const host = new URL(url).hostname;
  console.log(`Project: ${host}`);
  let ok = true;
  const check = (name: string, pass: boolean, detail = "") => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `: ${detail}` : ""}`);
    ok &&= pass;
  };

  const rest = await fetch(`${url}/rest/v1/app_user?select=id&limit=1`, { headers: { apikey: publishable } });
  check("the Data API gives no data", !rest.ok, `HTTP ${rest.status}`);

  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishable } });
  const s = (settings.ok ? await settings.json() : {}) as { disable_signup?: boolean; external?: { email?: boolean } };
  check("Auth answers its settings", settings.ok, `HTTP ${settings.status}`);
  check("sign-ups are off", s.disable_signup === true, `disable_signup = ${String(s.disable_signup)}`);
  check("e-mail and password sign-in is on", s.external?.email === true);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `slice29-check-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  check("admin.createUser with the secret key while sign-ups are off", !created.error && !!created.data.user, created.error ? `${created.error.status ?? ""} ${created.error.code ?? created.error.message}` : "");
  const userId = created.data.user?.id;

  try {
    if (userId) {
      const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await client.auth.signInWithPassword({ email, password });
      check("signInWithPassword with the publishable key", !signedIn.error && !!signedIn.data.session, signedIn.error?.code ?? "");
      const claims = await client.auth.getClaims();
      check("getClaims checks the session's token", !claims.error && claims.data?.claims.sub === userId, claims.error?.message ?? `alg ${String(claims.data?.header?.alg)}`);
      const wrong = await client.auth.signInWithPassword({ email, password: `${password}x` });
      check("a wrong password is refused", !!wrong.error, wrong.error?.code ?? "accepted!");
    }
    const anon = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const signUp = await anon.auth.signUp({ email: `slice29-signup-${randomBytes(6).toString("hex")}@example.com`, password: randomBytes(24).toString("base64url") });
    // only `signup_disabled` counts: Supabase also refuses example.com addresses (`email_address_invalid`), which says
    // nothing about sign-ups
    check("a public sign-up is refused because sign-ups are off", signUp.error?.code === "signup_disabled", signUp.error?.code ?? "accepted!");
  } finally {
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      check("the throwaway account is deleted", !removed.error, removed.error?.message ?? "");
    }
  }
  return ok ? 0 : 1;
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
