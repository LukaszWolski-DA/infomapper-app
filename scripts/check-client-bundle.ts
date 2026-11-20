// The secret key never in the browser (slice 33, Q3, F1): after `npm run build`, every file the build hands the browser
// (`.next/static/`) is read and the check fails when one holds SUPABASE_SECRET_KEY's value, its name, or the
// module that reads it. CI's smoke job runs it with the local stack's throwaway key. Prints counts and file paths
// only, never the value.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.NEXT_DIST_DIR ?? ".next", "static");
if (!fs.existsSync(root)) {
  console.error(`No build at ${root}: run npm run build first.`);
  process.exit(2);
}
const value = process.env.SUPABASE_SECRET_KEY?.trim();
if (!value) console.log("SUPABASE_SECRET_KEY is not set here: only its name and its module are looked for.");
const needles = [...(value ? [value] : []), "SUPABASE_SECRET_KEY", "supabase-admin"];

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(root);

const found: string[] = [];
for (const f of files) {
  const text = fs.readFileSync(f, "latin1");
  needles.forEach((n, i) => {
    if (text.includes(n)) found.push(`${path.relative(process.cwd(), f)} (${i === 0 && value ? "the key's value" : n})`);
  });
}
if (found.length) {
  console.error(`The secret key or its module is in ${found.length} client file(s):\n${found.join("\n")}`);
  process.exit(1);
}
console.log(`Checked ${files.length} client files: no secret key, no SUPABASE_SECRET_KEY, no supabase-admin.`);
