import "server-only";
import type { DataStore } from "@/data";
import type { LiveWriteState } from "@/domain/commands/live";
import type { Uuid } from "@/domain/ids";

/** What the live canvas rules read (slice 3b): the model, labels and links, and every canvas with its cards, frames and notes. */
export async function loadLiveState(store: DataStore, workspaceId: Uuid): Promise<LiveWriteState> {
  const [model, labels, labelLinks, canvases, canvasItems, frames, notes] = await Promise.all([
    store.model.load(workspaceId),
    store.labels.list(workspaceId),
    store.labels.listLinks(workspaceId),
    store.canvases.list(workspaceId),
    store.canvasItems.list(workspaceId),
    store.frames.list(workspaceId),
    store.notes.list(workspaceId),
  ]);
  return { ...model, labels, labelLinks, canvases, canvasItems, frames, notes };
}
