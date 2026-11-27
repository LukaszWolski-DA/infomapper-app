// pg:licence's grant on Postgres (slice 39, C8): `grantLicence` in one transaction, on a database of its own beside the
// contract database (`{name}_licence`), made when missing. Runs when INFOMAPPER_CONTRACT_DB names a database on this
// machine (CI's container); never against infomapper-dev (`assertLocalDatabase`).

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgClientConfig } from "@/data/postgres/config";
import { SEED_IDS } from "@/data/local/seed";
import { grantLicence } from "../../scripts/lib/licence-grant";
import { assertLocalDatabase, contractRows, preparePostgres, spreadAll } from "./shared";

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;

async function licenceDatabase(): Promise<string> {
  assertLocalDatabase(CONTRACT_DB!);
  const url = new URL(CONTRACT_DB!);
  const name = `${url.pathname.slice(1)}_licence`;
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("The contract database's name is not a plain name.");
  const admin = new Client(pgClientConfig(CONTRACT_DB!));
  await admin.connect();
  try {
    if (!(await admin.query("select 1 from pg_database where datname = $1", [name])).rows.length) await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }
  url.pathname = `/${name}`;
  return url.toString();
}

describe.runIf(!!CONTRACT_DB)("pg:licence's grant on Postgres (slice 39, C8)", () => {
  let client: Client;
  const licences = async (module: string) =>
    (await client.query<{ organization_id: string; created_by: string; deleted_at: string | null }>("select organization_id, created_by, deleted_at from organization_licence where module = $1", [module])).rows;

  beforeAll(async () => {
    const url = await licenceDatabase();
    await preparePostgres(url, spreadAll(contractRows()));
    client = new Client(pgClientConfig(url));
    await client.connect();
  }, 300_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  it("grants the licence once, its owner as the author, and holds it the second time", async () => {
    expect(await licences("infocatalog")).toEqual([]);
    expect(await grantLicence(client, "InfoMate", "infocatalog")).toBe("granted");
    expect(await licences("infocatalog")).toEqual([{ organization_id: SEED_IDS.orgInfoMate, created_by: SEED_IDS.userLukasz, deleted_at: null }]);
    expect(await grantLicence(client, "InfoMate", "infocatalog")).toBe("held");
    expect(await licences("infocatalog")).toHaveLength(1);
  });

  it("refuses an unknown name and changes nothing", async () => {
    const before = (await client.query("select count(*)::int as n from organization_licence")).rows[0];
    await expect(grantLicence(client, "No such organization", "infocatalog")).rejects.toThrow("No organization has that name: nothing was changed.");
    await expect(grantLicence(client, "infomate", "infocatalog")).rejects.toThrow("No organization has that name");
    expect((await client.query("select count(*)::int as n from organization_licence")).rows[0]).toEqual(before);
  });

  it("refuses a name two live organizations share", async () => {
    const at = new Date().toISOString();
    await client.query("insert into organization (id, version, created_at, created_by, updated_at, updated_by, deleted_at, name) values ($1, 1, $2, $3, $2, $3, null, 'Twin'), ($4, 1, $2, $3, $2, $3, null, 'Twin')", [
      "01a0f9e9-2039-7a10-8c11-000000000101", at, SEED_IDS.userLukasz, "01a0f9e9-2039-7a10-8c11-000000000102",
    ]);
    await expect(grantLicence(client, "Twin", "infocatalog")).rejects.toThrow("More than one organization has that name: nothing was changed.");
  });
});
