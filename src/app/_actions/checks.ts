"use server";

// The project home's "Show all" of a model checks' group (slice 20, Łukasz's step 2 decisions): the page renders 20 lines
// per group; this read gives the group's every line, computed again from the model as it stands (nothing is stored).
// Members of the workspace in any role, an unlocked organization; no write.

import { modelRead } from "@/app/_lib/model-command";
import { homeChecks, projectModelChecks, type HomeCheckGroup } from "@/app/_lib/project-checks";
import type { ActionResult } from "@/app/_lib/run-command";

export async function projectChecksAction(workspaceId: string, projectId: string, groupId: string): Promise<ActionResult<HomeCheckGroup | null>> {
  return modelRead(workspaceId, async (access, model, store) => {
    const ws = access.workspace.id;
    const [links, canvases, items] = await Promise.all([store.canvases.listLinksOfProject(ws, projectId), store.canvases.list(ws), store.canvasItems.list(ws)]);
    const live = new Set(canvases.filter((c) => c.deleted_at === null).map((c) => c.id));
    const canvasIds = [...links].sort((a, b) => a.sort_order - b.sort_order).map((l) => l.canvas_id).filter((id) => live.has(id));
    if (!canvasIds.length) return null;
    const checks = await projectModelChecks(access.workspace, model, items, canvasIds);
    return homeChecks(checks, { workspaceId: ws, projectId, canvasIds, items }, Infinity, groupId).groups[0] ?? null;
  });
}
