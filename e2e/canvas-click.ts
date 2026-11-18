// Clicks on the canvas at a point a person can see (fix/e2e-visible-clicks). Playwright's plain `click()` aims at the
// element's centre and first scrolls it into view: for a card partly outside the canvas's visible column that scrolls
// React Flow's `overflow:hidden` wrapper, which React Flow scrolls back on a later frame, so the press and the release
// can land on different elements and the click is lost (S3B-06, docs/known-limitations.md). `clickVisible` clicks the
// centre of the part of the element that lies inside the canvas (`area-canvas`, the column between the side panels) and
// outside the Overview, with `scroll: "none"`: Playwright never scrolls, on a retry neither, and its own checks
// (visible, stable, the hit target) stay. For an element wholly in view the point is the one Playwright clicked before.

import type { Locator } from "@playwright/test";

export type Box = { x: number; y: number; width: number; height: number };

/** The smallest visible part `clickVisible` clicks in, in px each way. */
export const MIN_VISIBLE = 4;

export type ClickVisibleOptions = {
  button?: "left" | "right" | "middle";
  clickCount?: number;
  modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">;
};

/** The overlap of two boxes, or null when they do not overlap. */
export function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** The parts of `a` outside `hole`: `a` itself when they do not overlap, else up to four bands around the hole. */
export function minus(a: Box, hole: Box): Box[] {
  const h = intersect(a, hole);
  if (!h) return [a];
  const parts: Box[] = [
    { x: a.x, y: a.y, width: a.width, height: h.y - a.y }, // above
    { x: a.x, y: h.y + h.height, width: a.width, height: a.y + a.height - (h.y + h.height) }, // below
    { x: a.x, y: h.y, width: h.x - a.x, height: h.height }, // left
    { x: h.x + h.width, y: h.y, width: a.x + a.width - (h.x + h.width), height: h.height }, // right
  ];
  return parts.filter((p) => p.width > 0 && p.height > 0);
}

const same = (a: Box, b: Box) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/**
 * The largest part of `element` inside `column` and outside every hole, if it is at least `MIN_VISIBLE` each way; an
 * element thinner than that (a card's 4 px width handle) only when it is wholly in view.
 */
export function visiblePart(element: Box, column: Box, holes: readonly Box[]): Box | null {
  const inside = intersect(element, column);
  if (!inside) return null;
  let parts = [inside];
  for (const hole of holes) parts = parts.flatMap((p) => minus(p, hole));
  if (parts.length === 1 && same(parts[0]!, element)) return element;
  const best = parts.filter((p) => p.width >= MIN_VISIBLE && p.height >= MIN_VISIBLE).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return best ?? null;
}

const round = (b: Box | null) => (b ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}` : "none");

/**
 * Clicks a canvas element (a card, a row, a frame, a note, a requirement card) at the centre of its visible part, without
 * scrolling. Fails with a message when no part of at least 4 × 4 px is visible in the canvas's column (an element smaller
 * than that is clicked when it is wholly in view).
 */
export async function clickVisible(target: Locator, options: ClickVisibleOptions = {}): Promise<void> {
  await target.waitFor({ state: "visible" });
  // one read of the three boxes, at one moment of the page
  const boxes = await target.evaluate((el) => {
    const box = (e: Element | null) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      element: box(el)!,
      column: box(document.querySelector('[data-testid="area-canvas"]')),
      overview: box(document.querySelector('[data-testid="panel-overview"]')),
    };
  });
  if (!boxes.column) throw new Error(`clickVisible: ${target} is not on a canvas page (no area-canvas)`);
  const part = visiblePart(boxes.element, boxes.column, boxes.overview ? [boxes.overview] : []);
  if (!part)
    throw new Error(
      `clickVisible: ${target} has no part of at least ${MIN_VISIBLE} × ${MIN_VISIBLE} px in the canvas's visible column ` +
        `(element ${round(boxes.element)}, column ${round(boxes.column)}, overview ${round(boxes.overview)})`,
    );
  const position = { x: part.x + part.width / 2 - boxes.element.x, y: part.y + part.height / 2 - boxes.element.y };
  await target.click({ ...options, position, scroll: "none" });
}
