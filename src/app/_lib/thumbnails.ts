import "server-only";
// The canvas thumbnails' addresses (slice 12b, PRD P5): a home page computes each canvas's drawing from the rows it
// reads anyway and puts a key of it into the address its tile refers to, so a change or an undo gives a new address,
// and an address that stays the same may be cached for good. The route computes the same drawing and key.

import { createHash } from "node:crypto";
import type { Uuid } from "@/domain/ids";
import { canvasThumbnails, thumbnailDrawing, thumbnailIndex, type CanvasRows, type ThumbnailDrawing } from "@/domain/model/thumbnail";
import type { Canvas, LabelLink, WorkspaceModel } from "@/domain/types";

/** The drawing's key: SHA-256 of its size and each path's kind, colour and data, base64url, 16 characters. */
export function thumbnailKey(d: ThumbnailDrawing): string {
  const hash = createHash("sha256").update(`${d.width} ${d.height}`);
  for (const p of d.paths) hash.update(`\n${p.kind}|${p.color ?? ""}|${p.d}`);
  return hash.digest("base64url").slice(0, 16);
}

export const thumbnailPath = (workspaceId: Uuid, canvasId: Uuid) => `/w/${workspaceId}/thumbnail/${canvasId}`;

/** Each canvas's thumbnail address, or null for an empty canvas ("Empty canvas", no request). */
export function thumbnailHrefs(
  workspaceId: Uuid,
  canvases: readonly Pick<Canvas, "id" | "live_label_id">[],
  rows: CanvasRows,
  page: { model: WorkspaceModel; requirements: readonly { id: Uuid }[]; labels: readonly { id: Uuid }[]; labelLinks: readonly LabelLink[] },
): Map<Uuid, string | null> {
  const made = canvasThumbnails(canvases, rows, thumbnailIndex(page.model, page));
  return new Map(
    canvases.map((c) => {
      const d = thumbnailDrawing(made.get(c.id)!);
      return [c.id, d ? `${thumbnailPath(workspaceId, c.id)}?v=${thumbnailKey(d)}` : null];
    }),
  );
}
