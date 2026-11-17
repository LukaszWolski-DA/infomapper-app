// npm run pg:accounts (slice 29, step 3, DB10): a Supabase Auth account for each person in the Postgres database, with the
// password INFOMAPPER_DEMO_PASSWORD (development only), linked through `app_user.auth_user_id` (L3). Sign-ups stay off:
// the accounts are made with the secret key (`auth.admin.createUser`, confirmed, no e-mail sent). An account that exists
// already keeps its id and gets the password again. Run after `npm run pg:seed` (a reset empties `app_user`, so its links
// go too).
//
// The values come from the environment or `.env.postgres.local` (git-ignored, L4): SUPABASE_URL, SUPABASE_SECRET_KEY,
// INFOMAPPER_DEMO_PASSWORD, INFOMAPPER_MIGRATION_URL. It prints each person's e-mail address and the workspaces they see,
// for checking by hand; never a password or a key. The link is written straight into `app_user` (a script's write, not a
// command's: the app's writes are refused until slice B).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { pgClientConfig } from "../src/data/postgres/config";
import { loadPgEnv, required, targetName } from "./lib/pg-env";

async function main(): Promise<number> {
  if (fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = required("SUPABASE_URL");
  const secret = required("SUPABASE_SECRET_KEY");
  const password = required("INFOMAPPER_DEMO_PASSWORD");
  const dbUrl = required("INFOMAPPER_MIGRATION_URL");
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client(pgClientConfig(dbUrl));
  await db.connect();
  console.log(`Auth: ${new URL(url).hostname}; database: ${targetName(dbUrl)}`);
  try {
    const people = (await db.query<{ id: string; email: string; display_name: string }>("select id, email, display_name from app_user order by created_at, id")).rows;
    // every existing account by e-mail address (a few, in development)
    const existing = new Map<string, string>();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`Listing the accounts failed: ${error.code ?? error.message}`);
      for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
      if (data.users.length < 1000) break;
    }
    let created = 0;
    let updated = 0;
    for (const person of people) {
      let authId = existing.get(person.email);
      if (authId) {
        const { error } = await admin.auth.admin.updateUserById(authId, { password, email_confirm: true });
        if (error) throw new Error(`Setting the password of ${person.email} failed: ${error.code ?? error.message}`);
        updated++;
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email: person.email, password, email_confirm: true });
        if (error || !data.user) throw new Error(`Creating the account of ${person.email} failed: ${error?.code ?? error?.message ?? "no user"}`);
        authId = data.user.id;
        created++;
      }
      await db.query("update app_user set auth_user_id = $1 where id = $2", [authId, person.id]);
    }
    console.log(`${people.length} people: ${created} accounts created, ${updated} given the password again; all linked.`);
    console.log("Sign-in e-mails and the workspaces each sees (organization / workspace, role):");
    for (const person of people) {
      const { rows } = await db.query<{ organization: string; workspace: string; role: string; archived: boolean }>(
        `select o.name as organization, w.name as workspace, m.role, w.archived_at is not null as archived
           from workspace_member m join workspace w on w.id = m.workspace_id join organization o on o.id = w.organization_id
          where m.user_id = $1 and w.deleted_at is null and o.deleted_at is null
          order by o.name, w.name`,
        [person.id],
      );
      console.log(`  ${person.email} (${person.display_name})`);
      for (const r of rows) console.log(`      ${r.organization} / ${r.workspace}, ${r.role}${r.archived ? ", archived" : ""}`);
      if (!rows.length) console.log("      (no workspace)");
    }
    return 0;
  } finally {
    await db.end();
  }
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
