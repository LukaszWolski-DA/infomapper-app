import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import { can, checkCreateWorkspace, isArchived, isGuest } from "@/domain/permissions";
import type { AppUser, WorkspaceRole } from "@/domain/types";
import { LAST_PROJECTS_COOKIE, parseLastProjects } from "./preferences";
import { standingOf, type Standing } from "./roles";
import { requireSessionUser } from "./session";

/** Everything the top bar and breadcrumbs show. Plain data, safe to pass to client components. */
export interface ShellData {
  user: { id: Uuid; name: string; email: string; homeOrganizations: string[] };
  organization: { id: Uuid; name: string };
  organizations: { id: Uuid; name: string; guest: boolean; workspaceCount: number; firstWorkspaceId: Uuid | null }[];
  workspace: { id: Uuid; name: string; archived: boolean };
  /** Workspaces of the current organization the user is a member of. */
  workspaces: { id: Uuid; name: string; archived: boolean; role: WorkspaceRole }[];
  role: WorkspaceRole;
  guest: boolean;
  standing: Standing;
  /** The project shown in the top bar: the one open, else the last used in this workspace, else the first. */
  project: { id: Uuid; name: string } | null;
  projects: { id: Uuid; name: string; canvasCount: number }[];
  canvas: { id: Uuid; name: string } | null;
  page: "workspace" | "project" | "canvas";
  /** Whether "New workspace" (current organization) and "New project" are offered. The server checks again. */
  canCreateWorkspace: boolean;
  canCreateProject: boolean;
}

interface Where {
  workspaceId: string;
  projectId?: string;
  canvasId?: string;
}

/** Loads the shell for a workspace page. Not a member, or unknown ids: 404. */
export async function loadShell(where: Where): Promise<ShellData> {
  const user = await requireSessionUser();
  return loadShellFor(user, where);
}

export async function loadShellFor(user: AppUser, where: Where): Promise<ShellData> {
  const store = getDataStore();
  const workspace = await store.workspaces.get(where.workspaceId);
  const member = workspace && (await store.workspaces.getMember(workspace.id, user.id));
  if (!workspace || !member) notFound();

  const [organizations, myWorkspaces, myOrgMemberships, projects] = await Promise.all([
    store.organizations.listForUser(user.id),
    store.workspaces.listForUser(user.id),
    store.organizations.listMembershipsOfUsers([user.id]),
    store.projects.list(workspace.id),
  ]);
  const organization = organizations.find((o) => o.id === workspace.organization_id);
  if (!organization) notFound();

  const workspacesHere = myWorkspaces.filter((w) => w.organization_id === organization.id);
  const roles = await Promise.all(workspacesHere.map((w) => store.workspaces.getMember(w.id, user.id)));
  const projectRows = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      name: p.name,
      canvasCount: (await store.canvases.listLinksOfProject(workspace.id, p.id)).length,
    })),
  );

  let project: { id: Uuid; name: string } | null = null;
  let canvas: { id: Uuid; name: string } | null = null;
  if (where.projectId) {
    project = projectRows.find((p) => p.id === where.projectId) ?? null;
    if (!project) notFound();
  } else {
    const remembered = parseLastProjects((await cookies()).get(LAST_PROJECTS_COOKIE)?.value)[workspace.id];
    project = projectRows.find((p) => p.id === remembered) ?? projectRows[0] ?? null;
  }
  if (where.canvasId) {
    const links = project ? await store.canvases.listLinksOfProject(workspace.id, project.id) : [];
    const row = links.some((l) => l.canvas_id === where.canvasId)
      ? await store.canvases.get(workspace.id, where.canvasId)
      : null;
    if (!row) notFound();
    canvas = { id: row.id, name: row.name };
  }

  const homeOrgIds = new Set(myOrgMemberships.map((m) => m.organization_id));
  const archived = isArchived(workspace);
  return {
    user: {
      id: user.id,
      name: user.display_name,
      email: user.email,
      homeOrganizations: organizations.filter((o) => homeOrgIds.has(o.id)).map((o) => o.name),
    },
    organization: { id: organization.id, name: organization.name },
    organizations: organizations.map((o) => {
      const mine = myWorkspaces.filter((w) => w.organization_id === o.id);
      return { id: o.id, name: o.name, guest: !homeOrgIds.has(o.id), workspaceCount: mine.length, firstWorkspaceId: mine[0]?.id ?? null };
    }),
    workspace: { id: workspace.id, name: workspace.name, archived },
    workspaces: workspacesHere.map((w, i) => ({ id: w.id, name: w.name, archived: isArchived(w), role: roles[i]!.role })),
    role: member.role,
    guest: isGuest(workspace, user.id, myOrgMemberships),
    standing: standingOf(member.role, archived),
    project,
    projects: projectRows,
    canvas,
    page: where.canvasId ? "canvas" : where.projectId ? "project" : "workspace",
    canCreateWorkspace:
      checkCreateWorkspace(organization.id, myOrgMemberships.find((m) => m.organization_id === organization.id) ?? null) === null,
    canCreateProject: can({ workspace, member }, "project.create"),
  };
}
