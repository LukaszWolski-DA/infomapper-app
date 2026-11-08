// The project home's model checks (slice 20, PRD items 1–2, B1, F; Łukasz's step 2 decisions): the entities on the
// project's canvases are the scope (Q1); each line opens the project's first canvas, in its order, that shows the line's
// first entity, else one that shows any entity it names, else the project's first canvas (prototype `goCheck`, F17), at
// the line's object (`?entity=`, `?row=`, `?rel=`, `?ext=`). The page renders 20 lines per group; "Show all" reads the
// rest through `projectChecksAction`, which computes the same here. Server only.

import { moduleHomeData } from "@/compose";
import type { Uuid } from "@/domain/ids";
import { lineOf, modelChecks, projectScope, type CheckGroup, type CheckRef, type ModelChecks } from "@/domain/model/checks";
import type { ModelLookup } from "@/domain/model/requirements";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import type { CanvasItem, Workspace, WorkspaceModel } from "@/domain/types";
import { canvasHref } from "./paths";

/** How many lines of a group the home renders before "Show all" (D-35). */
export const HOME_LINES = 20;

export interface HomeCheckLine {
  name: string;
  detail: string;
  href: string;
  /** "{t}:{id}" of what it opens, for tests. */
  open: string;
}

export interface HomeCheckGroup {
  id: string;
  title: string;
  hint: string;
  high: boolean;
  module?: string;
  count: number;
  lines: HomeCheckLine[];
}

export interface HomeChecks {
  count: number;
  high: boolean;
  topics: string[];
  allWell: string[];
  groups: HomeCheckGroup[];
}

/** The address part of what a line opens. */
export function arrivalQuery(r: CheckRef): string {
  if (r.t === "entity") return `entity=${r.id}`;
  if (r.t === "attribute") return `row=${r.id}`;
  if (r.t === "relationship") return `rel=${r.id}`;
  return `ext=${encodeURIComponent(`${r.kind}:${r.id}`)}`;
}

const openOf = (r: CheckRef) => (r.t === "ext" ? `ext:${r.kind}:${r.id}` : `${r.t}:${r.id}`);

/** The home's checks, every group's first `limit` lines with their words and addresses (`Infinity`: all). */
export function homeChecks(
  checks: ModelChecks,
  where: { workspaceId: Uuid; projectId: Uuid; canvasIds: readonly Uuid[]; items: readonly CanvasItem[] },
  limit = HOME_LINES,
  only?: string,
): HomeChecks {
  const shows = new Map<Uuid, Set<Uuid>>(where.canvasIds.map((id) => [id, new Set()]));
  for (const i of where.items) if (i.deleted_at === null && i.entity_id) shows.get(i.canvas_id)?.add(i.entity_id);
  const canvasOf = (entities: readonly Uuid[]): Uuid => {
    const order = [...shows];
    const first = entities[0];
    return (order.find(([, s]) => first && s.has(first)) ?? order.find(([, s]) => entities.some((e) => s.has(e))) ?? order[0])?.[0] ?? where.canvasIds[0]!;
  };
  const group = (g: CheckGroup): HomeCheckGroup => ({
    id: g.id,
    title: g.title,
    hint: g.hint,
    high: g.high,
    ...(g.module ? { module: g.module } : {}),
    count: g.items.length,
    lines: g.items.slice(0, limit).map((item) => {
      const line = lineOf(item);
      return { name: line.name, detail: line.detail, open: openOf(item.go), href: `${canvasHref(where.workspaceId, where.projectId, canvasOf(item.entities))}?${arrivalQuery(item.go)}` };
    }),
  });
  return { count: checks.count, high: checks.high, topics: checks.topics, allWell: checks.allWell, groups: checks.groups.filter((g) => !only || g.id === only).map(group) };
}

/**
 * The checks of a project's scope. `home`: the page's one read of the module's rows (`moduleHomeData`) and its requirement
 * index's lookup, so nothing is read or built twice; without them (the read action) both are made here.
 */
export async function projectModelChecks(
  workspace: Pick<Workspace, "id" | "infocube">,
  model: WorkspaceModel,
  items: readonly CanvasItem[],
  canvasIds: readonly Uuid[],
  home?: { data: Awaited<ReturnType<typeof moduleHomeData>>; lookup: ModelLookup },
): Promise<ModelChecks> {
  const data = home?.data ?? (await moduleHomeData(workspace, model));
  const lookup = home?.lookup ?? buildRequirementIndex([], [], model, data.feeds).lookup;
  const input = { model, lookup, scope: projectScope(items, canvasIds) };
  return modelChecks(input, data.checks(input));
}
