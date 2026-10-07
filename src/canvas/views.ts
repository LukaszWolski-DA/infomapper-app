// The last view of each canvas, remembered in this browser (data model section 12): `infomapper:view:<canvas id>`.

export const viewKey = (canvasId: string) => `infomapper:view:${canvasId}`;

/** “Duplicate layout” opens the copy with the original's view (slice 2a, PRD item 12). */
export function copyView(fromCanvasId: string, toCanvasId: string): void {
  try {
    const raw = window.localStorage.getItem(viewKey(fromCanvasId));
    if (raw) window.localStorage.setItem(viewKey(toCanvasId), raw);
  } catch {
    // private mode or blocked storage: the copy opens fitted
  }
}
