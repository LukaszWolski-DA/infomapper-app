// Slice 38 (F10): React Flow's `fitBounds`, with the canvas toolbar's room kept at the top. Zoom to frame and bringing
// placed cards into view call it, so what they show never lies under the toolbar. The screen's size and the zoom limits
// come from React Flow's store (no layout read); the view is animated as `fitBounds` was (AD-24's note).

import type { ReactFlowInstance, ReactFlowState } from "@xyflow/react";
import { boundsViewport, TOOLBAR_TOP_ROOM } from "./geometry";

export function showBounds(
  rf: Pick<ReactFlowInstance, "setViewport">,
  state: Pick<ReactFlowState, "width" | "height" | "minZoom" | "maxZoom">,
  b: { x: number; y: number; width: number; height: number },
  padding = 0,
): void {
  const view = boundsViewport({ x: b.x, y: b.y, w: b.width, h: b.height }, { width: state.width, height: state.height }, {
    padding,
    top: TOOLBAR_TOP_ROOM,
    minZoom: state.minZoom,
    maxZoom: state.maxZoom,
  });
  void rf.setViewport(view, { duration: 250 });
}
