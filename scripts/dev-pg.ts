// npm run dev:pg (slice 29, environment 2): the laptop's dev server on infomapper-dev. It loads `.env.postgres.local`
// (git-ignored, refused otherwise; L4), sets INFOMAPPER_DATA=postgres and starts `next dev` on port 3000 in its own build
// folder (.next-pg). Port 3000 is `npm run dev`'s too, so the two never run at once, and Next.js never reads
// `.env.postgres.local` itself, so `npm run dev` (environment 1) never has its values in the app. No value is printed.
import { spawn } from "node:child_process";
import path from "node:path";
import { loadPgEnv, required, targetName } from "./lib/pg-env";

loadPgEnv();
const url = required("INFOMAPPER_DATABASE_URL");
console.log(`Postgres mode on ${targetName(url)}: http://localhost:3000 (Supabase Auth sign-in comes in slice 29, step 3).`);
const next = path.resolve("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-p", "3000"], {
  stdio: "inherit",
  env: { ...process.env, INFOMAPPER_DATA: "postgres", NEXT_DIST_DIR: ".next-pg" },
});
child.on("exit", (code) => process.exit(code ?? 0));
