// Where an item is shown (slice 39, S39-04's Context and S39-05's "Open in InfoMapper", Q9 as answered): the canvases
// whose cards show it, across the workspace's projects. Pure, InfoMapper's domain (guardrail 4): the cards are its
// entities', source tables' and requirements' (`CatalogItem.anchors`). A canvas that shows every anchor (a mapping's both
// ends, a relationship's both entities) comes first, then one that shows some; within each, the projects in the order
// they were made and each project's canvases in tab order. A canvas in two projects is listed under each.

import type { Uuid } from "../ids";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { CanvasItem, ModuleTable } from "../types";
import type { CatalogItem } from "./items";

export interface CatalogCanvas {
  readonly projectId: Uuid;
  readonly projectName: string;
  readonly canvasId: Uuid;
  readonly canvasName: string;
  /** It shows every anchor of the item. */
  readonly whole: boolean;
  /** The canvas's arrival parameters that select the item and centre it (Q9). */
  readonly query: Readonly<Record<string, string>>;
}

const cardKeys = (c: CanvasItem): string[] =>
  c.entity_id ? [`e:${c.entity_id}`] : c.source_table_id ? [`t:${c.source_table_id}`] : c.requirement_id ? [`r:${c.requirement_id}`] : [];

const anchorKeys = (item: CatalogItem): string[] => [
  ...item.anchors.entities.map((id) => `e:${id}`),
  ...item.anchors.tables.map((id) => `t:${id}`),
  ...(item.anchors.requirements ?? []).map((id) => `r:${id}`),
];

const byMade = (a: { created_at: string; id: string }, b: { created_at: string; id: string }) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** The canvases that show the item, the best first (the target of "Open in InfoMapper"); none for an item on no card. */
export function canvasesShowing(snapshot: WorkspaceSnapshot<ModuleTable>, item: CatalogItem): CatalogCanvas[] {
  const anchors = anchorKeys(item);
  if (!anchors.length || (item.open && "tab" in item.open)) return [];
  const onCanvas = new Map<Uuid, Set<string>>();
  for (const c of snapshot.canvasItems) {
    if (c.deleted_at !== null) continue;
    const set = onCanvas.get(c.canvas_id) ?? new Set<string>();
    for (const k of cardKeys(c)) set.add(k);
    onCanvas.set(c.canvas_id, set);
  }
  const canvases = new Map(snapshot.canvases.filter((c) => c.deleted_at === null).map((c) => [c.id, c]));
  const projects = [...snapshot.projects].filter((p) => p.deleted_at === null).sort(byMade);
  const whole: CatalogCanvas[] = [];
  const part: CatalogCanvas[] = [];
  for (const p of projects) {
    for (const link of snapshot.projectCanvases.filter((l) => l.project_id === p.id)) {
      const canvas = canvases.get(link.canvas_id);
      const cards = onCanvas.get(link.canvas_id);
      if (!canvas || !cards) continue;
      const shown = anchors.filter((k) => cards.has(k));
      if (!shown.length) continue;
      const all = shown.length === anchors.length;
      const query = arrivalQuery(item, shown);
      (all ? whole : part).push({ projectId: p.id, projectName: p.name, canvasId: canvas.id, canvasName: canvas.name, whole: all, query });
    }
  }
  return [...whole, ...part];
}

/** What selects the item on a canvas showing these anchors: its own parameter, or (a concept) its first entity's card. */
function arrivalQuery(item: CatalogItem, shown: readonly string[]): Record<string, string> {
  if (item.open && "param" in item.open) return { [item.open.param]: item.open.value };
  const entity = shown.find((k) => k.startsWith("e:"));
  return entity ? { card: `entity:${entity.slice(2)}` } : {};
}
