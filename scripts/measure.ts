// The measurement-only production build (AD-31): a production build of the app on the local adapter, only for
// measuring the canvas (S1A-14, C-09, C-10, S2A-14). It lives in its own folder, .next-measure, and starts only with
// INFOMAPPER_MEASURE=1, listening on 127.0.0.1. A normal production build (`npm run build`, `npm start`) still refuses
// the local adapter and the development sign-in (AD-29).
//
//   npm run measure:build                      # build into .next-measure
//   npm run measure:start                      # serve it on http://127.0.0.1:3300 (PORT to change)
//
// Measuring with Playwright runs it for you: MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>.

import { spawn } from "node:child_process";

export const MEASURE_DIST = ".next-measure";

const [command] = process.argv.slice(2);
const env = { ...process.env, NEXT_DIST_DIR: MEASURE_DIST };
let args: string[];
if (command === "build") args = ["next", "build"];
else if (command === "start") {
  args = ["next", "start", "--hostname", "127.0.0.1", "--port", process.env.PORT ?? "3300"];
  Object.assign(env, { INFOMAPPER_MEASURE: "1", NODE_ENV: "production" });
} else {
  console.error("Usage: tsx scripts/measure.ts build | start");
  process.exit(2);
}

const child = spawn("npx", args, { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
