// Which canvas opens when an undo or redo takes the open canvas out of its project (slice 2a): undoing a duplicate
// returns to its original, as in the prototype; otherwise the project's first canvas.

import type { Uuid } from "../ids";
import type { ChangeEvent, ProjectCanvas } from "../types";

/**
 * `links` are the project's canvas links after the step, in tab order; `events` are the step that was undone or
 * redone. Null when the open canvas is still in the project, or the project has no canvas left.
 */
export function canvasAfterStep(open: { projectId: Uuid; canvasId: Uuid }, links: readonly ProjectCanvas[], events: readonly ChangeEvent[]): Uuid | null {
  if (!links.length || links.some((l) => l.canvas_id === open.canvasId)) return null;
  // the duplicate's link took its original's tab order (assumption 5): the original is the earlier tab with it
  const copyLink = events.find(
    (e) => e.object_type === "project_canvas" && e.operation === "create" && e.after_image?.canvas_id === open.canvasId && e.after_image?.project_id === open.projectId,
  )?.after_image;
  const original = copyLink ? links.find((l) => l.sort_order === copyLink.sort_order) : undefined;
  return (original ?? links[0]!).canvas_id;
}
