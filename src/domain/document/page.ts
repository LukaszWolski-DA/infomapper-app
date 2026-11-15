// A document's page geometry (slice 27, Q1, Q4, D12): the papers, the margins, the room a figure gets on a page, and how
// a figure is sized, turned and cut into parts there (the prototype's `pageBox` and `layoutFig`, with the app's margins:
// 18 mm, 20 mm at the bottom). In InfoMapper's domain: the documents' CSS and figures read it, and the canvas page's
// outline of pages (step 4) will, so they cannot disagree. Pure.

import type { Rect } from "@/domain/canvas/geometry";

/** The papers in millimetres, portrait (the prototype's `PAPER`). */
export const PAPER_MM = { A4: [210, 297], A3: [297, 420] } as const satisfies Record<string, readonly [number, number]>;
export type Paper = keyof typeof PAPER_MM;
/** The page's margin in millimetres (the prototype's `MARG`), and the app's bottom margin (Q4, D12). */
export const PAGE_MARGIN_MM = 18;
export const PAGE_BOTTOM_MM = 20;
/** One canvas pixel in millimetres at 100 % (96 dpi). */
export const MM_PER_PX = 25.4 / 96;
/** An attribute's name on a card is 12.5 px: 9.375 pt at 100 % (the prototype's `ROW_PT`). */
export const ROW_PT = 9.375;
/** What a figure's heading and caption keep off its page, in millimetres (the prototype's 20 + 12 + 16). */
const CAPTION_ROOM = 48;
/** A turned figure keeps its caption beside its own height (the prototype's 20 + 16). */
const TURNED_ROOM = 36;
/** Parts overlap their neighbours by this many canvas pixels (the prototype's `ov`). */
export const PART_OVERLAP = 16;

/** "Whole, as large as fits", "Whole, upright", "Page width, in parts", "100 %, 75 %, 50 %, in parts" (D1). */
export const FIGURE_SIZES = ["auto", "page", "width", "100", "75", "50"] as const;
export type FigureSize = (typeof FIGURE_SIZES)[number];
/** "As the document", "Portrait", "Landscape, turned". */
export const FIGURE_ORIENTATIONS = ["doc", "portrait", "landscape"] as const;
export type FigureOrientation = (typeof FIGURE_ORIENTATIONS)[number];
/** The style's smallest attribute names in diagrams (D1). */
export const SMALLEST_PT = [5, 6, 7, 8] as const;
export type SmallestPt = (typeof SMALLEST_PT)[number];

export interface PageStyle {
  readonly paper: Paper;
  readonly orientation: "portrait" | "landscape";
}

/** The page's width and height in millimetres. */
export function pageSize(style: PageStyle): { w: number; h: number } {
  const [w, h] = PAPER_MM[style.paper];
  return style.orientation === "landscape" ? { w: h, h: w } : { w, h };
}

/**
 * The room a figure gets on a page, in millimetres (the prototype's `pageBox`): `landscape` asks for it turned on the
 * page when the document is portrait (or upright on a landscape page); `rot`: it is drawn turned.
 */
export function figureBox(style: PageStyle, landscape: boolean): { rot: boolean; w: number; h: number } {
  const { w: W0, h: H0 } = pageSize(style);
  const rot = landscape !== (style.orientation === "landscape");
  const across = W0 - 2 * PAGE_MARGIN_MM, down = H0 - PAGE_MARGIN_MM - PAGE_BOTTOM_MM;
  return rot ? { rot, w: down - TURNED_ROOM, h: across } : { rot, w: across, h: down - CAPTION_ROOM };
}

/** One part of a figure on a page: its region of the figure (canvas pixels) and its size on the page (millimetres). */
export interface FigurePart extends Rect {
  readonly wmm: number;
  readonly hmm: number;
}

export interface FigureLayout {
  readonly parts: readonly FigurePart[];
  /** The figure is turned −90° on the page ("Landscape, turned", or "as large as fits" turning it). */
  readonly rot: boolean;
  /** The attribute names' size as drawn, in points (the smallest of its parts). */
  readonly pt: number;
  /** Their size were the figure whole on one page. */
  readonly wholePt: number;
}

