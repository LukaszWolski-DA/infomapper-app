// Model consistency on the project home (slice 7b, item 25; prototype `consistency`, `consistencyHtml`, `goTo`).
// Computed live from the model on every page load, independent of imports. Pure.
//   Scope (Q8): a mapping is in scope when one of its inputs' tables or its attribute's entity has a card on one of the
//   project's canvases; “Source changes to resolve” is per system, workspace-wide (systems are not in projects).
//   Historical mappings (every input retired, Q10) are neither type conflicts nor mappings on columns that left: retiring
//   is the answer to the latter. An attribute whose every mapping reads a column that left has no active source; it says
//   “historical source only” when one of them is historical.
//   Each line names the canvas it opens on (F15, prototype `goTo`): the first project canvas in tab order with both
//   ends' cards, else one end's, else the project's first canvas.

import type { Uuid } from "../ids";
import { checkMappingTypes, formatAttributeType, formatColumnType } from "../model/type-check";
import type { RequirementIndex } from "../model/requirement-index";
import type { CanvasItem, Mapping, MappingStatus, SourceChange, SourceColumn, WorkspaceModel } from "../types";
import { isHistorical, isOpen } from "./rules";
import { isoDate } from "./texts";

export type ConsistencySeverity = "high" | "normal";

/** A line that opens a mapping, an attribute or a system on a canvas. */
export interface ConsistencyLine {
  /** What the canvas page selects on arrival: `?map=`, `?row=` (an attribute) or `?system=`. */
  open: { t: "map" | "row" | "system"; id: Uuid };
  canvasId: Uuid;
  name: string;
  meta: string;
}

export interface ConsistencyGroup {
  id: "gone" | "no_source" | "conflicts" | "review";
  title: string;
  severity: ConsistencySeverity;
  hint: string | null;
  lines: ConsistencyLine[];
}

export interface ConsistencyRequirement {
  id: Uuid;
  key: string;
  name: string;
  covered: number;
  total: number;
  bestCanvasId: Uuid | null;
}

export interface Consistency {
  groups: ConsistencyGroup[];
  requirements: ConsistencyRequirement[];
  systems: ConsistencyLine[];
  /** The badge: every listed mapping and attribute, plus the open changes of every system. */
  count: number;
}

export const CONSISTENCY_TEXT = {
  title: "Model consistency",
  allWell: "Mappings, types and sources agree. Nothing to look at.",
  gone: "Mappings on columns that left the source",
  goneHint: "Retire the column, move the mapping or delete it from the source’s changes.",
  noSource: "Attributes without an active source",
  noSourceHint: "No new data reaches them.",
  historicalOnly: "historical source only",
  columnsLeft: "its columns left the source",
  conflicts: "Type conflicts",
  conflictsHint: "The source’s physical type does not fit the attribute’s modelling type.",
  review: "Mappings back in review after a source change",
  requirements: "Affected requirements",
  systems: "Source changes to resolve",
  toDecide: (n: number) => `${n} ${n === 1 ? "change" : "changes"} to decide`,
} as const;

const STATUS: Record<MappingStatus, string> = { draft: "Draft", review: "In review", approved: "Approved" };

export type ConsistencyModel = Pick<WorkspaceModel, "entities" | "attributes" | "mappings" | "mappingInputs" | "sourceTables" | "sourceColumns" | "sourceSystems">;

