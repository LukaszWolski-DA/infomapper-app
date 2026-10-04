// Removes an e2e build folder before an e2e dev server starts in it (default .next-e2e), so no state from a server that
// was stopped by force is reused. Only the e2e folders: `npm run dev` keeps its .next.
import { rmSync } from "node:fs";

const folder = process.argv[2] ?? ".next-e2e";
if (!/^\.next-e2e[\w-]*$/.test(folder)) throw new Error(`Not an e2e build folder: ${folder}`);
rmSync(folder, { recursive: true, force: true });
