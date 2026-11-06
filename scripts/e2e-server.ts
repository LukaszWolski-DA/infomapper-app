// The e2e dev server (chore CI e2e, Łukasz's answer 2): `next dev` on the given port, its output (stdout and stderr) into
// a file, not the console. Started by playwright.config.ts's `webServer` after the build folder's clean and the reseed;
// the file lies in the run's output folder (`test-results/part-<n>/server.log`), which Playwright clears before it
// starts the server, so it holds this run's server only. A restart at Next.js's memory threshold ("approaching the used
// memory threshold") is read from it. Playwright stops the server by ending this process's tree.
//   npx tsx scripts/e2e-server.ts <port> <log file>

import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import path from "node:path";

const [port, log] = process.argv.slice(2);
if (!port || !/^\d+$/.test(port) || !log) throw new Error("usage: e2e-server.ts <port> <log file>");

mkdirSync(path.dirname(log), { recursive: true });
const out = openSync(log, "a");
const next = path.resolve("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "--port", port], { stdio: ["ignore", out, out], env: process.env });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
