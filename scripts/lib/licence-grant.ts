// Granting an organization a module's licence in a Postgres database (slice 39, C8): the rule of `scripts/licence.ts`
// (the local file's) as one transaction. Grant only: ending a licence has no command yet (docs/known-limitations.md).
// The organization by its exact name, one live organization or a refusal; idempotent; its first owner as the licence's
// author; no change event (as the seed's and `licence.ts`'s licences). Pure of any target check: `scripts/pg-licence.ts`
// refuses every database but infomapper-dev before it calls this; the contract test calls it on a database of its own.

import type { Client } from "pg";
import { uuidv7 } from "../../src/domain/ids";
import { LICENSED_MODULES, type LicensedModule } from "../../src/domain/types";

export const LICENCE_USAGE = `Use: npm run pg:licence -- grant "<organization name>" ${LICENSED_MODULES.join("|")}`;

/** The command line's grant, or a refusal (nothing was changed). */
export function licenceArgs(argv: readonly string[]): { name: string; module: LicensedModule } | { refusal: string } {
  const [verb, name, module, ...rest] = argv;
  if (verb !== "grant" || !name?.trim() || !module || rest.length) return { refusal: LICENCE_USAGE };
  if (!(LICENSED_MODULES as readonly string[]).includes(module)) return { refusal: `Unknown module "${module}". Known: ${LICENSED_MODULES.join(", ")}. Nothing was changed.` };
  return { name, module: module as LicensedModule };
}

export type GrantOutcome = "granted" | "held";

/** Grants the licence in one transaction; throws a refusal (rolled back) when no or several organizations have the name. */
export async function grantLicence(client: Client, name: string, module: LicensedModule, now: Date = new Date()): Promise<GrantOutcome> {
  await client.query("begin");
  try {
    const found = (await client.query<{ id: string }>("select id from organization where name = $1 and deleted_at is null for update", [name])).rows;
    if (found.length !== 1) throw new Error(`${found.length ? "More than one organization has" : "No organization has"} that name: nothing was changed.`);
    const organizationId = found[0]!.id;
    const held = await client.query("select 1 from organization_licence where organization_id = $1 and module = $2 and deleted_at is null", [organizationId, module]);
    if (held.rows.length) {
      await client.query("rollback");
      return "held";
    }
    const owner = (await client.query<{ user_id: string }>("select user_id from organization_member where organization_id = $1 and role = 'owner' order by created_at, user_id limit 1", [organizationId])).rows[0];
    if (!owner) throw new Error("The organization has no owner to record as the licence's author: nothing was changed.");
    const at = now.toISOString();
    await client.query(
      `insert into organization_licence (id, version, created_at, created_by, updated_at, updated_by, deleted_at, organization_id, module)
       values ($1, 1, $2, $3, $2, $3, null, $4, $5)`,
      [uuidv7(now.getTime()), at, owner.user_id, organizationId, module],
    );
    await client.query("commit");
    return "granted";
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
