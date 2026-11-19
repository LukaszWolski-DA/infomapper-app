import "server-only";
import type { DataStore } from "@/data";
import type { CheckedAccess } from "@/domain/commands/access-check";
import type { Uuid } from "@/domain/ids";

/**
 * The store a command is built with, recording what it read about the actor (slice 30, B3, L1): a workspace's archive,
 * the actor's role there and their organization role, each as first read. `apply` reads them again inside the write and
 * refuses when they differ (`accessChangedRefusal`). Every loader of a command's access reads through these three calls
 * (`loadAccess` and its siblings), so nothing else is needed; a part the command never read is not compared.
 */
export function recordingStore(store: DataStore, actorId: Uuid): { store: DataStore; checkedFor: (workspaceId: Uuid | undefined) => CheckedAccess } {
  const workspaces = new Map<Uuid, { name: string; archived: boolean; organizationId: Uuid }>();
  const roles = new Map<Uuid, string | null>();
  const orgRoles = new Map<Uuid, string | null>();
  const recorded: DataStore = {
    ...store,
    workspaces: {
      ...store.workspaces,
      get: async (workspaceId) => {
        const w = await store.workspaces.get(workspaceId);
        if (w && !workspaces.has(w.id)) workspaces.set(w.id, { name: w.name, archived: w.archived_at !== null, organizationId: w.organization_id });
        return w;
      },
      getMember: async (workspaceId, userId) => {
        const m = await store.workspaces.getMember(workspaceId, userId);
        if (userId === actorId && !roles.has(workspaceId)) roles.set(workspaceId, m?.role ?? null);
        return m;
      },
    },
    organizations: {
      ...store.organizations,
      getMember: async (organizationId, userId) => {
        const m = await store.organizations.getMember(organizationId, userId);
        if (userId === actorId && !orgRoles.has(organizationId)) orgRoles.set(organizationId, m?.role ?? null);
        return m;
      },
    },
  };
  const checkedFor = (workspaceId: Uuid | undefined): CheckedAccess => {
    const ws = workspaceId ? workspaces.get(workspaceId) : undefined;
    const access: CheckedAccess = { userId: actorId };
    if (ws && workspaceId && roles.has(workspaceId)) access.workspace = { id: workspaceId, name: ws.name, archived: ws.archived, role: roles.get(workspaceId)! };
    // the organization role, when the command read it (a workspace's create reads only that)
    const [organizationId, role] = [...orgRoles][0] ?? [];
    if (organizationId) access.organization = { id: organizationId, role: role ?? null };
    return access;
  };
  return { store: recorded, checkedFor };
}
