// The page's clipboard for “Copy” and “Paste attribute” (slice 10c, item 3, acceptance F13, Q3): not the system's
// clipboard. It holds the copied attribute's id and its workspace only; the menus read the name from the page's model,
// so a rename shows. A module value, so it survives switching canvases (Next.js's client navigation) and is empty after
// a reload; a canvas of another workspace empties it.

import { createValueStore, useValue } from "@/canvas/value-store";

export interface ClippedAttribute {
  workspaceId: string;
  attributeId: string;
}

const same = (a: ClippedAttribute | null, b: ClippedAttribute | null) => a?.workspaceId === b?.workspaceId && a?.attributeId === b?.attributeId;

export const attributeClipboard = createValueStore<ClippedAttribute | null>(null, same);

/** The copied attribute's id when it is of this workspace, re-rendering when it changes. */
export function useClippedAttribute(workspaceId: string): string | null {
  const clipped = useValue(attributeClipboard);
  return clipped?.workspaceId === workspaceId ? clipped.attributeId : null;
}
