// npm run demo: the demo data, with the Sales star (slice 15a), in a data file of its own, served by a second dev server
// beside `npm run dev`, so the demo can be looked at and reset without touching .data/dev-db.json (Łukasz's KB model).
//
//   npm run demo               # seeds .data/demo-db.json if it does not exist yet, then http://127.0.0.1:3001
//   npm run demo -- --reset    # replaces .data/demo-db.json with fresh demo data first
//
// The server reads the file through INFOMAPPER_DEV_DB, builds into .next-demo (Next.js refuses a second dev server on
// one build folder) and listens on 127.0.0.1 only: cookies are kept per host name, so its sign-in never replaces the
// session of http://localhost:3000. INFOMAPPER_DEMO_DB names another file; it is refused if it is .data/dev-db.json.

import { spawn } from "node:child_process";
import path from "node:path";
import { addModuleDemoData } from "../src/compose/seed";
import { resetDevData, seedDevData } from "../src/data/local/dev-data";

const PORT = "3001";
const HOST = "127.0.0.1";
const KB = path.resolve(".data", "dev-db.json");
const file = path.resolve(process.env.INFOMAPPER_DEMO_DB ?? path.join(".data", "demo-db.json"));
const reset = process.argv.includes("--reset");

async function main(): Promise<void> {
  if (file.toLowerCase() === KB.toLowerCase()) throw new Error(`${file} is the development data file. The demo uses a file of its own.`);
  if (reset) {
    await resetDevData(file, addModuleDemoData);
    console.log(`Reset ${file} to the demo data.`);
  } else {
    const result = await seedDevData(file, addModuleDemoData);
    console.log(result === "created" ? `Seeded ${file}.` : `${file} exists already; "npm run demo -- --reset" starts it over.`);
  }
  console.log(`Demo on http://${HOST}:${PORT} (sign in by picking a test user).`);
  const next = path.resolve("node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "dev", "-p", PORT, "-H", HOST], {
    stdio: "inherit",
    env: { ...process.env, INFOMAPPER_DEV_DB: file, NEXT_DIST_DIR: ".next-demo", PORT },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