export function modelConsistency(
  model: ConsistencyModel,
  items: readonly CanvasItem[],
  /** The project's canvases in tab order. */
  canvasIds: readonly Uuid[],
  index: Pick<RequirementIndex, "scope">,
  /** The project's requirements (the home page's list), with their coverage and best canvas. */
  projectRequirements: readonly ConsistencyRequirement[],
  changes: readonly SourceChange[],
): Consistency {
  const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);
  const attribute = new Map(live(model.attributes).map((a) => [a.id, a]));
  const entityName = new Map(live(model.entities).map((e) => [e.id, e.name]));
  const column = new Map(live(model.sourceColumns).map((c) => [c.id, c]));
  const tableName = new Map(live(model.sourceTables).map((t) => [t.id, t.name]));
  const inputsOf = new Map<Uuid, SourceColumn[]>();
  for (const i of [...live(model.mappingInputs)].sort((a, b) => a.sort_order - b.sort_order)) {
    const c = column.get(i.source_column_id);
    if (c) (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(c);
  }

  // what is on which project canvas (in tab order)
  const cardsOn = new Map<Uuid, Set<Uuid>>(canvasIds.map((id) => [id, new Set()]));
  const here = new Set<Uuid>();
  for (const i of items) {
    const on = i.deleted_at === null ? cardsOn.get(i.canvas_id) : undefined;
    const target = i.entity_id ?? i.source_table_id;
    if (!on || !target) continue;
    on.add(target);
    here.add(target);
  }
  const first = canvasIds[0]!;
  /** The first canvas with every group's card, else one with any, else the first (prototype `goTo`). */
  const best = (...groups: Uuid[][]): Uuid => {
    const wanted = groups.filter((g) => g.length);
    const all = [...cardsOn].find(([, s]) => wanted.every((g) => g.some((id) => s.has(id))));
    const any = all ?? [...cardsOn].find(([, s]) => wanted.some((g) => g.some((id) => s.has(id))));
    return any?.[0] ?? first;
  };

  const ends = (m: Mapping) => {
    const inputs = inputsOf.get(m.id) ?? [];
    const a = attribute.get(m.attribute_id)!;
    return { a, inputs, entityId: a.entity_id, tables: [...new Set(inputs.map((c) => c.source_table_id))] };
  };
  const label = (c: SourceColumn) => `${tableName.get(c.source_table_id) ?? "?"}.${c.name}`;
  const attrLabel = (id: Uuid) => {
    const a = attribute.get(id);
    return a ? `${entityName.get(a.entity_id) ?? "?"}.${a.name}` : "?";
  };
  const mapLine = (m: Mapping, meta: string): ConsistencyLine => {
    const e = ends(m);
    return { open: { t: "map", id: m.id }, canvasId: best(e.tables, [e.entityId]), name: `${e.inputs.map(label).join(", ")} → ${attrLabel(m.attribute_id)}`, meta };
  };

  const maps = live(model.mappings).filter((m) => {
    if (!attribute.has(m.attribute_id) || !(inputsOf.get(m.id) ?? []).length) return false;
    const e = ends(m);
    return here.has(e.entityId) || e.tables.some((t) => here.has(t));
  });
  const gone: Mapping[] = [], conflicts: { m: Mapping; meta: string }[] = [], review: Mapping[] = [];
  for (const m of maps) {
    const e = ends(m);
    const historical = isHistorical(e.inputs);
    if (!historical && e.inputs.some((c) => c.missing_since && !c.retired_since)) gone.push(m);
    if (!historical) {
      const check = checkMappingTypes(m, e.a, e.inputs.filter((c) => !c.retired_since));
      const p = check.problems[0] && column.get(check.problems[0].source_column_id);
      if (!check.ok) conflicts.push({ m, meta: `${STATUS[m.status]}: ${p ? `${formatColumnType(p)} into ${formatAttributeType(e.a)}` : check.message}` });
    }
    if (m.status === "review" && m.review_reason) review.push(m);
  }
  // attributes in scope whose every mapping reads a column that left the source (retired included)
  const byAttribute = new Map<Uuid, Mapping[]>();
  for (const m of live(model.mappings)) if ((inputsOf.get(m.id) ?? []).length) (byAttribute.get(m.attribute_id) ?? byAttribute.set(m.attribute_id, []).get(m.attribute_id)!).push(m);
  const attributesHere = new Set(maps.map((m) => m.attribute_id));
  const noSource = [...byAttribute].filter(([id, ms]) => attributesHere.has(id) && ms.every((m) => inputsOf.get(m.id)!.some((c) => c.missing_since)));

  // requirements whose coverage these can change (prototype: gone, approved conflicts, review, no source)
  const touched = new Set<Uuid>([...gone, ...conflicts.filter((c) => c.m.status === "approved").map((c) => c.m), ...review].map((m) => m.attribute_id));
  for (const [id] of noSource) touched.add(id);
  const requirements = projectRequirements.filter((r) => [...index.scope(r.id).attributes].some((a) => touched.has(a)));
  const inScope = new Set(requirements.flatMap((r) => [...index.scope(r.id).attributes]));

  const groups: ConsistencyGroup[] = [
    {
      id: "gone" as const,
      title: CONSISTENCY_TEXT.gone,
      severity: gone.some((m) => m.status === "approved") ? ("high" as const) : ("normal" as const),
      hint: CONSISTENCY_TEXT.goneHint,
      lines: gone.map((m) => {
        const since = ends(m).inputs.find((c) => c.missing_since && !c.retired_since)!.missing_since!;
        return mapLine(m, `${STATUS[m.status]}, missing since ${isoDate(since)}`);
      }),
    },
    {
      id: "no_source" as const,
      title: CONSISTENCY_TEXT.noSource,
      severity: noSource.some(([id]) => inScope.has(id)) ? ("high" as const) : ("normal" as const),
      hint: CONSISTENCY_TEXT.noSourceHint,
      lines: noSource.map(([id, ms]) => ({
        open: { t: "row" as const, id },
        canvasId: best([attribute.get(id)!.entity_id]),
        name: attrLabel(id),
        meta: ms.some((m) => isHistorical(inputsOf.get(m.id) ?? [])) ? CONSISTENCY_TEXT.historicalOnly : CONSISTENCY_TEXT.columnsLeft,
      })),
    },
    {
      id: "conflicts" as const,
      title: CONSISTENCY_TEXT.conflicts,
      severity: conflicts.some((c) => c.m.status === "approved") ? ("high" as const) : ("normal" as const),
      hint: CONSISTENCY_TEXT.conflictsHint,
      lines: conflicts.map((c) => mapLine(c.m, c.meta)),
    },
    { id: "review" as const, title: CONSISTENCY_TEXT.review, severity: "normal" as const, hint: null, lines: review.map((m) => mapLine(m, m.review_reason!)) },
  ].filter((g) => g.lines.length);

  // open changes per system, workspace-wide; the system's panel opens on the canvas with most of its tables
  const open = new Map<Uuid, number>();
  for (const c of changes) if (isOpen(c)) open.set(c.source_system_id, (open.get(c.source_system_id) ?? 0) + 1);
  const tablesOf = (systemId: Uuid) => live(model.sourceTables).filter((t) => t.source_system_id === systemId).map((t) => t.id);
  const systems = live(model.sourceSystems)
    .filter((s) => open.has(s.id))
    .map((s) => ({ open: { t: "system" as const, id: s.id }, canvasId: best(tablesOf(s.id)), name: s.name, meta: CONSISTENCY_TEXT.toDecide(open.get(s.id)!) }));

  const count = groups.reduce((n, g) => n + g.lines.length, 0) + [...open.values()].reduce((n, x) => n + x, 0);
  return { groups, requirements, systems, count };
}
