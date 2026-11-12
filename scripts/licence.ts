// Grants an organization a module's licence in a local data file (slice 15a, C-7, Q6 as changed on 4 November 2026):
//   npx tsx scripts/licence.ts grant "<organization name>" infocube|infodoc [--file <db>]   (infodoc: slice 25)
// Development only (the local adapter, AD-29); the database slice replaces it with whatever sells the licence. It only
// grants: ending a licence has no command yet (docs/known-limitations.md). It writes no change event, as the seed's
// rows have none, and changes nothing else in the file; a workspace is turned on in its settings by an owner or admin.

import { assertNotProduction, devDbPath, readDb, writeDb } from "../src/data/local/file";
import { uuidv7 } from "../src/domain/ids";
import { LICENSED_MODULES, type LicensedModule } from "../src/domain/types";

async function main(argv: string[]): Promise<string> {
  assertNotProduction();
  const fileAt = argv.indexOf("--file");
  const file = fileAt >= 0 ? argv[fileAt + 1] : devDbPath();
  const [verb, name, module] = argv.filter((_, i) => fileAt < 0 || (i !== fileAt && i !== fileAt + 1));
  if (verb !== "grant" || !name || !module || !file) throw new Error(`Use: npx tsx scripts/licence.ts grant "<organization name>" ${LICENSED_MODULES.join("|")} [--file <db>]`);
  if (!(LICENSED_MODULES as readonly string[]).includes(module)) throw new Error(`Unknown module "${module}". Known: ${LICENSED_MODULES.join(", ")}.`);
  const db = await readDb(file);
  const found = db.organization.filter((o) => o.deleted_at === null && o.name === name);
  if (found.length !== 1) throw new Error(found.length ? `More than one organization is called "${name}".` : `No organization is called "${name}".`);
  const organization = found[0]!;
  if (db.organization_licence.some((l) => l.organization_id === organization.id && l.module === module && l.deleted_at === null)) return `${name} holds the ${module} licence already; nothing changed.`;
  const owner = db.organization_member.find((m) => m.organization_id === organization.id && m.role === "owner");
  if (!owner) throw new Error(`${name} has no owner to record as the licence's author.`);
  const at = new Date().toISOString();
  db.organization_licence.push({ id: uuidv7(), version: 1, created_at: at, created_by: owner.user_id, updated_at: at, updated_by: owner.user_id, deleted_at: null, organization_id: organization.id, module: module as LicensedModule });
  await writeDb(file, db);
  return `${name} holds the ${module} licence now. Turn it on per workspace in its settings.`;
}

main(process.argv.slice(2)).then(
  (message) => console.log(message),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
