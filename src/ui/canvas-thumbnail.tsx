// A canvas's thumbnail in a tile's strip (slice 12b, PRD P2, P5; prototype `thumb`): the drawing of
// `src/domain/model/thumbnail.ts` as static SVG, rendered on the server and handed to the (client) tile as a slot. No
// hooks, no client code, no layout read: the strip has a fixed height and the SVG fills it, keeping the proportions.
// Colour roles become the palette's tokens (light and dark), a stored concept colour stays as it is; the opacities are
// the prototype's. Decorative: the tile's name stays its accessible name.

import type { CSSProperties } from "react";
import type { ThumbnailColor, ThumbnailDrawing, ThumbnailPath } from "@/domain/model/thumbnail";
import { NOTE_MINI } from "./note-colors";

/** A role's colour: a stored `#RRGGBB` as it is, the others from the palette. */
function colorOf(color: ThumbnailColor): string {
  if (color === null) return "var(--im-map)";
  if (color.startsWith("#")) return color;
  if (color === "physical") return "var(--im-physical)";
  if (color === "req") return "var(--im-req)";
  return NOTE_MINI[color as keyof typeof NOTE_MINI];
}

/** How each kind is painted (prototype `thumb`; stroke widths in the drawing's 400 units, about a pixel in the strip). */
function paintOf(p: ThumbnailPath): CSSProperties {
  const c = colorOf(p.color);
  switch (p.kind) {
    case "frame":
      return { fill: c, fillOpacity: 0.08, stroke: c, strokeOpacity: 0.6, strokeWidth: 1.8 };
    case "block":
      return { fill: c, fillOpacity: 0.4, stroke: c, strokeOpacity: 0.6, strokeWidth: 1.8 };
    case "line":
      return { fill: "none", stroke: c, strokeOpacity: 0.6, strokeWidth: 2.2 };
    case "table":
      return { fill: c, fillOpacity: 0.55 };
    case "entity":
      return { fill: c, fillOpacity: 0.65 };
    case "requirement":
      return { fill: c, fillOpacity: 0.85 };
    default:
      return { fill: c };
  }
}

export function CanvasThumbnail({ drawing }: { drawing: ThumbnailDrawing | null }) {
  if (!drawing) {
    return (
      <span aria-hidden className="grid size-full place-items-center text-[13px] text-im-ink-3" data-testid="tile-thumbnail-empty">
        Empty canvas
      </span>
    );
  }
  return (
    <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden className="block size-full" data-testid="tile-thumbnail">
      {drawing.paths.map((p, i) => (
        <path key={i} data-kind={p.kind} data-color={p.color ?? undefined} d={p.d} style={paintOf(p)} />
      ))}
    </svg>
  );
}
