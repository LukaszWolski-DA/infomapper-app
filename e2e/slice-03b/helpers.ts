// Slice 3b's steps on top of slice 3a's: the miniature's commit counter (S3B-13).

import type { Page } from "./fixtures";

export * from "../slice-03a/helpers";

/** How many times the Overview's miniature committed (development only, `Overview.tsx`). */
export const miniatureCommits = (page: Page) => page.evaluate(() => (window as unknown as { __imMiniatureCommits?: number }).__imMiniatureCommits ?? 0);

/** The notes the miniature draws, by colour. */
export const miniNoteColors = (page: Page) =>
  page.getByTestId("mini-note").evaluateAll((els) => els.map((e) => (e as SVGElement).dataset.color ?? "").sort());
