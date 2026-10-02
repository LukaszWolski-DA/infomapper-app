import type { Page } from "@playwright/test";

/* Shared helpers for the spike's Playwright scripts. The app exposes window.__spike = { data, rf, toggleFrame }. */

export interface Box { x: number; y: number; w: number; h: number }

/** Load the canvas and wait until React Flow has measured every node. */
export async function openCanvas(page: Page, query = "") {
  // SPIKE_QUERY (e.g. "wc=move") is appended to every load, to run the same scripts against another setup;
  // an explicit query in the script wins because the app reads the first occurrence of a parameter
  const extra = process.env.SPIKE_QUERY;
  if (extra) query = (query ? query + "&" : "?") + extra;
  await page.goto("/" + query);
  await page.waitForFunction(() => {
    const s = (window as any).__spike;
    return s && s.rf.getNodes().every((n: any) => n.hidden || n.measured?.width);
  });
  await page.waitForTimeout(200);
}

/** Absolute flow-space box of a node (React Flow internals). */
export const nodeBox = (page: Page, id: string) =>
  page.evaluate(id => {
    const i = (window as any).__spike.rf.getInternalNode(id);
    return { x: i.internals.positionAbsolute.x, y: i.internals.positionAbsolute.y, w: i.measured.width, h: i.measured.height } as Box;
  }, id);

/** Absolute positions of every node, keyed by id. */
export const allPositions = (page: Page) =>
  page.evaluate(() => {
    const { rf } = (window as any).__spike;
    const o: Record<string, [number, number]> = {};
    for (const n of rf.getNodes()) {
      const i = rf.getInternalNode(n.id);
      o[n.id] = [i.internals.positionAbsolute.x, i.internals.positionAbsolute.y];
    }
    return o;
  });

export const selectedIds = (page: Page) =>
  page.evaluate(() => (window as any).__spike.rf.getNodes().filter((n: any) => n.selected).map((n: any) => n.id).sort() as string[]);

export const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__spike.rf.flowToScreenPosition({ x, y }) as { x: number; y: number }, [x, y]);

export const fitNodes = async (page: Page, ids: string[], padding = 0.2) => {
  await page.evaluate(([ids, padding]) => (window as any).__spike.rf.fitView({ nodes: (ids as string[]).map(id => ({ id })), padding }), [ids, padding] as const);
  await page.waitForTimeout(250);
};

export const setViewport = async (page: Page, x: number, y: number, zoom: number) => {
  await page.evaluate(([x, y, zoom]) => (window as any).__spike.rf.setViewport({ x, y, zoom }), [x, y, zoom]);
  await page.waitForTimeout(250);
};

/** Drag with real mouse events in small steps. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await page.mouse.up();
  await page.waitForTimeout(100);
}

/*
 * Rendered line-end check in screen space: reads each mapping line's drawn path (getPointAtLength + getScreenCTM)
 * and compares both ends with the row's bounding box and the card's facing side.
 */
export const checkMappingEnds = (page: Page, filter?: string[]) =>
  page.evaluate(filter => {
    const { data } = (window as any).__spike;
    const tol = 1; // screen px
    const bad: unknown[] = [];
    let checked = 0;
    for (const m of data.mappings) {
      if (filter && !filter.includes(m.id)) continue;
      const g = document.querySelector(`[data-edge="${m.id}"]`);
      if (!g) { bad.push({ id: m.id, why: "line not rendered" }); continue; }
      const path = g.querySelector("path.s") as SVGPathElement;
      const ctm = path.getScreenCTM()!;
      const at = (l: number) => { const p = path.getPointAtLength(l); return new DOMPoint(p.x, p.y).matrixTransform(ctm); };
      const ends = [at(0), at(path.getTotalLength())];
      const cards = [m.srcCard, m.entCard].map(id => document.querySelector(`[data-card="${id}"]`)!.getBoundingClientRect());
      const ltr = cards[0].left + cards[0].width / 2 <= cards[1].left + cards[1].width / 2;
      const expectX = [ltr ? cards[0].right : cards[0].left, ltr ? cards[1].left : cards[1].right];
      [m.column, m.attribute].forEach((row: string, i: number) => {
        checked++;
        const r = document.querySelector(`[data-card="${i ? m.entCard : m.srcCard}"] [data-row="${row}"]`)!.getBoundingClientRect();
        const e = ends[i];
        const inRow = e.y >= r.top - tol && e.y <= r.bottom + tol;
        const onSide = Math.abs(e.x - expectX[i]) <= tol;
        if (!inRow || !onSide) bad.push({ id: m.id, end: i, x: e.x, y: e.y, row: [r.left, r.top, r.right, r.bottom], expectX: expectX[i] });
      });
    }
    return { checked, bad };
  }, filter);
