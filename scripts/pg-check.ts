// npx tsx scripts/pg-check.ts [--migration]: one parameterized query through the app's connection (slice 29, F6), the
// transaction pooler with full TLS verification; `--migration` tries the session pooler instead. Prints the target as
// host/database, the server's version, whether TLS was verified and the query's answer. Never a value from the file.
import { Client } from "pg";
import { loadPgEnv, required, targetName } from "./lib/pg-env";
import { pgClientConfig } from "../src/data/postgres/config";

async function main(): Promise<number> {
  loadPgEnv();
  const name = process.argv.includes("--migration") ? "INFOMAPPER_MIGRATION_URL" : "INFOMAPPER_DATABASE_URL";
  const url = required(name);
  const client = new Client(pgClientConfig(url));
  console.log(`Target (${name}): ${targetName(url)}`);
  try {
    await client.connect();
    const version = await client.query("show server_version");
    const answer = await client.query<{ n: number }>("select $1::int + 1 as n", [41]);
    const tls = await client.query<{ ssl: boolean }>("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
    console.log(`Postgres ${String(version.rows[0]?.server_version)}`);
    console.log(`TLS verified by the client: yes (rejectUnauthorized); the server reports ssl = ${String(tls.rows[0]?.ssl ?? "unknown (pooler)")}`);
    console.log(`Parameterized query: select $1::int + 1 with 41 -> ${String(answer.rows[0]?.n)}`);
    return answer.rows[0]?.n === 42 ? 0 : 1;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error(`Failed: ${err.code ?? "no code"}: ${sanitized(err.message ?? String(e), url)}`);
    return 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** The error's text with anything of the connection string taken out. */
function sanitized(message: string, url: string): string {
  let out = message;
  try {
    const u = new URL(url);
    for (const secret of [url, decodeURIComponent(u.password), u.password, decodeURIComponent(u.username)]) if (secret) out = out.split(secret).join("…");
  } catch {
    out = out.split(url).join("…");
  }
  return out;
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
