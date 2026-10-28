// Slice 8, section 6: creating an organization as the start page does: hashing the password, the command and the write
// through the local adapter, on a fresh copy of the demo data each run. 5 runs, median; bar: under 1 s.
// Run: npx tsx scripts/bench-create-organization.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { resetDevData } from "../src/data/local/dev-data";
import { createLocalDataStore } from "../src/data/local/store";
import { scryptHasher } from "../src/data/password";
import { createOrganization } from "../src/domain/commands/organization";
import { uuidv7 } from "../src/domain/ids";

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "infomapper-create-org-"));
  const file = path.join(dir, "dev-db.json");
  try {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await resetDevData(file);
      const store = createLocalDataStore(file);
      const t = performance.now();
      const accessHash = await scryptHasher.hash("correct horse battery");
      const input = { organizationName: "Test Org", name: "Jan Test", email: "jan@example.com", workspaceName: "First workspace", accessHash };
      const ctx = { actorId: uuidv7(), now: new Date().toISOString(), newId: () => uuidv7() };
      const r = createOrganization(ctx, { accountWithEmail: await store.users.getByEmail("jan@example.com") }, input);
      if (!r.ok) throw new Error(r.error.message);
      const applied = await store.apply(r.writeSet);
      if (!applied.ok) throw new Error(applied.error.message);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`create an organization: median ${times[2]!.toFixed(1)} ms, max ${times[4]!.toFixed(1)} ms (5 runs; bar: under 1 s)`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main();
