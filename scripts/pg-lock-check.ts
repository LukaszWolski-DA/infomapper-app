// npx tsx scripts/pg-lock-check.ts (slice 30, step 4): the writes' lock and a count rule through the database
// `.env.postgres.local` names (environment 2: infomapper-dev through Supabase's transaction pooler), by the app's own
// write path (the domain's commands and the Postgres adapter's `apply`), in a workspace of its own made for the check in
// the demo's organization InfoMate. It reads and writes nothing of any other workspace or organization (since slice 31
// infomapper-dev may hold a copy of Łukasz's own model) and never resets anything. It prints timings and answers only,
// never a value of the environment.
//
// 1. One write (a project's rename): its transaction takes `for no key update` on the workspace's row and sets
//    `set local lock_timeout`; it is stored.
// 2. Another session holds the workspace's row (`for no key update`) for 2 s: the write waits, then is stored.
// 3. It holds it past the lock timeout (18 s against 15 s since slice 31): the write is refused as busy, after the
//    timeout, and writes nothing.
// 4. Two sessions delete the workspace's last two projects at once: one is stored, the other refused with the last
//    project's message; one project stays.
// 5. The workspace is soft-deleted at the end (`deleted_at`; it stays in the table, hidden everywhere), unless --keep.
import { Client } from "pg";
import { STORE_SCHEMA } from "../src/compose/tables";
import { pgClientConfig } from "../src/data/postgres/config";
import { getPool } from "../src/data/postgres/pool";
import { createPostgresDataStore } from "../src/data/postgres/store";
import { LOCK_TIMEOUT } from "../src/data/postgres/write";
import { buildWriteSet, nextVersion, type CommandContext, type Write } from "../src/domain/changes";
import { createProject } from "../src/domain/commands/project";
import { createWorkspace } from "../src/domain/commands/workspace";
import { uuidv7 } from "../src/domain/ids";
import { loadPgEnv, required, targetName } from "./lib/pg-env";

const NAME = "Slice 30 lock check";

async function main() {
  loadPgEnv();
  const url = required("INFOMAPPER_DATABASE_URL");
  console.log(`On ${targetName(url)}, lock timeout ${LOCK_TIMEOUT}.`);
  const store = createPostgresDataStore(STORE_SCHEMA);
  const ctx = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });
  const lukasz = await store.users.getByEmail("lukasz@infomate.pl");
  if (!lukasz) throw new Error("The demo's Łukasz is not in this database.");
  const infomate = (await store.organizations.listForUser(lukasz.id)).find((o) => o.name === "InfoMate");
  if (!infomate) throw new Error("The demo's InfoMate is not in this database.");

  // the check's own workspace, with a second project
  const made = createWorkspace(ctx(lukasz.id), { organization: infomate, organizationMember: await store.organizations.getMember(infomate.id, lukasz.id) }, { organizationId: infomate.id, name: NAME });
  if (!made.ok) throw new Error(made.error.message);
  console.log("create the workspace:", await store.apply(made.writeSet));
  const ws = made.value.workspaceId;
  const access = async () => ({ workspace: (await store.workspaces.get(ws))!, member: await store.workspaces.getMember(ws, lukasz.id) });
  const second = createProject(ctx(lukasz.id), await access(), { workspaceId: ws, name: "Second project" });
  if (!second.ok) throw new Error(second.error.message);
  console.log("add a project:", await store.apply(second.writeSet));

  const rename = async (to: string) => {
    const c = ctx(lukasz.id);
    const p = (await store.projects.list(ws))[0]!;
    return store.apply(buildWriteSet(c, ws, [{ kind: "update", table: "project", before: p, row: nextVersion(c, p, { name: to }) } as Write]));
  };
  const timed = async <T>(what: string, work: () => Promise<T>) => {
    const start = performance.now();
    const result = await work();
    console.log(`${what}: ${Math.round(performance.now() - start)} ms,`, JSON.stringify(result));
    return result;
  };

  // 1. one write
  await timed("1. one write (for no key update, set local lock_timeout)", () => rename("First project (checked)"));

  // 2 and 3: another session holds the workspace's row
  const holder = new Client(pgClientConfig(url));
  await holder.connect();
  const hold = async (ms: number) => {
    await holder.query("begin");
    await holder.query("select id from workspace where id = $1 for no key update", [ws]);
    setTimeout(() => void holder.query("commit"), ms);
  };
  await hold(2_000);
  await timed("2. a write while another session holds the row for 2 s", () => rename("First project (waited)"));
  await hold(18_000);
  await timed(`3. a write while another session holds the row for 18 s (past ${LOCK_TIMEOUT})`, () => rename("First project (busy)"));
  await new Promise((r) => setTimeout(r, 18_500));
  await holder.end();
  console.log("   the project's name after 3:", (await store.projects.list(ws))[0]!.name);

  // 4. the last two projects deleted at once
  const [p1, p2] = await store.projects.list(ws);
  const c = ctx(lukasz.id);
  const del = (p: typeof p1) => buildWriteSet(c, ws, [{ kind: "update", table: "project", before: p!, row: nextVersion(c, p!, { deleted_at: c.now }) } as Write]);
  await timed("4. two sessions delete the last two projects at once", () => Promise.all([store.apply(del(p1)), store.apply(del(p2))]));
  console.log("   live projects after 4:", (await store.projects.list(ws)).length);

  // 5. the workspace soft-deleted
  if (!process.argv.includes("--keep")) {
    const w = (await store.workspaces.get(ws))!;
    const e = ctx(lukasz.id);
    console.log("5. soft-delete the check's workspace:", await store.apply(buildWriteSet(e, ws, [{ kind: "update", table: "workspace", before: w, row: nextVersion(e, w, { deleted_at: e.now }) } as Write])));
  }
  await getPool().end();
}

main().catch((e) => {
  console.error(e instanceof Error ? `${e.name}: ${e.message}` : "failed");
  process.exit(1);
});
