// Slice 4p's e2e helpers: the commit counters the canvas and the Overview's miniature keep in development
// (`window.__imCanvasCommits`, `__imMiniatureCommits`, and the fading layer's `__imFadeCommits`).

import type { Page } from "../slice-02a/fixtures";

export const counters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number; __imFadeCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0, fade: w.__imFadeCommits ?? 0 };
  });