const pt1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Where a figure goes on its pages (the prototype's `layoutFig`). "Whole" sizes are never cut and never drawn above
 * 100 %; "as large as fits" with the document's orientation turns the figure when upright names would be under the
 * smallest size and turned is more than 8 % larger. "In parts" sizes cut it into equal parts that overlap by 16 px;
 * a part with nothing drawn in it is left out.
 */
export function figureLayout(box: Rect, drawn: readonly Rect[], style: PageStyle, size: FigureSize, orientation: FigureOrientation, smallestPt: number): FigureLayout {
  const docLand = style.orientation === "landscape";
  const fit = (land: boolean) => {
    const b = figureBox(style, land);
    return { ...b, s: Math.min(1, b.w / (box.w * MM_PER_PX), b.h / (box.h * MM_PER_PX)), sW: Math.min(1, b.w / (box.w * MM_PER_PX)) };
  };
  let B = orientation === "landscape" ? fit(true) : orientation === "portrait" ? fit(false) : fit(docLand);
  if (size === "auto" && orientation === "doc" && ROW_PT * B.s < smallestPt) {
    const turned = fit(!docLand);
    if (turned.s > B.s * 1.08) B = turned;
  }
  const wholePt = pt1(ROW_PT * B.s);
  const inParts = size !== "auto" && size !== "page";
  const s = size === "width" ? B.sW : inParts ? Number(size) / 100 : B.s;
  const cols = inParts ? Math.max(1, Math.ceil((box.w * MM_PER_PX * s) / B.w - 0.001)) : 1;
  const rows = inParts ? Math.max(1, Math.ceil((box.h * MM_PER_PX * s) / B.h - 0.001)) : 1;
  const tw = box.w / cols, th = box.h / rows, ov = cols * rows > 1 ? PART_OVERLAP : 0;
  const parts: FigurePart[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = box.x + c * tw - (c ? ov : 0), y = box.y + r * th - (r ? ov : 0);
      const w = tw + (c ? ov : 0) + (c < cols - 1 ? ov : 0), h = th + (r ? ov : 0) + (r < rows - 1 ? ov : 0);
      const k = Math.min(s, B.w / (w * MM_PER_PX), B.h / (h * MM_PER_PX));
      const hit = cols * rows === 1 || drawn.some((q) => q.x < x + w - ov && q.x + q.w > x + ov && q.y < y + h - ov && q.y + q.h > y + ov);
      if (hit) parts.push({ x, y, w, h, wmm: w * MM_PER_PX * k, hmm: h * MM_PER_PX * k });
    }
  const minK = Math.min(...parts.map((p) => p.wmm / (p.w * MM_PER_PX)));
  return { parts, rot: B.rot, pt: pt1(ROW_PT * minK), wholePt };
}

/**
 * The editor's line under a figure or a section's figures (the prototype's `sumFig`): "{n} figure(s) [in {p} parts] ·
 * names {pt} pt [(whole on one page: {x} pt)] · upright | turned on the page | some turned on the page [· smaller than
 * {min} pt: try …]". English: the editor's language.
 */
export function figureSummary(layouts: readonly FigureLayout[], smallestPt: number): string {
  if (!layouts.length) return "";
  const parts = layouts.reduce((n, l) => n + l.parts.length, 0);
  const pt = Math.min(...layouts.map((l) => l.pt));
  const split = layouts.filter((l) => l.parts.length > 1);
  const turned = layouts.filter((l) => l.rot).length;
  return (
    `${layouts.length} figure${layouts.length > 1 ? "s" : ""}${parts > layouts.length ? ` in ${parts} parts` : ""} · names ${pt} pt` +
    (split.length ? ` (whole on one page: ${Math.min(...split.map((l) => l.wholePt))} pt)` : "") +
    ` · ${turned ? (turned === layouts.length ? "turned on the page" : "some turned on the page") : "upright"}` +
    (pt < smallestPt ? ` · smaller than ${smallestPt} pt: try one figure per frame, A3 paper, or the page outline on the canvas` : "")
  );
}

// ---- slice 27, step 4: the page outline on the canvas (Q6; the prototype's `pageArea`) ----

/** The canvas's page outline as its look stores it: the paper, the page's orientation, the smallest names. */
export interface OutlineSpec {
  readonly paper: Paper;
  readonly orientation: "portrait" | "landscape";
  readonly pt: number;
}

/** One page of the outline, in canvas pixels; `n` from 1, row by row. */
export interface OutlinePage extends Rect {
  readonly n: number;
}

/**
 * The pages a whole canvas takes at a paper, orientation and size of the attribute names: the figure's room on such a
 * page (`figureBox`, upright) at the scale that draws the names at `pt`, laid from the figure's box's top left, row by
 * row, as many as cover the box. Pure.
 */
export function outlinePages(box: Rect, spec: OutlineSpec): { pages: OutlinePage[]; cols: number; rows: number } {
  const room = figureBox(spec, spec.orientation === "landscape");
  const s = spec.pt / ROW_PT;
  const w = room.w / (MM_PER_PX * s), h = room.h / (MM_PER_PX * s);
  const cols = Math.max(1, Math.ceil(box.w / w - 0.001)), rows = Math.max(1, Math.ceil(box.h / h - 0.001));
  const pages: OutlinePage[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pages.push({ n: r * cols + c + 1, x: box.x + c * w, y: box.y + r * h, w, h });
  return { pages, cols, rows };
}

/**
 * A page's label on the canvas (the prototype's, the app's language): page 1 "{A4} {portrait} at {7} pt · fits on one
 * page" or "… · needs {n} pages: move cards into page 1 to keep it whole"; the others "page {n}".
 */
export function outlineLabel(spec: OutlineSpec, n: number, total: number): string {
  if (n > 1) return `page ${n}`;
  return `${spec.paper} ${spec.orientation} at ${spec.pt} pt · ${total === 1 ? "fits on one page" : `needs ${total} pages: move cards into page 1 to keep it whole`}`;
}
