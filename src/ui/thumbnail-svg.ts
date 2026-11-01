// A canvas thumbnail's drawing as the file the tiles refer to (slice 12b, PRD P5; prototype `thumb`): one `<symbol
// id="t">` with one `<path>` per kind and colour. A tile draws it through an external `<use>`, whose shapes inherit the
// page's custom properties, so the colour roles are written as the palette's tokens (`var(--im-physical)` and so on)
// and follow light and dark mode with no copy of their values. A stored concept or frame colour is written only in the
// shape `#RRGGBB`; note colours come from `NOTE_MINI`. The opacities and strokes are the prototype's; the stroke widths
// are in the drawing's 400 units, about a pixel in the strip.

import type { ThumbnailColor, ThumbnailDrawing, ThumbnailPath } from "@/domain/model/thumbnail";
import { NO_CONCEPT_COLOR } from "@/domain/model/concept-colors";
import { NOTE_MINI } from "./note-colors";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The role as written: a known role, or a stored colour in the shape `#RRGGBB`; anything else the neutral colour. */
const safeRole = (c: ThumbnailColor): ThumbnailColor =>
  c === null || c === "physical" || c === "req" || Object.hasOwn(NOTE_MINI, c) || HEX.test(c) ? c : NO_CONCEPT_COLOR;

/** A role's colour: a stored colour as it is, the others from the palette. */
function colorOf(color: ThumbnailColor): string {
  const c = safeRole(color);
  if (c === null) return "var(--im-map)";
  if (c === "physical") return "var(--im-physical)";
  if (c === "req") return "var(--im-req)";
  if (Object.hasOwn(NOTE_MINI, c)) return NOTE_MINI[c as keyof typeof NOTE_MINI];
  return c;
}

/** How each kind is painted (prototype `thumb`). */
function paintOf(p: ThumbnailPath): string {
  const c = colorOf(p.color);
  switch (p.kind) {
    case "frame":
      return `fill:${c};fill-opacity:.08;stroke:${c};stroke-opacity:.6;stroke-width:1.8`;
    case "block":
      return `fill:${c};fill-opacity:.4;stroke:${c};stroke-opacity:.6;stroke-width:1.8`;
    case "line":
      return `fill:none;stroke:${c};stroke-opacity:.6;stroke-width:2.2`;
    case "table":
      return `fill:${c};fill-opacity:.55`;
    case "entity":
      return `fill:${c};fill-opacity:.65`;
    case "requirement":
      return `fill:${c};fill-opacity:.85`;
    default:
      return `fill:${c}`;
  }
}

/** The fragment a tile's `<use>` points at. */
export const THUMBNAIL_SYMBOL = "t";

/** The SVG file of a drawing; an empty canvas gives an empty symbol. Paths carry their kind and colour role for tests. */
export function thumbnailSymbolFile(drawing: ThumbnailDrawing | null): string {
  const box = drawing ? `0 0 ${drawing.width} ${drawing.height}` : "0 0 1 1";
  const paths = (drawing?.paths ?? [])
    .map((p) => {
      const role = safeRole(p.color);
      const color = role === null ? "" : ` data-color="${role}"`;
      return `<path data-kind="${p.kind}"${color} d="${p.d}" style="${paintOf(p)}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="${THUMBNAIL_SYMBOL}" viewBox="${box}" preserveAspectRatio="xMidYMid meet">${paths}</symbol></svg>`;
}
