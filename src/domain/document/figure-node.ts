// A figure as content-tree nodes (slice 27, F3): its drawing (`figure.ts`) laid out on the document's page (`page.ts`),
// or the line that stands in for it: "(canvas no longer exists)", "(frame no longer exists)" (D11), "Nothing from this
// canvas is in the document's scope.". Shared by every section that draws figures (InfoDocumenter's and a module's,
// the star diagram in step 3), so none of them copies the rule. Pure.

import type { Uuid } from "../ids";
import { muted, warn } from "./blocks";
import type { DocFigure, DocNode } from "./content";
import { figureDrawing, type FigureInput, type FigureSpec } from "./figure";
import { figureLayout, figureSummary, type FigureLayout, type FigureOrientation, type FigureSize } from "./page";
import type { FigurePage, PlacedCard, SectionFigures } from "./sections";
import { DEFAULT_CANVAS_LOOK, type Canvas, type CanvasItem } from "../types";

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

// ---- slice 27, step 3: a section's figures (`SectionBuildInput.figures`) ----

const STAMP = "1970-01-01T00:00:00.000Z";
const PLACED_ID = "00000000-0000-7000-8000-0000000000f1";

/** A canvas row in memory for a placed figure (never stored): names as the model's, its look the default. */
function placedCanvas(workspaceId: Uuid, name: string): Canvas {
  return { id: PLACED_ID, workspace_id: workspaceId, version: 1, created_at: STAMP, created_by: PLACED_ID, updated_at: STAMP, updated_by: PLACED_ID, deleted_at: null, name, live_label_id: null, look: { ...DEFAULT_CANVAS_LOOK }, entity_names: null, attribute_names: null };
}

function placedItems(workspaceId: Uuid, cards: readonly PlacedCard[]): CanvasItem[] {
  return cards.map((c, i) => ({
    id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
    workspace_id: workspaceId,
    version: 1,
    created_at: STAMP,
    created_by: PLACED_ID,
    updated_at: STAMP,
    updated_by: PLACED_ID,
    deleted_at: null,
    canvas_id: PLACED_ID,
    entity_id: c.entityId,
    source_table_id: null,
    requirement_id: null,
    x: c.x,
    y: c.y,
    width: c.width,
    collapsed: false,
    row_filter: c.rowFilter,
    frame_id: null,
    live_level: null,
    entity_names: null,
    attribute_names: null,
  }));
}

/**
 * How a section draws figures (`SectionFigures`), from the document's figure input, page and words: its stored figures
 * (`list`), and figures of cards it placed itself (`placed`, the star diagram) as a canvas in memory with only those
 * cards. Pure.
 */
export function sectionFigures(input: FigureInput, page: FigurePage, words: FigureNodeWords): SectionFigures {
  return {
    list(entries, o = {}) {
      const drawnWith: FigureInput = o.notation ? { ...input, notation: o.notation } : input;
      const out: DocNode[] = [];
      let last: string | null = null;
      for (const f of entries) {
        if (!f.on) continue;
        if (o.canvasHeadings) {
          const canvas = input.snapshot.canvases.find((c) => c.id === f.canvasId);
          if (canvas && canvas.id !== last) out.push({ kind: "heading", level: 2, text: canvas.name });
          last = canvas?.id ?? null;
        }
        out.push(
          ...figureNodes(drawnWith, page, words, {
            key: f.id,
            entryId: f.id,
            spec: { canvasId: f.canvasId, frameId: f.frameId, view: f.view, rows: f.rows, lines: f.lines, status: f.status },
            size: f.size,
            orientation: f.orientation,
            caption: f.caption,
            ...(o.warnPt ? { smallestPt: o.warnPt } : {}),
          }).nodes,
        );
      }
      return out;
    },
    placed(f) {
      const workspaceId = input.snapshot.model.concepts[0]?.workspace_id ?? PLACED_ID;
      const canvas = placedCanvas(workspaceId, f.label);
      const snapshot = { ...input.snapshot, canvases: [canvas], frames: [], canvasItems: placedItems(workspaceId, f.items) };
      const { nodes } = figureNodes({ ...input, snapshot }, page, words, {
        key: f.key,
        entryId: f.key,
        spec: { canvasId: canvas.id, frameId: null, view: "custom", rows: "canvas", lines: f.lines, status: f.status },
        size: f.size,
        orientation: f.orientation,
        caption: f.caption,
      });
      return nodes.map((n) => (n.kind === "figure" ? { kind: "figure", figure: { ...n.figure, label: f.label } } : n));
    },
  };
}
