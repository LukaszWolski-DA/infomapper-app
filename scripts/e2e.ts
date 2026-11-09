// `npm run e2e` (chore e2e reliability, P2 B; chore CI e2e).
//   npm run e2e                     the full run in eight parts (e2e/parts.ts), each with its own fresh dev server, one result
//   npm run e2e -- --part 2         one part on its own, as a normal run
//   npm run e2e -- --list           the spec files of each part, as each part's run would find them (no server starts)
//   npm run e2e -- --list --part 2  the same for one part
//   npm run e2e -- <playwright args> one run as before (a file, a folder, --grep …)
// The full run writes each part's results as a blob report (`blob-report/part-<n>.zip`) and merges them into one summary
// and one HTML report; each part keeps its failures' traces and its dev server's output (`server.log`) in
// `test-results/part-<n>/`. All parts run even if one fails. With E2E_MEMORY_LOG=1 each part's server writes its own
// memory log (`.data/e2e-memory-<time>-part<n>.*`). GitHub Actions runs the parts side by side (`.github/workflows/e2e.yml`).

import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { E2E_PORT } from "../e2e/config";
import { PART_COUNT, listedFiles, partFolders } from "../e2e/parts";

const args = process.argv.slice(2);
// Playwright's own command line through Node, without a shell: on Windows a shell would read a `|` in `--grep` as a pipe.
const CLI = path.resolve("node_modules", "@playwright", "test", "cli.js");

function playwright(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  return spawnSync(process.execPath, [CLI, ...argv], { stdio: "inherit", env }).status ?? 1;
}

/** The spec files part `part` runs: Playwright's own list with that part's configuration (no server starts for it). */
function listPart(part: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, "test", "--list", "--reporter=json"], {
      env: { ...process.env, E2E_PART: String(part), E2E_BLOB: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`listing part ${part} failed (exit ${code}):\n${err}`));
      try {
        resolve(listedFiles(JSON.parse(out) as { suites?: { file?: string }[] }));
      } catch (e) {
        reject(new Error(`listing part ${part}: not Playwright's JSON report (${String(e)})`));
      }
    });
  });
}

/** Whether something listens on the e2e port (a server left from a part, or someone's own). */
function portInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port: E2E_PORT, host: "localhost" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

async function waitForFreePort(ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (!(await portInUse())) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return !(await portInUse());
}

const minutes = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

/** `--list` alone or with `--part <n>`: undefined when `args` asks for something else. */
function listRequest(): number[] | undefined {
  if (!args.includes("--list")) return undefined;
  const rest = args.filter((a) => a !== "--list");
  if (rest.length === 0) return Array.from({ length: PART_COUNT }, (_, i) => i + 1);
  if (rest.length === 2 && rest[0] === "--part") {
    const part = Number(rest[1]);
    partFolders(part); // refuses a wrong number
    return [part];
  }
  return undefined;
}

async function main(): Promise<number> {
  const listed = listRequest();
  if (listed) {
    const files = await Promise.all(listed.map(listPart));
    let total = 0;
    const lines: string[] = [];
    for (const [i, part] of listed.entries()) {
      const folders = partFolders(part);
      lines.push(`part ${part} (${folders[0]} to ${folders.at(-1)}): ${files[i]!.length} files`);
      for (const f of files[i]!) lines.push(`  ${f}`);
      total += files[i]!.length;
    }
    if (listed.length > 1) lines.push(`total: ${total} files`);
    // One write, finished before `process.exit`: on Linux a pipe's stdout is asynchronous, and the exit dropped what
    // was still on its way (CI listed parts 1 to 5 only once slice 16's specs made the list longer).
    await new Promise<void>((done) => process.stdout.write(`${lines.join("\n")}\n`, () => done()));
    return 0;
  }

  const at = args.indexOf("--part");
  if (at >= 0) {
    const rest = [...args.slice(0, at), ...args.slice(at + 2)];
    partFolders(Number(args[at + 1])); // refuses a wrong number before a server starts
    const env: NodeJS.ProcessEnv = { ...process.env, E2E_PART: args[at + 1] };
    if (process.env.E2E_MEMORY_LOG && !process.env.E2E_MEMORY_FILE) env.E2E_MEMORY_FILE = path.resolve(".data", `e2e-memory-${stamp()}-part${args[at + 1]}`);
    return playwright(["test", ...rest], env);
  }
  if (args.length > 0) return playwright(["test", ...args]);

  // The full run. A server already on the port would be reused by every part (`reuseExistingServer`), which is what
  // the parts are there to avoid.
  if (await portInUse()) {
    console.error(`Port ${E2E_PORT} is in use: stop the server on it before a full e2e run.`);
    return 1;
  }
  rmSync("blob-report", { recursive: true, force: true });
  const runStamp = stamp();
  const results: { part: number; folders: string[]; status: number; seconds: number }[] = [];
  for (let part = 1; part <= PART_COUNT; part++) {
    const folders = partFolders(part);
    console.log(`\n=== e2e part ${part} of ${PART_COUNT}: ${folders[0]} to ${folders.at(-1)} ===\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, E2E_PART: String(part), E2E_BLOB: "1" };
    if (process.env.E2E_MEMORY_LOG) env.E2E_MEMORY_FILE = path.resolve(".data", `e2e-memory-${runStamp}-part${part}`);
    const start = Date.now();
    const status = playwright(["test"], env);
    results.push({ part, folders, status, seconds: (Date.now() - start) / 1000 });
    // Playwright stops the part's server at its end; the next part must start its own.
    if (part < PART_COUNT && !(await waitForFreePort(60_000))) {
      console.error(`Port ${E2E_PORT} is still in use 60 s after part ${part}: the next part would reuse that server.`);
      return 1;
    }
  }

  console.log("\n=== e2e: all parts ===\n");
  const merged = playwright(["merge-reports", "--reporter=dot,html", "blob-report"], { ...process.env, PLAYWRIGHT_HTML_OPEN: "never" });
  console.log("");
  for (const r of results) console.log(`part ${r.part} (${r.folders[0]} to ${r.folders.at(-1)}): ${minutes(r.seconds)}, exit ${r.status}`);
  console.log(`total: ${minutes(results.reduce((s, r) => s + r.seconds, 0))}`);
  return results.some((r) => r.status !== 0) || merged !== 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
