import "server-only";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import { can } from "@/domain/permissions";
import type { CanvasLook } from "@/domain/types";
import { cardsPerCanvas } from "../_panels/stats";
import type { ShellData } from "./shell";

/** What the project home and the canvas tabs show. Plain data, safe to pass to client components. */
export interface ProjectView {
  workspaceId: Uuid;
  project: { id: Uuid; name: string; description: string | null };
  /** May create, rename and move canvases between projects. The server checks again. */
  canEdit: boolean;
  /** The project's canvases in tab order, with the projects each one is in, their number of cards and their look. */
  canvases: { id: Uuid; name: string; version: number; projectIds: Uuid[]; cards: number; look: CanvasLook }[];
  projects: { id: Uuid; name: string }[];
  /** Canvases of this workspace that are not in this project ("Add a canvas from another project"). */
  outside: { id: Uuid; name: string; projectNames: string[] }[];
}

export async function loadProjectView(shell: ShellData): Promise<ProjectView> {
  const store = getDataStore();
  const workspaceId = shell.workspace.id;
  const projectId = shell.project!.id;
  const [workspace, member, project, projects, canvases, links, items] = await Promise.all([
    store.workspaces.get(workspaceId),
    store.workspaces.getMember(workspaceId, shell.user.id),
    store.projects.get(workspaceId, projectId),
    store.projects.list(workspaceId),
    store.canvases.list(workspaceId),
    store.canvases.listLinksOfProject(workspaceId, projectId),
    store.canvasItems.list(workspaceId),
  ]);
  const cards = cardsPerCanvas(items);
  const linksByCanvas = new Map<Uuid, Uuid[]>();
  for (const c of canvases) {
    const of = await store.canvases.listLinksOfCanvas(workspaceId, c.id);
    linksByCanvas.set(c.id, of.map((l) => l.project_id));
  }
  const projectName = (id: Uuid) => projects.find((p) => p.id === id)?.name ?? "";
  const inProject = new Set(links.map((l) => l.canvas_id));

  return {
    workspaceId,
    project: { id: project!.id, name: project!.name, description: project!.description },
    canEdit: can({ workspace: workspace!, member }, "canvas.create"),
    canvases: links.map((l) => {
      const c = canvases.find((x) => x.id === l.canvas_id)!;
      return { id: c.id, name: c.name, version: c.version, projectIds: linksByCanvas.get(c.id) ?? [], cards: cards.get(c.id) ?? 0, look: c.look };
    }),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    outside: canvases
      .filter((c) => !inProject.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, projectNames: (linksByCanvas.get(c.id) ?? []).map(projectName) })),
  };
}
