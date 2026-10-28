import type { DataStore } from "@/data";
import type { WriteSet } from "@/domain/changes";
import type { Uuid } from "@/domain/ids";

/** A write or read in an organization this session has not unlocked with its password (slice 8, P4, F3). */
export const lockedMessage = (organization: string) => `Unlock ${organization} first: open it and enter its password.`;

/** The refusal when the organization is locked in this session, else null. */
export async function lockedRefusal(
  store: DataStore,
  unlocked: ReadonlySet<Uuid>,
  organizationId: Uuid,
): Promise<{ ok: false; code: "forbidden"; message: string } | null> {
  if (unlocked.has(organizationId)) return null;
  const organization = await store.organizations.get(organizationId);
  return { ok: false, code: "forbidden", message: lockedMessage(organization?.name ?? "this organization") };
}

/**
 * The organization a write set writes into: the one it creates, else the one of the workspace it creates, else the
 * one of the workspace of its change events. Null when it creates the organization itself (creating one unlocks it).
 */
export async function organizationOfWrite(store: DataStore, writeSet: WriteSet): Promise<Uuid | "new" | null> {
  if (writeSet.writes.some((w) => w.kind === "insert" && w.table === "organization")) return "new";
  for (const w of writeSet.writes) if (w.kind === "insert" && w.table === "workspace") return w.row.organization_id;
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId) return null;
  return (await store.workspaces.get(workspaceId))?.organization_id ?? null;
}
