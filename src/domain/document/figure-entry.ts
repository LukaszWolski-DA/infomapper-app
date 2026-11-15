// A section's figure as stored in its options (slice 27, F8; the prototype's `FIG0`): a canvas or one of its frames,
// its view, size, orientation and caption. In InfoMapper's domain because any section may hold figures, a module's too
// (InfoCube's "Figures from canvases"), and modules never import each other (AD-33). Every field has the prototype's
// default, so a figure stored before a field was added keeps parsing.

import { z } from "zod";
import { FIGURE_ROWS, FIGURE_VIEWS } from "./figure";
import { FIGURE_ORIENTATIONS, FIGURE_SIZES } from "./page";

/** The most figures a section holds (as the 50 sections, D10). */
export const FIGURES_MAX = 50;
export const FIGURES_REFUSAL = "A section holds at most 50 figures.";
/** The longest caption (a heading's length). */
export const CAPTION_MAX = 200;

const figureLines = z.object({ rel: z.boolean(), map: z.boolean(), src: z.boolean(), cube: z.boolean() }).strict();

/** One figure of a section (F8): a canvas or one of its frames, its view, size, orientation and caption. */
export const figureEntry = z
  .object({
    id: z.string().min(1).max(64),
    on: z.boolean().default(true),
    canvasId: z.string().min(1).max(64),
    frameId: z.string().min(1).max(64).nullable().default(null),
    view: z.enum(FIGURE_VIEWS).default("canvas"),
    rows: z.enum(FIGURE_ROWS).default("canvas"),
    lines: figureLines.default({ rel: true, map: true, src: true, cube: true }),
    status: z.boolean().default(true),
    size: z.enum(FIGURE_SIZES).default("auto"),
    orientation: z.enum(FIGURE_ORIENTATIONS).default("doc"),
    caption: z.string().trim().max(CAPTION_MAX, "This caption is too long.").default(""),
  })
  .strict();
export type FigureEntry = z.output<typeof figureEntry>;

/** A section's figures: at most 50, each once. */
export const figureList = z
  .array(figureEntry)
  .max(FIGURES_MAX, FIGURES_REFUSAL)
  .refine((l) => new Set(l.map((f) => f.id)).size === l.length, "Each figure is listed once.");

/** What a figure draws apart from its canvas: the view, rows, line kinds and status marks (a preset's Diagrams, D9). */
export type FigureLook = Pick<FigureEntry, "view" | "rows" | "lines" | "status">;

/** A new figure of a canvas or a frame, as the prototype's `FIG0`: as on the canvas, whole, as large as fits. */
export const newFigure = (id: string, canvasId: string, frameId: string | null = null, look?: Partial<FigureLook>): FigureEntry => ({
  id,
  on: true,
  canvasId,
  frameId,
  view: "canvas",
  rows: "canvas",
  lines: { rel: true, map: true, src: true, cube: true },
  status: true,
  size: "auto",
  orientation: "doc",
  caption: "",
  ...structuredClone(look ?? {}),
});
