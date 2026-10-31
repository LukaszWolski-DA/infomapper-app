import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import { can, checkCreateWorkspace, isArchived, isGuest } from "@/domain/permissions";
import type { AppUser, WorkspaceRole } from "@/domain/types";
import { goneByMe } from "./gone-project";
import { missingCanvasWay } from "./missing-canvas";
import { nextCanvasFor } from "./next-canvas";
import { LAST_PROJECTS_COOKIE, parseLastProjects } from "./preferences";
import { standingOf, type Standing } from "./roles";
import { getSession } from "./session";

/** Everything the top bar and breadcrumbs show. Plain data, safe to pass to client components. */
export interface ShellData {
  user: { id: Uuid; name: string; email: string; homeOrganizations: string[] };
  organization: { id: Uuid; name: string };
  /** `locked`: not yet unlocked in this session; choosing it asks for its password once (slice 8, item 5). */
  organizations: { id: Uuid; name: string; guest: boolean; workspaceCount: number; firstWorkspaceId: Uuid | null; locked: boolean }[];
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

/**
 * Loads the shell for a workspace page. Not a member, or unknown ids: 404 (S0-11). A member's page of an organization
 * this session has not unlocked asks for its password and comes back here afterwards (slice 8, item 4, F3).
 */
export async function loadShell(where: Where): Promise<ShellData> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return loadShellFor(session.user, where, session.unlocked);
}

export async function loadShellFor(user: AppUser, where: Where, unlocked: ReadonlySet<Uuid>): Promise<ShellData> {
  const store = getDataStore();
  const workspace = await store.workspaces.get(where.workspaceId);
  const member = workspace && (await store.workspaces.getMember(workspace.id, user.id));
  if (!workspace || !member) notFound();
  if (!unlocked.has(workspace.organization_id)) {
    const path = `/w/${workspace.id}${where.projectId ? `/p/${where.projectId}` : ""}${where.canvasId ? `/c/${where.canvasId}` : ""}`;
    redirect(`/sign-in?org=${workspace.organization_id}&next=${encodeURIComponent(path)}`);
  }

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
    // a project that no longer exists (deleted, or never in this workspace) opens the workspace home with a toast, for
    // every arrival: a typed address, a link, Back or Forward (slice 6b, step 1 answer 5); drawn again as the result of
    // your own action that removed it (its delete, an undo or a redo), without that toast: the action has its own
    // (slice 12a, F2)
    if (!project) await leaveMissingCanvas(workspace.id, where.projectId, where.canvasId ?? "");
  } else {
    const remembered = parseLastProjects((await cookies()).get(LAST_PROJECTS_COOKIE)?.value)[workspace.id];
    project = projectRows.find((p) => p.id === remembered) ?? projectRows[0] ?? null;
  }
  if (where.canvasId) {
    const links = project ? await store.canvases.listLinksOfProject(workspace.id, project.id) : [];
    const row = links.some((l) => l.canvas_id === where.canvasId)
      ? await store.canvases.get(workspace.id, where.canvasId)
      : null;
    // A canvas no longer in this project (slice 2a): `leaveMissingCanvas`
    if (!row) return leaveMissingCanvas(workspace.id, where.projectId!, where.canvasId);
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
      return {
        id: o.id,
        name: o.name,
        guest: !homeOrgIds.has(o.id),
        workspaceCount: mine.length,
        firstWorkspaceId: mine[0]?.id ?? null,
        locked: !unlocked.has(o.id),
      };
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

/**
 * Leaves a canvas page whose canvas is not there, by `missingCanvasWay` (D-38): `loadShell` when the canvas or its
 * project is gone, and the canvas page when its own read no longer has the canvas that `loadShell` saw, because a delete
 * landed in between (slice 12a, the race of step 2's run). A project that no longer exists leads to the workspace home
 * (`?gone=project`, or silently after your own action that removed it, `gone-project.ts`); a canvas no longer in its
 * project opens the project's first other canvas (`?moved=1`, or after your own action the one it chose,
 * `next-canvas.ts`). Never returns.
 */
export async function leaveMissingCanvas(workspaceId: string, projectId: string, canvasId: string): Promise<never> {
  const store = getDataStore();
  const projectLive = !!(await store.projects.get(workspaceId, projectId));
  const ownAction = (await headers()).has("next-action");
  const way = missingCanvasWay({
    workspaceId,
    projectId,
    canvasId,
    projectLive,
    links: projectLive ? await store.canvases.listLinksOfProject(workspaceId, projectId) : [],
    ownAction,
    next: ownAction && canvasId ? await nextCanvasFor(canvasId) : null,
    projectGoneByMe: ownAction && !projectLive && (await goneByMe(projectId)),
  });
  if ("to" in way) redirect(way.to);
  notFound();
}
