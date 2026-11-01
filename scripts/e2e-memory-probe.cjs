// The e2e dev server's memory (chore e2e reliability, P1; E2E_MEMORY_LOG=1 only). `playwright.config.ts` loads this file
// into every Node process the e2e web server starts (NODE_OPTIONS=--require). Only `next dev`'s main process, its
// server child (`start-server.js`) and the child's own Node workers (role "worker", short-lived) write: every 5 s one
// JSON line with the V8 heap (used and limit; Next.js restarts the child above 80 % of the limit,
// `getMemoryRestartStats`) and the process's resident memory. Each reads its own figures, so nothing is spawned and the
// timer never keeps a process alive.
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- loaded with --require into plain Node processes */

const file = process.env.E2E_MEMORY_FILE;
const underServer = process.env.__NEXT_DEV_SERVER === "1";
const isChild = underServer && /server[\\/]lib[\\/]start-server\.js$/.test(process.argv[1] ?? "");
const isMain = !underServer && /next[\\/]dist[\\/]bin[\\/]next$/.test(process.argv[1] ?? "") && process.argv.includes("dev");

if (file && (underServer || isMain)) {
  const fs = require("node:fs");
  const v8 = require("node:v8");
  const role = isChild ? "child" : isMain ? "main" : "worker";
  const MB = 1024 * 1024;
  const out = `${file}.server.jsonl`;
  const write = (line) => {
    try {
      fs.appendFileSync(out, JSON.stringify({ t: new Date().toISOString(), role, pid: process.pid, ...line }) + "\n");
    } catch {
      // a lost sample is fine; the run must not fail on its log
    }
  };
  const sample = () => {
    const heap = v8.getHeapStatistics();
    const mem = process.memoryUsage();
    write({
      heapUsedMb: Math.round(heap.used_heap_size / MB),
      heapLimitMb: Math.round(heap.heap_size_limit / MB),
      rssMb: Math.round(mem.rss / MB),
      externalMb: Math.round(mem.external / MB),
    });
  };
  write({ event: "start", ppid: process.ppid, script: require("node:path").basename(process.argv[1] ?? ""), nodeOptions: process.env.NODE_OPTIONS ?? "" });
  sample();
  setInterval(sample, 5000).unref();
  process.on("exit", (code) => write({ event: "exit", code }));
}
