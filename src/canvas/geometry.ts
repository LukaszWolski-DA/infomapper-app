// Canvas geometry, as in the prototype: card sizes come from data (header, body padding, row height and the rows a
// card shows), never from measuring the DOM (AD-24 rule 2). Pure functions, tested without a browser.

import { visibleRows, type CardData } from "./card-data";

/** Default card width (D-37), header height, row height and body padding: prototype W, H, R, PAD. */
export const CARD_W = 256;
export const HEAD_H = 54;
export const ROW_H = 26;
export const BODY_PAD = 6;

/** Below this zoom cards draw the header and a plain block instead of rows (AD-24 rule 1). */
export const LOD_ZOOM = 0.4;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;
/** Fit never zooms in further than this (prototype fitRect). */
export const FIT_MAX_ZOOM = 1.1;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const cardWidth = (card: Pick<CardData, "width">): number => card.width ?? CARD_W;

/** Height of a card: the header only when collapsed, else header, padding and its shown rows (at least one line). */
export function cardHeight(card: Pick<CardData, "rows" | "collapsed" | "rowFilter">): number {
  if (card.collapsed) return HEAD_H;
  return HEAD_H + BODY_PAD * 2 + Math.max(1, visibleRows(card).length) * ROW_H;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** The box around all cards, or null for an empty canvas. */
export function contentBounds(cards: readonly Pick<CardData, "x" | "y" | "width" | "rows" | "collapsed" | "rowFilter">[]): Rect | null {
  if (!cards.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cards) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + cardWidth(c));
    y1 = Math.max(y1, c.y + cardHeight(c));
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The view that shows a box (prototype fitRect): 40 px padding, and on wide screens the bottom-right overview panel
 * is kept clear. An empty canvas gets 100 % at (40, 40).
 */
export function fitViewport(bounds: Rect | null, screen: { width: number; height: number }, overviewOpen: boolean): Viewport {
  if (!bounds) return { x: 40, y: 40, zoom: 1 };
  const pad = 40;
  const padRight = overviewOpen && screen.width > 700 ? 250 : pad;
  const aw = Math.max(1, screen.width - pad - padRight);
  const ah = Math.max(1, screen.height - pad * 2);
  const zoom = clamp(Math.min(aw / Math.max(1, bounds.w), ah / Math.max(1, bounds.h)), MIN_ZOOM, FIT_MAX_ZOOM);
  return { zoom, x: pad + (aw - bounds.w * zoom) / 2 - bounds.x * zoom, y: pad + (ah - bounds.h * zoom) / 2 - bounds.y * zoom };
}

/** Zooming by a factor around the middle of the screen (prototype zoomBy), within 10–300 %. */
export function zoomAround(v: Viewport, factor: number, screen: { width: number; height: number }): Viewport {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const mx = screen.width / 2, my = screen.height / 2;
  return { zoom, x: mx - ((mx - v.x) * zoom) / v.zoom, y: my - ((my - v.y) * zoom) / v.zoom };
}
