// One organization's rows in a local data file (slice 31, T1, Q6): what `pg:kb` copies. Pure.
//
// - The organization, its workspaces and every row of its workspaces (module rows and the history included, soft-deleted
//   rows too), its organization rows (members, licences) except `organization_access`: the organization's development
//   password is never copied (C1.2; on Postgres nothing reads it).
// - The people its rows name (every column that refers to `app_user`, by the store's rules): its members and anyone who
//   wrote there. A person named but missing from the file is refused.
// - A change event of the organization's password whose images hold anything but the marker is refused: no hash leaves
//   the laptop (`SECRET_COLUMNS`).
import { SECRET_CHANGED, SECRET_UNCHANGED } from "../../src/domain/changes";
import type { StoreSchema } from "../../src/data/rows";

type Row = Record<string, unknown>;
export type Tables = Record<string, readonly Row[]>;

/** The one organization of the file with this name (refused unless exactly one). */
export function organizationNamed(db: Tables, name: string): string {
  const found = (db.organization ?? []).filter((o) => o.name === name);
  if (found.length !== 1) throw new Error(`The file has ${found.length} organizations of that name, not one: nothing was copied.`);
  return found[0]!.id as string;
}

/** The organization's rows, table by table in the file's order (`format` left out); tables without a row left out. */
export function organizationRows(db: Tables, organizationId: string, schema: StoreSchema): Tables {
  if (!(db.organization ?? []).some((o) => o.id === organizationId)) throw new Error("The file has no such organization: nothing was copied.");
  const workspaces = new Set((db.workspace ?? []).filter((w) => w.organization_id === organizationId).map((w) => w.id as string));
  const out: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(db)) {
    if (table === "format" || table === "app_user" || table === "organization_access" || !Array.isArray(rows)) continue;
    const mine = rows.filter((r) =>
      table === "organization" ? r.id === organizationId : "workspace_id" in r ? workspaces.has(r.workspace_id as string) : "organization_id" in r ? r.organization_id === organizationId : false,
    );
    if (mine.length) out[table] = mine;
  }

  for (const e of out.change_event ?? []) {
    if (e.object_type !== "organization_access") continue;
    for (const image of [e.before_image, e.after_image] as (Row | null)[]) {
      const v = image?.access_hash;
      if (v !== undefined && v !== SECRET_CHANGED && v !== SECRET_UNCHANGED) throw new Error("A change event holds the organization's password instead of its marker: nothing was copied.");
    }
  }

  const named = new Set<string>();
  for (const [table, rows] of Object.entries(out)) {
    const columns = Object.entries(schema.rules[table]?.foreignKeys ?? {}).filter(([, target]) => target === "app_user").map(([c]) => c);
    for (const r of rows) for (const c of columns) if (typeof r[c] === "string") named.add(r[c] as string);
  }
  const people = (db.app_user ?? []).filter((u) => named.has(u.id as string));
  if (people.length !== named.size) throw new Error(`${named.size - people.length} people the organization's rows name are not in the file: nothing was copied.`);
  if (people.length) out.app_user = people.map((u) => Object.fromEntries(Object.entries(u).filter(([k]) => k !== "auth_user_id")));
  return out;
}
