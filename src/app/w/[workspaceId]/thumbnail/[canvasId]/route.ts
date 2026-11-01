// A canvas's thumbnail as an SVG file (slice 12b, PRD P5): the tiles of the home pages draw it through an external
// `<use>`. The same access as the workspace's pages (`workspaceAccess`): no session 401, not a member or no such
// workspace 404, its organization not unlocked in this session 403 (an image cannot follow the unlock form; the page
// around it asks). A canvas deleted or not in this workspace: 404. The drawing is computed as the page computes it;
// when the address's key matches it, the answer may be cached for good, else the current drawing is sent uncached.

import { getSession } from "@/app/_lib/session";
import { workspaceAccess } from "@/app/_lib/shell";
import { thumbnailKey } from "@/app/_lib/thumbnails";
import { getDataStore } from "@/data";
import { canvasThumbnail, thumbnailDrawing, thumbnailIndex } from "@/domain/model/thumbnail";
import { thumbnailSymbolFile } from "@/ui/thumbnail-svg";

export async function GET(request: Request, ctx: RouteContext<"/w/[workspaceId]/thumbnail/[canvasId]">) {
  const { workspaceId, canvasId } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const access = await workspaceAccess(session.user, workspaceId, session.unlocked);
  if (access === "missing") return new Response(null, { status: 404 });
  if ("locked" in access) return new Response(null, { status: 403 });
  const store = getDataStore();
  const ws = access.workspace.id;
  const canvas = await store.canvases.get(ws, canvasId);
  if (!canvas) return new Response(null, { status: 404 });

  const [model, items, frames, notes, labels, labelLinks, requirements] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.listOfCanvas(ws, canvas.id),
    store.frames.listOfCanvas(ws, canvas.id),
    store.notes.listOfCanvas(ws, canvas.id),
    store.labels.list(ws),
    store.labels.listLinks(ws),
    store.requirements.list(ws),
  ]);
  const drawing = thumbnailDrawing(canvasThumbnail(canvas, { items, frames, notes }, thumbnailIndex(model, { requirements, labels, labelLinks })));
  const current = drawing !== null && new URL(request.url).searchParams.get("v") === thumbnailKey(drawing);
  return new Response(thumbnailSymbolFile(drawing), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
