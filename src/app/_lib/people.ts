import type { DataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { AppUser } from "@/domain/types";

/**
 * The people a workspace's pages may name (slice 8, F10, P11): its members and everyone with a change event in it, so
 * a removed person's earlier work keeps their name. People of another organization never reach the browser.
 */
export const workspacePeople = (store: DataStore, workspaceId: Uuid): Promise<AppUser[]> => store.users.listForWorkspace(workspaceId);
