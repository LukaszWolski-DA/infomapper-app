// Slice 31, steps 2 and 3: the pure pieces of the copy of Łukasz's model (the Postgres side is tests/contract/copy.test.ts). The file rule (T2,
// F9), the format refusals, the target's check (F10), one organization's rows (T1, Q6), the people `pg:accounts` handles
// (F3) and the reset's guard (Q8). Demo data only: never his model.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose/tables";
import { DEV_DB_FORMAT } from "@/data/local/schema";
import { backupPath, readBackupCopy, upgradedFrom } from "../scripts/lib/backup-file";
import { organizationNamed, organizationRows, type Tables } from "../scripts/lib/organization-rows";
import { devTargetRefusal } from "../scripts/lib/pg-env";
import { resetRefusal, seedOrganizationNames, seedPeople } from "../scripts/lib/seed-organizations";
import { seedRows } from "../scripts/lib/seed-rows";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function root(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-kb-copy-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".data", "backups", "pg"), { recursive: true });
  return dir;
}
// the backups folder under a test's own root, never the repository's
const BK = [".data", "backups"].join("/");
const seed = () => seedRows(new Date("2026-11-19T10:00:00.000Z")) as unknown as Tables;

describe("the file: only a copy of a file under the backups folder (T2, F9)", () => {
  it("takes a file under the backups folder and its folders", () => {
    const r = root();
    fs.writeFileSync(path.join(r, ".data", "backups", "dev-db-20261119-1736.json"), "{}");
    fs.writeFileSync(path.join(r, ".data", "backups", "pg", "kb-20261119-1800.json"), "{}");
    expect(backupPath(`${BK}/dev-db-20261119-1736.json`, r)).toBe(fs.realpathSync(path.join(r, ".data", "backups", "dev-db-20261119-1736.json")));
    expect(backupPath(`${BK}/pg/kb-20261119-1800.json`, r)).toContain("kb-20261119-1800.json");
  });

  it("refuses the local file itself, any file named dev-db.json, a path outside, a folder and no path", () => {
    const r = root();
    fs.writeFileSync(path.join(r, ".data", "dev-db.json"), "{}");
    fs.writeFileSync(path.join(r, ".data", "backups", "dev-db.json"), "{}");
    fs.writeFileSync(path.join(r, "elsewhere.json"), "{}");
    expect(() => backupPath(path.join(".data", "dev-db.json"), r)).toThrow("Never");
    expect(() => backupPath(`${BK}/dev-db.json`, r)).toThrow("Never");
    expect(() => backupPath(`${BK}/../dev-db.json`, r)).toThrow("Never");
    expect(() => backupPath("elsewhere.json", r)).toThrow("must lie under");
    expect(() => backupPath(`${BK}/../../elsewhere.json`, r)).toThrow("must lie under");
    expect(() => backupPath(`${BK}/pg`, r)).toThrow("not a file");
    expect(() => backupPath(undefined, r)).toThrow("Give a file under");
  });

  it("reads through a temporary copy and leaves the backup as it was", () => {
    const r = root();
    const file = path.join(r, ".data", "backups", "dev-db-20261119-1736.json");
    const text = JSON.stringify(seedRows());
    fs.writeFileSync(file, text);
    const { db, formatBefore, made } = readBackupCopy(`${BK}/dev-db-20261119-1736.json`, r);
    expect(formatBefore).toBe(DEV_DB_FORMAT);
    expect(made).toEqual({});
    expect(db.organization.length).toBeGreaterThan(0);
    expect(fs.readFileSync(file, "utf8")).toBe(text);
  });
});

describe("the format: upgraded in memory, a newer or unknown one refused (T2, Q3)", () => {
  it("upgrades format 16 to 17 in memory without new rows", () => {
    const db = seedRows() as unknown as Record<string, unknown> & { workspace: Record<string, unknown>[] };
    for (const w of db.workspace) delete w.infodoc;
    const { db: up, formatBefore, made } = upgradedFrom(JSON.stringify({ ...db, format: 16 }));
    expect(formatBefore).toBe(16);
    expect(up.format).toBe(DEV_DB_FORMAT);
    expect(up.workspace.every((w) => w.infodoc === false)).toBe(true);
    expect(made).toEqual({});
  });
  it("refuses a newer format, none, and anything that is not a format", () => {
    expect(() => upgradedFrom(JSON.stringify({ format: DEV_DB_FORMAT + 1 }))).toThrow(`newer than this branch's ${DEV_DB_FORMAT}`);
    expect(() => upgradedFrom(JSON.stringify({ organization: [] }))).toThrow("Not a local data file");
    expect(() => upgradedFrom(JSON.stringify({ format: 1 }))).toThrow("Not a local data file");
    expect(() => upgradedFrom(JSON.stringify({ format: "17" }))).toThrow("Not a local data file");
  });
});

