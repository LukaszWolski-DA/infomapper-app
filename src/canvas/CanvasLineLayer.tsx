"use client";

// Slice 2p, step 1: a trial line renderer on one HTML <canvas> (AD-24 names it), behind the measurement-only switch
// `?diag=canvaslines`; users never see it. It draws what the SVG line layer draws, from the same geometry
// (`line-geometry.ts`, `relGeom`): mapping lines with their status, colour, end dots above 40 % and ƒ nodes;
// relationship lines with crow's foot or UML ends and labels; the fade of other lines on a selection; the hovered
// row's lines drawn again above the others. No interaction yet (step 2): clicks go to the pane as before.
// The canvas covers the visible area and is redrawn on every pan, zoom or change (never scaled as a bitmap); the line
// shapes are kept between frames and rebuilt only when cards, lines or the notation change.

import { useContext, useEffect, useRef } from "react";
import { useStoreApi, type InternalNode } from "@xyflow/react";
import { CanvasUiCtx, type Notation } from "./context";
import { cardRect, ieMarker, LOD_ZOOM, multText, relGeom, umlMarker, type Pt } from "./geometry";
import type { CanvasLines, MapLineData, Related, Selection } from "./line-data";
import { mapGeom, placedOf } from "./line-geometry";
import { useCanvasLook } from "./look";

interface MapShape {
  id: string;
  line: MapLineData;
  paths: Path2D[];
  dots: [number, number][];
  chip: { x: number; y: number; text: string } | null;
  part: boolean;
}
interface RelShape {
  id: string;
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

function build(lines: CanvasLines, lookup: Map<string, InternalNode>, notation: Notation): Shapes {
  const rels: RelShape[] = [];
  for (const l of lines.relationships) {
    const a = placedOf(lookup.get(l.fromCardId)), z = placedOf(lookup.get(l.toCardId));
    if (!a || !z) continue;
    const g = relGeom(cardRect(a), cardRect(z), l.offset);
    const shape: RelShape = { id: l.id, path: new Path2D(g.d), marks: null, circles: [], mult: [], label: null };
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
    if (l.label) shape.label = { x: g.mid.x, y: g.mid.y, text: l.label, w: l.label.length * 6.1 + 14 };
    rels.push(shape);
  }
  const maps: MapShape[] = [];
  for (const l of lines.mappings) {
    const geom = mapGeom(l, lookup);
    if (!geom) continue;
    maps.push({ id: l.id, line: l, paths: geom.paths.map((d) => new Path2D(d)), dots: geom.dots, chip: geom.chip, part: geom.part });
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

function paint(ctx: CanvasRenderingContext2D, shapes: Shapes, p: Palette, s: PaintState) {
  const dimmed = (kind: "map" | "rel", id: string) => !!s.related && !(kind === "map" ? s.related.maps : s.related.rels).has(id);
  const selected = (kind: "map" | "rel", id: string) => s.selection?.t === kind && s.selection.id === id;

  for (const r of shapes.rels) {
    const sel = selected("rel", r.id);
    ctx.globalAlpha = dimmed("rel", r.id) ? 0.12 : 1;
    ctx.setLineDash([]);
    ctx.strokeStyle = p.rel;
    ctx.lineWidth = sel ? 3 : 1.6;
    ctx.stroke(r.path);
    ctx.lineWidth = sel ? 2.4 : 1.6;
    if (r.marks) ctx.stroke(r.marks);
    for (const c of r.circles) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.canvas;
      ctx.fill();
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 11px ${p.font}`;
    ctx.fillStyle = p.ink2;
    for (const m of r.mult) ctx.fillText(m.text, m.x, m.y);
    if (r.label) {
      const { x, y, w, text } = r.label;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 9, w, 18, 9);
      ctx.fillStyle = p.canvas;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = p.line;
      ctx.stroke();
      ctx.fillStyle = p.ink2;
      ctx.fillText(text, x, y);
    }
  }

  const drawMap = (m: MapShape, width: number, alpha: number) => {
    const colour = m.line.warn ? p.warn : p.map;
    ctx.globalAlpha = alpha === 1 && m.part ? 0.45 : alpha;
    ctx.setLineDash(DASH[m.line.status] ?? []);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    for (const path of m.paths) ctx.stroke(path);
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;
    if (s.dots) {
      ctx.fillStyle = colour;
      for (const [x, y] of m.dots) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (m.chip) {
      ctx.beginPath();
      ctx.arc(m.chip.x, m.chip.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = p.surface;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = colour;
      ctx.stroke();
      ctx.font = `600 10px ${p.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colour;
      ctx.fillText(m.chip.text, m.chip.x, m.chip.y);
    }
  };
  for (const m of shapes.maps) drawMap(m, selected("map", m.id) ? 3 : 1.6, dimmed("map", m.id) ? 0.12 : 1);
  // the hovered row's lines again, a little stronger, above the others (S1B-10)
  if (s.hover) for (const m of shapes.maps) if (s.hover.maps.has(m.id)) drawMap(m, 2.4, 1);
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
    const draw = () => {
      frame = 0;
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * tx, dpr * ty);
      paint(ctx, shapes, palette, { selection: p.selection, related: p.related, hover: p.hover, dots: z >= LOD_ZOOM });
      // test hook (measurement build only, like this renderer): how many lines are drawn
      canvas.dataset.drawn = String(shapes.maps.length + shapes.rels.length);
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
