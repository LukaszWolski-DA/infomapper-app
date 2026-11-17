// npx tsx scripts/pg-snapshot-size.ts (slice 29, step 4, Q9): the editor's snapshot as the action answers it
// (`documentSnapshotAction`: `store.snapshot(workspace, DOCUMENT_TABLES)`, then `browserSnapshot`), read through the
// Postgres adapter from the laptop, for each workspace: its JSON's bytes uncompressed, gzip and brotli, against Vercel's
// 4.5 MB body limit, and the read's time from here (environment 2, so the network to Frankfurt is in it). Counts and
// sizes only; no value is printed.
import zlib from "node:zlib";
import { DOCUMENT_TABLES } from "../src/compose/documents";
import { STORE_SCHEMA } from "../src/compose/tables";
import { getPool } from "../src/data/postgres/pool";
import { createPostgresDataStore } from "../src/data/postgres/store";
import { browserSnapshot } from "../src/modules/infodocumenter/app/snapshot";
import { loadPgEnv } from "./lib/pg-env";

const LIMIT = 4.5 * 1024 * 1024;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

async function main(): Promise<number> {
  loadPgEnv();
  const store = createPostgresDataStore(STORE_SCHEMA);
  const { rows } = await getPool().query<{ id: string; name: string }>("select id, name from workspace where deleted_at is null order by created_at, id");
  for (const ws of rows) {
    const start = performance.now();
    const snapshot = await store.snapshot(ws.id, DOCUMENT_TABLES);
    const ms = performance.now() - start;
    if (!snapshot) continue;
    const json = JSON.stringify(browserSnapshot(snapshot));
    const raw = Buffer.byteLength(json);
    const gzip = zlib.gzipSync(json).length;
    const brotli = zlib.brotliCompressSync(json).length;
    console.log(`${ws.name.padEnd(22)} ${kb(raw).padStart(10)} raw (${((raw / LIMIT) * 100).toFixed(1)} % of 4.5 MB)  ${kb(gzip).padStart(9)} gzip  ${kb(brotli).padStart(9)} brotli  read ${Math.round(ms)} ms`);
  }
  await getPool().end();
  return 0;
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
