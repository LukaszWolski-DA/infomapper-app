"use client";

// Slice 2p, step 1: a trial line renderer on one HTML <canvas> (AD-24 names it), behind the measurement-only switch
// `?diag=canvaslines`; users never see it. It draws what the SVG line layer draws, from the same geometry
// (`line-geometry.ts`, `relGeom`): mapping lines with their status, colour, end dots above 40 % and ƒ nodes;
// relationship lines with crow's foot or UML ends and labels; the fade of other lines on a selection; the hovered
// row's lines drawn again above the others. No interaction yet (step 2): clicks go to the pane as before.
// The canvas covers the visible area and is redrawn on every pan, zoom or change (never scaled as a bitmap); the line
// shapes are kept between frames and rebuilt only when cards, lines or the notation change.
// Step 1b: the browser's raster of the strokes was the cost, not the script (2-4 ms per redraw); lines of one colour,
// dash, width and alpha are drawn with one stroke, circles of one style with one fill, and lines outside the view are
// skipped. Colours are read once and again only on a theme or look change.

import { useContext, useEffect, useRef } from "react";
import { useStoreApi, type InternalNode } from "@xyflow/react";
import { CanvasUiCtx, type Notation } from "./context";
import { cardRect, ieMarker, LOD_ZOOM, multText, relGeom, umlMarker, type Pt } from "./geometry";
import type { CanvasLines, MapLineData, Related, Selection } from "./line-data";
import { mapGeom, placedOf } from "./line-geometry";
import { useCanvasLook } from "./look";

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface MapShape {
  id: string;
  line: MapLineData;
  box: Box;
  paths: Path2D[];
  dots: [number, number][];
  chip: { x: number; y: number; text: string } | null;
  part: boolean;
}
interface RelShape {
  id: string;
  box: Box;
  path: Path2D;
  marks: Path2D | null;
  circles: Pt[];
  mult: { x: number; y: number; text: string }[];
  label: { x: number; y: number; text: string; w: number } | null;
}
interface Shapes {
  maps: MapShape[];
  rels: RelShape[];
}

interface Palette {
  map: string;
  warn: string;
  rel: string;
  canvas: string;
  surface: string;
  line: string;
  ink2: string;
  font: string;
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    map: v("--im-map"),
    warn: v("--im-warn"),
    rel: v("--im-rel"),
    canvas: v("--im-canvas"),
    surface: v("--im-surface"),
    line: v("--im-line"),
    ink2: v("--im-ink-2"),
    font: `${v("--font-plex-sans") || "system-ui"}, system-ui, sans-serif`,
  };
}

/** The box around every point of SVG path data (end and control points), grown by `pad`: it holds the drawn curve. */
function boxOf(ds: string[], pad: number, extra: Pt[] = []): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => {
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  };
  for (const d of ds) {
    const n = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) add(+n[i]!, +n[i + 1]!);
  }
  for (const p of extra) add(p.x, p.y);
  return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad };
}

function build(lines: CanvasLines, lookup: Map<string, InternalNode>, notation: Notation): Shapes {
  const rels: RelShape[] = [];
  for (const l of lines.relationships) {
    const a = placedOf(lookup.get(l.fromCardId)), z = placedOf(lookup.get(l.toCardId));
    if (!a || !z) continue;
    const g = relGeom(cardRect(a), cardRect(z), l.offset);
    // the ends and the label reach up to about 30 units past the curve
    const shape: RelShape = { id: l.id, box: boxOf([g.d], 30), path: new Path2D(g.d), marks: null, circles: [], mult: [], label: null };
    if (notation === "ie") {
      const ma = ieMarker(g.pa, g.na, l.fromMin, l.fromMax), mb = ieMarker(g.pb, g.nb, l.toMin, l.toMax);
      shape.marks = new Path2D(ma.d + mb.d);
      for (const c of [ma.circle, mb.circle]) if (c) shape.circles.push(c);
    } else {
      const ma = umlMarker(g.pa, g.na), mb = umlMarker(g.pb, g.nb);
      shape.mult = [
        { ...ma, text: multText(l.fromMin, l.fromMax) },
        { ...mb, text: multText(l.toMin, l.toMax) },
      ];
    }
    if (l.label) {
      shape.label = { x: g.mid.x, y: g.mid.y, text: l.label, w: l.label.length * 6.1 + 14 };
      shape.box = boxOf([g.d], 30, [{ x: g.mid.x - shape.label.w / 2, y: g.mid.y }, { x: g.mid.x + shape.label.w / 2, y: g.mid.y }]);
    }
    rels.push(shape);
  }
  const maps: MapShape[] = [];
  for (const l of lines.mappings) {
    const geom = mapGeom(l, lookup);
    if (!geom) continue;
    maps.push({ id: l.id, line: l, box: boxOf(geom.paths, 10), paths: geom.paths.map((d) => new Path2D(d)), dots: geom.dots, chip: geom.chip, part: geom.part });
  }
  return { maps, rels };
}

