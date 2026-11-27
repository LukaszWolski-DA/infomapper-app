// npm run pg:licence -- grant "<organization name>" infocube|infodoc|infocatalog   (slice 39, C8)
//
// Grants an organization a module's licence in infomapper-dev, as `scripts/licence.ts` does in a local file: grant only,
// the organization by its exact name, idempotent, one transaction (`scripts/lib/licence-grant.ts`). The target is
// INFOMAPPER_MIGRATION_URL (`.env.postgres.local`), refused unless it is infomapper-dev (`devTargetRefusal`, as pg:kb),
// so never production until slice D. Run only on Łukasz's command. It prints the target as host/database and the
// outcome only: never a name, an e-mail or an id.

import fs from "node:fs";
import { Client } from "pg";
import { pgClientConfig } from "../src/data/postgres/config";
import { grantLicence, licenceArgs } from "./lib/licence-grant";
import { devTargetRefusal, loadPgEnv, required, targetName } from "./lib/pg-env";

async function main(): Promise<void> {
  const args = licenceArgs(process.argv.slice(2));
  if ("refusal" in args) throw new Error(args.refusal);
  if (fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = required("INFOMAPPER_MIGRATION_URL");
  const refusal = devTargetRefusal({ migrationUrl: url, supabaseUrl: process.env.SUPABASE_URL, serverName: process.env.INFOMAPPER_SERVER_NAME });
  if (refusal) throw new Error(refusal);
  const client = new Client(pgClientConfig(url));
  await client.connect();
  console.log(`Target: ${targetName(url)} (grant ${args.module})`);
  try {
    const outcome = await grantLicence(client, args.name, args.module);
    console.log(outcome === "granted" ? `The organization holds the ${args.module} licence now.` : `The organization holds the ${args.module} licence already: nothing was changed.`);
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
