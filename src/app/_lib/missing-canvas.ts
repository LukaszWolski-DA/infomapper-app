// Where a canvas page goes when its canvas is not there (D-38; slice 2a, slice 6b, slice 12a): one rule for `loadShell`
// and for the canvas page's own read, which may run after a delete that landed between the two (the race found in
// slice 12a, step 2's run). Pure, so the branch is tested without a server.

import { workspaceHref } from "./paths";

export type MissingCanvasWay = { to: string } | { notFound: true };

export interface MissingCanvas {
  workspaceId: string;
  projectId: string;
  canvasId: string;
  /** Whether the address's project is live. */
  projectLive: boolean;
  /** The project's canvas links as they are now (empty when the project is gone). */
  links: readonly { canvas_id: string }[];
  /** The page is drawn again as the result of a server action of this browser. */
  ownAction: boolean;
  /** The canvas that action chose to open instead (`next-canvas.ts`), if any. */
  next: string | null;
  /** That action removed this project (`gone-project.ts`). */
  projectGoneByMe: boolean;
}

/**
 * A project that no longer exists leads to the workspace home with "That project no longer exists." (`?gone=project`),
 * or without it after your own action that removed it. A canvas no longer in its project opens the project's first other
 * canvas: after your own action the one it chose, silently; any other visit with "This canvas is no longer in …"
 * (`?moved=1`). A project with no other canvas: not found.
 */
export function missingCanvasWay(m: MissingCanvas): MissingCanvasWay {
  if (!m.projectLive) return { to: m.ownAction && m.projectGoneByMe ? workspaceHref(m.workspaceId) : `${workspaceHref(m.workspaceId)}?gone=project` };
  const others = m.links.filter((l) => l.canvas_id !== m.canvasId);
  if (!others.length) return { notFound: true };
  const base = `/w/${m.workspaceId}/p/${m.projectId}/c/`;
  if (m.ownAction) return { to: base + (m.next && others.some((l) => l.canvas_id === m.next) ? m.next : others[0]!.canvas_id) };
  return { to: `${base}${others[0]!.canvas_id}?moved=1` };
}
