// The full e2e run in four parts (chore e2e reliability, P2 B; the fourth since slice 14b): each part runs with its own
// fresh dev server, so the server's heap, which grows about 6 MB per test, never comes near Next.js's restart threshold. A part is a run of
// folders in Playwright's order (alphabetical), from its first folder up to the next part's first; a folder added later
// falls into the part before it, a new slice into the last one. The cuts were chosen from step 2's memory log so that
// each part ends at a similar heap (docs/prd/chore-e2e-reliability-acceptance.md, step 3; slice 14b moved them to four
// parts from slice 14a's closing log, docs/prd/slice-14b-acceptance.md, Q7); move them when a part's heap grows apart
// from the others.

import { readdirSync } from "node:fs";
import path from "node:path";

/** The first folder of parts 2, 3 and 4. */
export const PART_STARTS = ["slice-03a", "slice-07a", "slice-10a"] as const;
export const PART_COUNT = PART_STARTS.length + 1;

/** The folders under `e2e/` that part `part` (1-based) runs. */
export function partFolders(part: number, folders = e2eFolders()): string[] {
  if (!Number.isInteger(part) || part < 1 || part > PART_COUNT) throw new Error(`E2E_PART must be 1 to ${PART_COUNT}, not ${part}`);
  const from = part === 1 ? "" : (PART_STARTS[part - 2] ?? "");
  const to = PART_STARTS[part - 1];
  return folders.filter((f) => f >= from && (to === undefined || f < to));
}

function e2eFolders(): string[] {
  return readdirSync(path.resolve("e2e"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
