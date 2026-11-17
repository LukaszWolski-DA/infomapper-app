// npx tsx scripts/preview-probe.ts <preview address> [path …] (slice 29, step 4): asks a protected Vercel preview for
// each path with the Protection Bypass for Automation header (VERCEL_AUTOMATION_BYPASS_SECRET from `.env.postgres.local`,
// git-ignored, L4) and prints the status, the redirect's path, the region that ran the function (`X-Vercel-Id`) and any
// `Server-Timing`. No secret, cookie or value is printed.
import { loadPgEnv, required } from "./lib/pg-env";

async function main(): Promise<number> {
  loadPgEnv();
  const secret = required("VERCEL_AUTOMATION_BYPASS_SECRET");
  const [base, ...paths] = process.argv.slice(2);
  if (!base) throw new Error("Give the preview's address.");
  for (const path of paths.length ? paths : ["/", "/sign-in"]) {
    const res = await fetch(new URL(path, base), { redirect: "manual", headers: { "x-vercel-protection-bypass": secret } });
    const location = res.headers.get("location");
    const id = res.headers.get("x-vercel-id") ?? "";
    // "<edge>::<function region>::<id>": the regions only
    const regions = id.split("::").slice(0, -1).join(" → ");
    console.log(`${path.padEnd(28)} ${res.status}${location ? ` → ${new URL(location, base).pathname}` : ""}  regions: ${regions || "-"}${res.headers.get("server-timing") ? `  server-timing: ${res.headers.get("server-timing")}` : ""}`);
  }
  return 0;
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
