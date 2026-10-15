// Slice 4b-1's e2e helpers: fading with F4 through the test hook (`window.__imFade`, the e2e dev server only), the veil's
// holes read back from its path, a node's rectangle on the canvas, and the commit counters (slice 4p).

import type { Locator, Page } from "@playwright/test";

export * from "../slice-04a/helpers";

export type Rect = { x: number; y: number; w: number; h: number };

/** Switches fading through the hook: `{ focus: entityId }`, `{ focus: { t, id } }`, `{ lit, key }` or null. */
export const fade = (page: Page, request: unknown) => page.evaluate((r) => (window as unknown as { __imFade: (r: unknown) => void }).__imFade(r), request);

/** A lit set given directly through the hook: the tables only. */
export const fadeTables = (page: Page, tableIds: string[], key: string) =>
  page.evaluate(
    ([tableIds, key]) =>
      (window as unknown as { __imFade: (r: unknown) => void }).__imFade({
        key,
        lit: { entities: new Set(), tables: new Set(tableIds), rows: new Map(), mappings: new Set(), relationships: new Set() },
      }),
    [tableIds, key] as const,
  );

/** The canvas's, the miniature's and the fading layer's commit counters (development only). */
export const commitCounters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number; __imFadeCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0, fade: w.__imFadeCommits ?? 0 };
  });

/**
 * The veil's holes, from its path (F4, `FadeLayer.tsx`): every sub-path after the outer rectangle is a rounded
 * rectangle `M x+r,y H x+w-r A r,r … V y+h-r …`; returned in canvas coordinates.
 */
export const veilHoles = (page: Page): Promise<Rect[]> =>
  page.getByTestId("layer-fade").locator("path").evaluate((p) => {
    const d = p.getAttribute("d") ?? "";
    const out: { x: number; y: number; w: number; h: number }[] = [];
    const re = /M(-?[\d.]+),(-?[\d.]+)H(-?[\d.]+)A(-?[\d.]+),-?[\d.]+ 0 0 1 -?[\d.]+,-?[\d.]+V(-?[\d.]+)/g;
    for (let m = re.exec(d); m; m = re.exec(d)) {
      const [x1, y, x2, r, y2] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [number, number, number, number, number];
      out.push({ x: x1 - r, y, w: x2 + r - (x1 - r), h: y2 + r - y });
    }
    return out;
  });

/** A React Flow node's rectangle on the canvas: its wrapper's translation and its laid-out size. */
export const nodeRect = (node: Locator): Promise<Rect> =>
  node.evaluate((el: HTMLElement) => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
    return { x: Number(m?.[1] ?? NaN), y: Number(m?.[2] ?? NaN), w: el.offsetWidth, h: el.offsetHeight };
  });

/** Whether one of `holes` lies on `r` (within a pixel and a half, for rounding). */
export const holeAt = (holes: readonly Rect[], r: Rect) =>
  holes.some((h) => Math.abs(h.x - r.x) < 1.5 && Math.abs(h.y - r.y) < 1.5 && Math.abs(h.w - r.w) < 1.5 && Math.abs(h.h - r.h) < 1.5);
