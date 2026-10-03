"use server";

// Card writes on the canvas (slice 1a): position (when a drag ends), collapse and row filter.

import { updateCanvasItem } from "@/domain/commands/canvas-item";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

export interface CardChangeInput {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: string;
  x?: number;
  y?: number;
}

/** Saves a card's position, collapse state or row filter. Returns the card's new version for the next change. */
export async function updateCardAction(workspaceId: string, change: CardChangeInput): Promise<ActionResult<{ version: number }>> {
  return runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const id = typeof change?.canvasItemId === "string" ? change.canvasItemId : "";
    const result = updateCanvasItem(ctx, access, { item: await store.canvasItems.get(workspace.id, id) }, change);
    return result.ok ? { ...result, value: { version: result.value.item.version } } : result;
  });
}