describe("the target: infomapper-dev only, until slice D (F10)", () => {
  const ok = { supabaseUrl: "https://abcdefghij.supabase.co", serverName: "dev" };
  it("takes the project's session pooler and its direct host", () => {
    expect(devTargetRefusal({ ...ok, migrationUrl: "postgres://postgres.abcdefghij:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" })).toBeNull();
    expect(devTargetRefusal({ ...ok, migrationUrl: "postgres://postgres:x@db.abcdefghij.supabase.co:5432/postgres" })).toBeNull();
  });
  it("refuses another project, another database, another server name, a local database, and nothing", () => {
    const pooled = "postgres://postgres.abcdefghij:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
    expect(devTargetRefusal({ ...ok, migrationUrl: pooled.replace("abcdefghij", "zzzzzzzzzz") })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, migrationUrl: pooled.replace("/postgres", "/other") })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, serverName: "prod", migrationUrl: pooled })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, serverName: undefined, migrationUrl: pooled })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, migrationUrl: "postgres://postgres:postgres@localhost:5432/postgres" })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, supabaseUrl: undefined, migrationUrl: pooled })).toMatch(/not infomapper-dev/);
    expect(devTargetRefusal({ ...ok, migrationUrl: "not a url" })).toMatch(/not infomapper-dev/);
  });
  it("never puts a value into its message", () => {
    const message = devTargetRefusal({ ...ok, serverName: "x", migrationUrl: "postgres://postgres.abcdefghij:secret@h/postgres" })!;
    expect(message).not.toContain("secret");
    expect(message).not.toContain("abcdefghij");
  });
});

describe("one organization's rows (T1, Q6)", () => {
  it("takes the organization, its workspaces' rows and its organization rows, never its password, and the people its rows name", () => {
    const db = seed();
    const org = organizationNamed(db, "Retail Co");
    const rows = organizationRows(db, org, STORE_SCHEMA);
    const workspaces = new Set(db.workspace!.filter((w) => w.organization_id === org).map((w) => w.id));
    expect(rows.organization).toEqual(db.organization!.filter((o) => o.id === org));
    expect(rows.organization_access).toBeUndefined();
    for (const [table, list] of Object.entries(rows)) {
      for (const r of list) {
        if (table === "app_user" || table === "organization") continue;
        if ("workspace_id" in r) expect(workspaces.has(r.workspace_id), table).toBe(true);
        else expect(r.organization_id, table).toBe(org);
      }
    }
    // every row of those workspaces is there, in the file's order
    expect(rows.entity).toEqual(db.entity!.filter((e) => workspaces.has(e.workspace_id)));
    // the people: every person a row names, and only those
    const named = new Set([...(rows.workspace_member ?? []), ...(rows.organization_member ?? [])].map((m) => m.user_id));
    for (const id of named) expect(rows.app_user!.some((u) => u.id === id)).toBe(true);
    expect(rows.app_user!.every((u) => !("auth_user_id" in u))).toBe(true);
  });

  it("refuses an organization the file lacks, two of one name, a person named but missing, and a password in a change event", () => {
    const db = seed();
    expect(() => organizationRows(db, "01a0f9e9-0000-7000-8000-000000000000", STORE_SCHEMA)).toThrow("no such organization");
    expect(() => organizationNamed({ organization: [{ name: "X" }, { name: "X" }] }, "X")).toThrow("2 organizations");
    expect(() => organizationNamed(db, "Nobody")).toThrow("0 organizations");
    const org = organizationNamed(db, "Retail Co");
    const named = organizationRows(db, org, STORE_SCHEMA).app_user!.map((u) => u.id);
    expect(() => organizationRows({ ...db, app_user: db.app_user!.filter((u) => u.id !== named[0]) }, org, STORE_SCHEMA)).toThrow("1 people");
    const ws = db.workspace!.find((w) => w.organization_id === org)!.id;
    const event = (access_hash: string) => ({
      id: "e", workspace_id: ws, change_group_id: "g", occurred_at: "2026-11-19T10:00:00.000Z", user_id: named[0], object_type: "organization_access",
      object_id: org, operation: "update", before_image: { access_hash: "(unchanged)" }, after_image: { access_hash }, context_label_id: null,
    });
    expect(() => organizationRows({ ...db, change_event: [event("(changed)")] }, org, STORE_SCHEMA)).not.toThrow();
    expect(() => organizationRows({ ...db, change_event: [event("scrypt$1$abc")] }, org, STORE_SCHEMA)).toThrow("holds the organization's password");
  });
});

describe("the people pg:accounts handles by default (F3)", () => {
  const seedNames = new Set(["InfoMate", "Retail Co"]);
  it("handles only people whose every membership is in a seed organization", () => {
    const { handled, leftOut } = seedPeople(
      ["a", "b", "c", "d"],
      [
        { user_id: "a", organization: "InfoMate" },
        { user_id: "a", organization: "Retail Co" },
        { user_id: "b", organization: "Own" },
        { user_id: "c", organization: "InfoMate" },
        { user_id: "c", organization: "Own" },
      ],
      seedNames,
    );
    expect(handled).toEqual(["a"]);
    expect(leftOut).toBe(3);
  });
  it("the seed's organizations are the demo's", () => {
    expect([...seedOrganizationNames()].sort()).toEqual([...new Set(seedRows().organization.map((o) => o.name))].sort());
  });
});

describe("the reset's guard (Q8, T4)", () => {
  const holding = (names: string[]) => ({ query: async () => ({ rows: names.map((name) => ({ name })) }) }) as never;
  it("lets the reset go with the seed's organizations only, and refuses with any other, naming the order and no name", async () => {
    const seedNames = new Set(["InfoMate", "Retail Co"]);
    expect(await resetRefusal(holding(["InfoMate", "Retail Co"]), seedNames)).toBeNull();
    expect(await resetRefusal(holding([]), seedNames)).toBeNull();
    const refused = await resetRefusal(holding(["InfoMate", "Some own org"]), seedNames);
    expect(refused).toContain("1 organization the seed does not make");
    expect(refused).toContain("npm run pg:backup, then npm run pg:kb -- --remove, then the reset");
    expect(refused).not.toContain("Some own org");
    expect(await resetRefusal(holding(["A", "B"]), seedNames)).toContain("2 organizations");
  });
});