const DASH: Record<string, number[]> = { draft: [6, 4], review: [10, 3, 2, 3] };

interface PaintState {
  selection: Selection;
  related: Related | null;
  hover: Related | null;
  dots: boolean;
}

/** One stroke for all lines of the same colour, dash, width and alpha (step 1b: far fewer draw calls). */
class Batches {
  private strokes = new Map<string, { colour: string; width: number; dash: number[]; alpha: number; path: Path2D }>();
  stroke(colour: string, width: number, dash: number[], alpha: number, path: Path2D) {
    const key = `${colour}|${width}|${dash.join(",")}|${alpha}`;
    let b = this.strokes.get(key);
    if (!b) this.strokes.set(key, (b = { colour, width, dash, alpha, path: new Path2D() }));
    b.path.addPath(path);
  }
  flush(ctx: CanvasRenderingContext2D) {
    for (const b of this.strokes.values()) {
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = b.colour;
      ctx.lineWidth = b.width;
      ctx.setLineDash(b.dash);
      ctx.stroke(b.path);
    }
    ctx.setLineDash([]);
    this.strokes.clear();
  }
}

/** Circles of one fill, outline and alpha in one path (end dots, ƒ nodes, optional ends). */
class Circles {
  private groups = new Map<string, { fill: string; stroke: string | null; width: number; alpha: number; path: Path2D }>();
  add(fill: string, stroke: string | null, width: number, alpha: number, x: number, y: number, r: number) {
    const key = `${fill}|${stroke}|${width}|${alpha}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { fill, stroke, width, alpha, path: new Path2D() }));
    g.path.moveTo(x + r, y);
    g.path.arc(x, y, r, 0, Math.PI * 2);
  }
  flush(ctx: CanvasRenderingContext2D) {
    for (const g of this.groups.values()) {
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = g.fill;
      ctx.fill(g.path);
      if (g.stroke) {
        ctx.strokeStyle = g.stroke;
        ctx.lineWidth = g.width;
        ctx.stroke(g.path);
      }
    }
    this.groups.clear();
  }
}

interface Text {
  text: string;
  x: number;
  y: number;
  font: string;
  colour: string;
  alpha: number;
}

function drawTexts(ctx: CanvasRenderingContext2D, texts: Text[]) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of texts) {
    ctx.globalAlpha = t.alpha;
    ctx.font = t.font;
    ctx.fillStyle = t.colour;
    ctx.fillText(t.text, t.x, t.y);
  }
  texts.length = 0;
}

const NO_DASH: number[] = [];
const inView = (b: Box, v: Box) => b.x1 >= v.x0 && b.x0 <= v.x1 && b.y1 >= v.y0 && b.y0 <= v.y1;

/**
 * Draws the visible lines: relationships first (lines, ends, labels), then mappings (lines, end dots, ƒ nodes), then
 * the hovered row's lines again, in the SVG layer's order. Lines outside the view are skipped.
 */
function paint(ctx: CanvasRenderingContext2D, shapes: Shapes, p: Palette, s: PaintState, view: Box) {
  const dimmed = (kind: "map" | "rel", id: string) => !!s.related && !(kind === "map" ? s.related.maps : s.related.rels).has(id);
  const selected = (kind: "map" | "rel", id: string) => s.selection?.t === kind && s.selection.id === id;
  const strokes = new Batches(), circles = new Circles();
  const texts: Text[] = [];
  const labels: { x: number; y: number; w: number; text: string; alpha: number }[] = [];

  for (const r of shapes.rels) {
    if (!inView(r.box, view)) continue;
    const sel = selected("rel", r.id), alpha = dimmed("rel", r.id) ? 0.12 : 1;
    strokes.stroke(p.rel, sel ? 3 : 1.6, NO_DASH, alpha, r.path);
    if (r.marks) strokes.stroke(p.rel, sel ? 2.4 : 1.6, NO_DASH, alpha, r.marks);
    for (const c of r.circles) circles.add(p.canvas, p.rel, sel ? 2.4 : 1.6, alpha, c.x, c.y, 4);
    for (const m of r.mult) texts.push({ ...m, font: `500 11px ${p.font}`, colour: p.ink2, alpha });
    if (r.label) labels.push({ ...r.label, alpha });
  }
  strokes.flush(ctx);
  circles.flush(ctx);
  for (const l of labels) {
    ctx.globalAlpha = l.alpha;
    ctx.beginPath();
    ctx.roundRect(l.x - l.w / 2, l.y - 9, l.w, 18, 9);
    ctx.fillStyle = p.canvas;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.line;
    ctx.stroke();
    texts.push({ text: l.text, x: l.x, y: l.y, font: `500 11px ${p.font}`, colour: p.ink2, alpha: l.alpha });
  }
  drawTexts(ctx, texts);

  const addMap = (m: MapShape, width: number, alpha: number, hovered: boolean) => {
    const colour = m.line.warn ? p.warn : p.map;
    // a line whose row end is hidden is drawn at 45 %; the fade of a selection wins (canvas.css); not when hovered
    const lineAlpha = alpha === 1 && m.part && !hovered ? 0.45 : alpha;
    for (const path of m.paths) strokes.stroke(colour, width, DASH[m.line.status] ?? NO_DASH, lineAlpha, path);
    if (s.dots) for (const [x, y] of m.dots) circles.add(colour, null, 0, alpha, x, y, 2.6);
    if (m.chip) {
      circles.add(p.surface, colour, 1.4, alpha, m.chip.x, m.chip.y, 8);
      texts.push({ text: m.chip.text, x: m.chip.x, y: m.chip.y, font: `600 10px ${p.font}`, colour, alpha });
    }
  };
  const flushMaps = () => {
    strokes.flush(ctx);
    circles.flush(ctx);
    drawTexts(ctx, texts);
  };
  for (const m of shapes.maps) if (inView(m.box, view)) addMap(m, selected("map", m.id) ? 3 : 1.6, dimmed("map", m.id) ? 0.12 : 1, false);
  flushMaps();
  // the hovered row's lines again, a little stronger, above the others (S1B-10)
  if (s.hover) {
    for (const m of shapes.maps) if (s.hover.maps.has(m.id) && inView(m.box, view)) addMap(m, 2.4, 1, true);
    flushMaps();
  }
  ctx.globalAlpha = 1;
}

export default function CanvasLineLayer({ lines, selection, related, hover }: { lines: CanvasLines; selection: Selection; related: Related | null; hover: Related | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const storeApi = useStoreApi();
  const { notation } = useContext(CanvasUiCtx);
  const background = useCanvasLook()?.look.background;
  const props = useRef({ lines, selection, related, hover, notation });
  /** Set by the drawing effect: rebuild the shapes (cards, lines or notation changed) and draw on the next frame. */
  const redraw = useRef<(rebuild: boolean, recolour?: boolean) => void>(() => {});

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    let shapes: Shapes | null = null;
    let palette = readPalette(canvas);
    // step 1b profile: each redraw's time (shape rebuild and paint), read by the measuring probe
    const stats: { draws: { build: number; paint: number; at: number }[] } = { draws: [] };
    (window as unknown as { __lineStats?: typeof stats }).__lineStats = stats;
    const draw = () => {
      frame = 0;
      const t0 = performance.now();
      const { width, height, transform: [tx, ty, z], nodeLookup } = storeApi.getState();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const p = props.current;
      if (!shapes) shapes = build(p.lines, nodeLookup, p.notation);
      const t1 = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * tx, dpr * ty);
      const view = { x0: -tx / z, y0: -ty / z, x1: (width - tx) / z, y1: (height - ty) / z };
      paint(ctx, shapes, palette, { selection: p.selection, related: p.related, hover: p.hover, dots: z >= LOD_ZOOM }, view);
      // test hook (measurement build only, like this renderer): how many lines are drawn
      canvas.dataset.drawn = String(shapes.maps.length + shapes.rels.length);
      const t2 = performance.now();
      stats.draws.push({ build: t1 - t0, paint: t2 - t1, at: t0 });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    redraw.current = (rebuild, recolour) => {
      if (rebuild) shapes = null;
      if (recolour) palette = readPalette(canvas);
      schedule();
    };
    const unsubscribe = storeApi.subscribe((s, prev) => {
      if (s.nodes !== prev.nodes) shapes = null;
      if (s.nodes !== prev.nodes || s.transform !== prev.transform || s.width !== prev.width || s.height !== prev.height) schedule();
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => redraw.current(false, true);
    media.addEventListener("change", onTheme);
    schedule();
    return () => {
      unsubscribe();
      media.removeEventListener("change", onTheme);
      cancelAnimationFrame(frame);
    };
  }, [storeApi]);

  useEffect(() => {
    const before = props.current;
    props.current = { lines, selection, related, hover, notation };
    redraw.current(before.lines !== lines || before.notation !== notation);
  }, [lines, selection, related, hover, notation]);

  useEffect(() => redraw.current(false, true), [background]);

  return <canvas ref={ref} className="im-line-canvas" data-testid="layer-lines-canvas" aria-hidden />;
}
