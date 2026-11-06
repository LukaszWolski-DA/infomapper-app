// The full e2e run in seven parts (chore e2e reliability, P2 B; four since slice 14b; seven since chore CI e2e, cut by
// slice 15c's folder times on the laptop so that no part takes much longer than the others): each part runs with its own
// fresh dev server, so the server's heap, which grows about 6 MB per test, never comes near Next.js's restart threshold,
// and in GitHub Actions the parts run side by side (`.github/workflows/e2e.yml` reads this list). A part is a run of
// folders in Playwright's order (alphabetical), from its first folder up to the next part's first; a folder added later
// falls into the part before it, a new slice into the last one. Move the cuts when a part grows clearly longer than the
// others (docs/prd/chore-ci-e2e-acceptance.md).

import { readdirSync } from "node:fs";
import path from "node:path";

/** The first folder of parts 2 to 7. */
export const PART_STARTS = ["slice-02b", "slice-04a", "slice-07a", "slice-08", "slice-10c", "slice-14a"] as const;
export const PART_COUNT = PART_STARTS.length + 1;

/** The folders under `e2e/` that part `part` (1-based) runs. */
export function partFolders(part: number, folders = e2eFolders()): string[] {
  if (!Number.isInteger(part) || part < 1 || part > PART_COUNT) throw new Error(`E2E_PART must be 1 to ${PART_COUNT}, not ${part}`);
  const from = part === 1 ? "" : (PART_STARTS[part - 2] ?? "");
  const to = PART_STARTS[part - 1];
  return folders.filter((f) => f >= from && (to === undefined || f < to));
}

/** The spec files of a `playwright test --list --reporter=json` report, relative to `e2e/`, with `/`, sorted. */
export function listedFiles(report: { suites?: { file?: string }[] }): string[] {
  const files = (report.suites ?? []).map((s) => s.file).filter((f): f is string => !!f);
  return [...new Set(files.map((f) => f.replace(/\\/g, "/").replace(/^e2e\//, "")))].sort();
}

function e2eFolders(): string[] {
  return readdirSync(path.resolve("e2e"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
