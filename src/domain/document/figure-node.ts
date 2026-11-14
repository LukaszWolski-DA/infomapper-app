// A figure as content-tree nodes (slice 27, F3): its drawing (`figure.ts`) laid out on the document's page (`page.ts`),
// or the line that stands in for it: "(canvas no longer exists)", "(frame no longer exists)" (D11), "Nothing from this
// canvas is in the document's scope.". Shared by every section that draws figures (InfoDocumenter's and a module's,
// the star diagram in step 3), so none of them copies the rule. Pure.

import type { Uuid } from "../ids";
import { muted, warn } from "./blocks";
import type { DocFigure, DocNode } from "./content";
import { figureDrawing, type FigureInput, type FigureSpec } from "./figure";
import { figureLayout, figureSummary, type FigureLayout, type FigureOrientation, type FigureSize } from "./page";
import type { FigurePage } from "./sections";

/** The document's words around a figure, in its language. */
export interface FigureNodeWords {
  /** "Figure". */
  readonly figure: string;
  /** "part {i} of {n}". */
  readonly part: (i: number, n: number) => string;
  readonly empty: string;
  readonly noCanvas: string;
  readonly noFrame: string;
}

export interface FigureNodeInput {
  /** Unique in the document: `{section id}:{figure id}`. */
  readonly key: string;
  readonly entryId: string;
  readonly spec: FigureSpec;
  readonly size: FigureSize;
  readonly orientation: FigureOrientation;
  /** The caption typed, or empty for the figure's name. */
  readonly caption: string;
  /** The smallest names the figure's warning reads, when its section sets its own; else the style's. */
  readonly smallestPt?: number;
}

/** A figure's name: "{canvas}" or "{canvas} · {frame}", or the line saying it is gone (D11). */
export function figureName(snapshot: FigureInput["snapshot"], spec: Pick<FigureSpec, "canvasId" | "frameId">, words: Pick<FigureNodeWords, "noCanvas" | "noFrame">): string {
  const canvas = snapshot.canvases.find((c) => c.id === spec.canvasId);
  if (!canvas) return words.noCanvas;
  if (!spec.frameId) return canvas.name;
  const frame = snapshot.frames.find((f) => f.id === spec.frameId && f.canvas_id === canvas.id);
  return `${canvas.name} · ${frame ? frame.name : words.noFrame}`;
}

/**
 * A figure's nodes and its layout (null when it is not drawn): the figure node, or the line in its place. Its number is
 * 0 until `buildDocument` numbers the document's figures.
 */
export function figureNodes(input: FigureInput, page: FigurePage, words: FigureNodeWords, f: FigureNodeInput): { nodes: DocNode[]; layout: FigureLayout | null } {
  const drawing = figureDrawing(input, f.spec);
  if (drawing.kind === "gone") return { nodes: [{ kind: "paragraph", runs: [warn(figureName(input.snapshot, f.spec, words))] }], layout: null };
  if (drawing.kind === "empty") return { nodes: [{ kind: "paragraph", runs: [muted(words.empty)] }], layout: null };
  const layout = figureLayout(drawing.box, drawing.rects, page, f.size, f.orientation, page.smallestPt);
  const n = layout.parts.length;
  const figure: DocFigure = {
    key: f.key,
    entryId: f.entryId,
    number: 0,
    word: words.figure,
    caption: f.caption.trim() || figureName(input.snapshot, f.spec, words),
    svg: drawing.svg,
    faces: drawing.faces,
    rot: layout.rot,
    parts: layout.parts.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, wmm: p.wmm, hmm: p.hmm })),
    partTexts: n > 1 ? layout.parts.map((_, i) => words.part(i + 1, n)) : [],
    summary: figureSummary([layout], f.smallestPt ?? page.smallestPt),
  };
  return { nodes: [{ kind: "figure", figure }], layout };
}

/** The canvases and frames a figure may show, as a section's figure editor offers them: by canvas, then its frames. */
export function figureSources(snapshot: FigureInput["snapshot"]): { canvasId: Uuid; frameId: Uuid | null; name: string }[] {
  return snapshot.canvases.flatMap((c) => [
    { canvasId: c.id, frameId: null, name: c.name },
    ...snapshot.frames.filter((f) => f.canvas_id === c.id).map((f) => ({ canvasId: c.id, frameId: f.id, name: f.name })),
  ]);
}
