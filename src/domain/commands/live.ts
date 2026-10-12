// Live label canvases (D-10, D-11, D-25) and the active working context (D-26), slice 3b.
//
// `completeLiveWrites` is the one step every write passes through after its command (run by the server's write
// pipeline, and by undo): in the same change group it
//   1. links the active context's label to what the action created or changed (`contextTargets`), and writes the label
//      into every change event (`context_label_id`);
//   2. labels the element of a card placed on a live canvas (a drop, a click in the left panel, the Entity tool: D-11's
//      “Add {label}” after the client's question; the Entity tool asks none);
//   3. brings every live canvas in line with what its label marks now (`syncLiveCanvas`), open or not.
// The commands here open a live canvas and take a card off one (which unlabels it).

import { z } from "zod";
import { buildWriteSet, fail, nextVersion, newRowColumns, type CommandContext, type CommandResult, type Write, type WriteSet } from "../changes";
import { domainError, notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { cardHeightFor } from "../model/card-size";
import { DEFAULT_CARD_WIDTH } from "../model/frames";
import { targetColumns, type LabelTarget } from "../model/labels";
import { CONTEXT_LABEL_GONE, contextTargets, liveCardHeight, liveMembership, liveRemoveQuestion, liveRemoveWhat, liveRowFilter, syncLiveCanvas, type LiveMembership, type LiveModel } from "../model/live";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import {
  DEFAULT_CANVAS_LOOK,
  type Attribute,
  type Canvas,
  type CanvasItem,
  type Concept,
  type Entity,
  type Frame,
  type Label,
  type LabelLink,
  type Mapping,
  type MappingInput,
  type Note,
  type Project,
  type ProjectCanvas,
  type SourceColumn,
  type SourceSystem,
  type SourceTable,
  type WritableRows,
  type WritableTable,
} from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { newCanvasItem } from "./canvas-item";
import { arrangedFrames, planArrangement } from "./frame";
import { releaseNotes } from "./note";
import { begin, done, isLive, nextSortOrder, softDeleted } from "./shared";

/** Everything the live rules read: the model, the working layer and the canvases (deleted rows may be included). */
export interface LiveWriteState {
  entities: readonly Entity[];
  attributes: readonly Attribute[];
  sourceTables: readonly SourceTable[];
  sourceColumns: readonly SourceColumn[];
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  concepts: readonly Concept[];
  sourceSystems: readonly SourceSystem[];
  labels: readonly Label[];
  labelLinks: readonly LabelLink[];
  canvases: readonly Canvas[];
  canvasItems: readonly CanvasItem[];
  frames: readonly Frame[];
  notes: readonly Note[];
}


const FIELD = {
  entity: "entities",
  attribute: "attributes",
  source_table: "sourceTables",
  source_column: "sourceColumns",
  mapping: "mappings",
  mapping_input: "mappingInputs",
  concept: "concepts",
  source_system: "sourceSystems",
  label: "labels",
  label_link: "labelLinks",
  canvas: "canvases",
  canvas_item: "canvasItems",
  frame: "frames",
  note: "notes",
} as const satisfies Partial<Record<WritableTable, keyof LiveWriteState>>;
type LiveTable = keyof typeof FIELD;
const isLiveTable = (t: WritableTable): t is LiveTable => t in FIELD;

/** The state as it is after these writes (inserts added, updates replacing their row). */
export function afterWrites(state: LiveWriteState, writes: readonly Write[]): LiveWriteState {
  const changed = new Map<LiveTable, Map<Uuid, { id: Uuid }>>();
  for (const w of writes) {
    if (w.kind === "remove" || !isLiveTable(w.table)) continue;
    const rows = changed.get(w.table) ?? new Map<Uuid, { id: Uuid }>();
    rows.set((w.row as { id: Uuid }).id, w.row as { id: Uuid });
    changed.set(w.table, rows);
  }
  if (!changed.size) return state;
  const next = { ...state } as Record<string, readonly { id: Uuid }[]>;
  for (const [table, rows] of changed) {
    const field = FIELD[table];
    const list = (state[field] as readonly { id: Uuid }[]).map((r) => rows.get(r.id) ?? r);
    const known = new Set(list.map((r) => r.id));
    for (const [id, row] of rows) if (!known.has(id)) list.push(row);
    next[field] = list;
  }
  return next as unknown as LiveWriteState;
}

/** The membership model of a state's live rows. */
function liveModelOf(s: LiveWriteState, ws: Uuid): LiveModel & { links: LabelLink[] } {
  return {
    attributes: s.attributes.filter((a) => isLive(a, ws)),
    sourceColumns: s.sourceColumns.filter((c) => isLive(c, ws)),
    mappings: s.mappings.filter((m) => isLive(m, ws)),
    mappingInputs: s.mappingInputs.filter((i) => isLive(i, ws)),
    links: s.labelLinks.filter((k) => isLive(k, ws)),
  };
}

const BOOKKEEPING = new Set(["version", "updated_at", "updated_by"]);

/** The writes of one action as they grow: an update of a row already written becomes part of that write. */
class Writes {
  readonly list: Write[];
  private readonly at = new Map<string, number>();
  constructor(
    private readonly ctx: CommandContext,
    initial: readonly Write[],
  ) {
    this.list = initial.map((w) => ({ ...w }) as Write);
    this.list.forEach((w, i) => {
      if (w.kind !== "remove") this.at.set(`${w.table}:${(w.row as { id?: Uuid }).id}`, i);
    });
  }
  insert<T extends WritableTable>(table: T, row: WritableRows[T]): void {
    this.at.set(`${table}:${(row as { id?: Uuid }).id}`, this.list.length);
    this.list.push({ kind: "insert", table, row } as Write);
  }
  /** Changes a row as the state after the writes has it; `row` is that state's row. */
  update<T extends WritableTable>(table: T, row: WritableRows[T], patch: Partial<WritableRows[T]>): void {
    const key = `${table}:${(row as { id: Uuid }).id}`;
    const i = this.at.get(key);
    if (i !== undefined) {
      const w = this.list[i]! as Write & { row: object };
      this.list[i] = { ...w, row: { ...w.row, ...patch } } as Write;
      return;
    }
    this.at.set(key, this.list.length);
    this.list.push({ kind: "update", table, before: row, row: nextVersion(this.ctx, row as never, patch as never) } as Write);
  }
  /** An update another command builder made (`before` → `row`): only what it changes is applied. */
  merge(w: Write): void {
    if (w.kind !== "update") return void this.list.push(w);
    const before = w.before as unknown as Record<string, unknown>, row = w.row as unknown as Record<string, unknown>;
    const patch = Object.fromEntries(Object.keys(row).filter((k) => !BOOKKEEPING.has(k) && before[k] !== row[k]).map((k) => [k, row[k]]));
    this.update(w.table, w.before, patch as never);
  }
}

export interface LiveCanvasChange {
  canvasId: Uuid;
  /** Names of the elements that came onto the canvas, and of those that left (the open canvas's toast, Q7). */
  added: string[];
  removed: string[];
}

export interface LiveOutcome {
  /** Items the active context labeled. */
  labeled: number;
  canvases: LiveCanvasChange[];
}

/** The columns of model rows that decide what a label brings onto a live canvas (besides a row's existence). */
const MEMBERSHIP_COLUMNS: Partial<Record<WritableTable, readonly string[]>> = {
  entity: [],
  attribute: ["entity_id"],
  source_table: [],
  source_column: ["source_table_id"],
  mapping: ["attribute_id"],
  mapping_input: ["mapping_id", "source_column_id"],
  canvas_item: [],
};

/**
 * Whether writes can change what a label marks or what a live canvas holds: label links, labels and canvases always;
 * model rows and cards when created, deleted or restored, or when what ties them together changes (an attribute's
 * entity, a mapping's attribute or inputs). Moving a card or renaming an attribute does not. The write pipeline loads
 * the live state only then.
 */
export function touchesLiveCanvases(writes: readonly Write[]): boolean {
  return writes.some((w) => {
    if (w.table === "label_link" || w.table === "label" || w.table === "canvas") return true;
    const columns = MEMBERSHIP_COLUMNS[w.table];
    if (!columns || w.kind === "remove") return false;
    if (w.kind === "insert") return true;
    const before = w.before as unknown as Record<string, unknown>, row = w.row as unknown as Record<string, unknown>;
    return before.deleted_at !== row.deleted_at || columns.some((c) => before[c] !== row[c]);
  });
}

/**
 * Completes one action's write set (see the file's comment): the context's labels, the labels of cards placed on live
 * canvases, and the sync of every live canvas, in the same change group. Refused when the context's label is gone or
 * the person may not change labels. Without a context and with nothing that touches labels, the model or the canvases,
 * the write set comes back as it was.
 */
export function completeLiveWrites(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: LiveWriteState,
  writeSet: WriteSet,
  options: { contextLabelId?: Uuid | null } = {},
): CommandResult<LiveOutcome> {
  const ws = access.workspace.id;
  const contextLabelId = options.contextLabelId ?? null;
  const touches = touchesLiveCanvases(writeSet.writes);
  if (!contextLabelId && !touches) return { ok: true, value: { labeled: 0, canvases: [] }, writeSet };

  const out = new Writes(ctx, writeSet.writes);
  let after = afterWrites(state, out.list);
  const linkedTo = (labelId: Uuid, target: LabelTarget) =>
    after.labelLinks.some((k) => isLive(k, ws) && k.label_id === labelId && k[`${target.kind}_id` as keyof LabelLink] === target.id);
  const link = (labelId: Uuid, target: LabelTarget) => {
    const row: LabelLink = { ...newRowColumns(ctx), workspace_id: ws, label_id: labelId, ...targetColumns(target) };
    out.insert("label_link", row);
    after = afterWrites(after, [{ kind: "insert", table: "label_link", row }]);
  };

  // 1. the active working context
  let labeled = 0;
  if (contextLabelId) {
    const denied = checkPermission(access, "label.edit");
    if (denied) return fail(denied);
    if (!isLive(after.labels.find((l) => l.id === contextLabelId), ws)) return fail(domainError("not_found", CONTEXT_LABEL_GONE));
    for (const target of contextTargets(writeSet.writes, writeSet.mainTargets)) {
      const rows = after[FIELD[target.kind]] as readonly { id: Uuid; workspace_id: Uuid; deleted_at: string | null }[];
      if (!isLive(rows.find((r) => r.id === target.id), ws) || linkedTo(contextLabelId, target)) continue;
      link(contextLabelId, target);
      labeled++;
    }
  }

  // 2. a card placed on a live canvas labels its element (cards the live rules make carry their level already)
  const liveLabelOf = (canvasId: Uuid) => after.canvases.find((c) => c.id === canvasId && isLive(c, ws))?.live_label_id ?? null;
  for (const w of writeSet.writes) {
    if (w.kind !== "insert" || w.table !== "canvas_item" || w.row.live_level !== null) continue;
    const labelId = liveLabelOf(w.row.canvas_id);
    if (!labelId) continue;
    const denied = checkPermission(access, "label.edit");
    if (denied) return fail(denied);
    const target: LabelTarget = w.row.entity_id ? { kind: "entity", id: w.row.entity_id } : { kind: "source_table", id: w.row.source_table_id! };
    if (!linkedTo(labelId, target)) link(labelId, target);
  }

  // 3. every live canvas follows its label
  const canvases: LiveCanvasChange[] = [];
  if (touches || out.list.length > writeSet.writes.length) {
    for (const canvas of after.canvases) {
      if (!isLive(canvas, ws) || !canvas.live_label_id || !isLive(after.labels.find((l) => l.id === canvas.live_label_id), ws)) continue;
      const change = syncCanvas(ctx, ws, after, canvas, out);
      if (change.added.length || change.removed.length) canvases.push(change);
      after = afterWrites(state, out.list);
    }
  }

  if (out.list.length === writeSet.writes.length && !contextLabelId && out.list.every((w, i) => w === writeSet.writes[i] || sameWrite(w, writeSet.writes[i]!))) {
    return { ok: true, value: { labeled, canvases }, writeSet };
  }
  const rebuilt = buildWriteSet(ctx, ws, out.list);
  const events = rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId, context_label_id: contextLabelId }));
  return { ok: true, value: { labeled, canvases }, writeSet: { ...writeSet, writes: out.list, events } };
}

const sameWrite = (a: Write, b: Write) => a.kind === b.kind && a.table === b.table && (a.kind === "remove" || (a as { row: unknown }).row === (b as { row: unknown }).row);

/** One live canvas's sync, added to the writes. */
function syncCanvas(ctx: CommandContext, ws: Uuid, s: LiveWriteState, canvas: Canvas, out: Writes): LiveCanvasChange {
  const labelId = canvas.live_label_id!;
  const membership = liveMembership(labelId, liveModelOf(s, ws));
  const items = s.canvasItems.filter((i) => isLive(i, ws) && i.canvas_id === canvas.id);
  const frames = s.frames.filter((f) => isLive(f, ws) && f.canvas_id === canvas.id);
  const boxes = [
    ...items.map((i) => ({ x: i.x, y: i.y, w: i.width ?? DEFAULT_CARD_WIDTH, itemId: i.id })),
    ...frames.map((f) => ({ x: f.x, y: f.y, w: f.width })),
  ];
  const byName = <R extends { id: Uuid; name: string }>(rows: readonly R[], ids: Iterable<Uuid>) => {
    const want = new Set(ids);
    return rows.filter((r) => want.has(r.id) && isLive(r as never, ws)).sort((a, b) => a.name.localeCompare(b.name)).map((r) => r.id);
  };
  const sync = syncLiveCanvas(items, membership, boxes, (t, filter) => liveCardHeight(rowIdsOf(s, ws, t), filter, membership), {
    tables: byName(s.sourceTables, membership.tables.keys()),
    entities: byName(s.entities, membership.entities.keys()),
  });

  for (const item of sync.leave) out.update("canvas_item", item, { deleted_at: ctx.now });
  for (const w of releaseNotes(ctx, s.notes, { items: sync.leave, frames: [] }, { cardIds: sync.leave.map((i) => i.id) })) out.merge(w);
  for (const { item, level, rowFilter } of sync.relevel) out.update("canvas_item", item, { live_level: level, row_filter: rowFilter });
  for (const a of sync.add) {
    const row = newCanvasItem(ctx, ws, canvas.id, a.kind === "entity" ? { entity_id: a.id } : { source_table_id: a.id }, { x: a.x, y: a.y });
    out.insert("canvas_item", { ...row, live_level: a.level, row_filter: a.rowFilter });
  }
  const nameOf = (kind: "entity" | "source_table", id: Uuid) => (kind === "entity" ? s.entities : s.sourceTables).find((r) => r.id === id)?.name ?? "?";
  return {
    canvasId: canvas.id,
    added: sync.add.map((a) => nameOf(a.kind, a.id)),
    removed: sync.leave.map((i) => (i.entity_id ? nameOf("entity", i.entity_id) : nameOf("source_table", i.source_table_id!))),
  };
}

/** The attribute or column ids of an element, in their order (for a card's height). */
function rowIdsOf(s: LiveWriteState, ws: Uuid, t: { kind: "entity" | "source_table"; id: Uuid }): Uuid[] {
  return t.kind === "entity"
    ? s.attributes.filter((a) => isLive(a, ws) && a.entity_id === t.id).map((a) => a.id)
    : s.sourceColumns.filter((c) => isLive(c, ws) && c.source_table_id === t.id).map((c) => c.id);
}

// ---- open a live canvas (PRD item 6) ----

const openInput = z.object({ labelId: uuidSchema, projectId: uuidSchema }).strict();
export type OpenLiveCanvasInput = z.input<typeof openInput>;

export interface OpenLiveCanvasState extends LiveWriteState {
  project: Project | null;
  /** The workspace's canvas links (to find the live canvas's projects and to put a new tab last). */
  projectLinks: readonly ProjectCanvas[];
}

/**
 * Opens label L's live canvas: the one it has (added to this project when it is not in it yet), or a new canvas named
 * after L in this project, with L's full elements (row filter `all`) and context elements (`labeled`) arranged into
 * frames by concept and system (slice 2b's rule, heights from the domain). A label has at most one live canvas.
 */
export function openLiveCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: OpenLiveCanvasState,
  input: unknown,
): CommandResult<{ canvasId: Uuid; name: string; created: boolean; addedToProject: boolean }> {
  const parsed = begin(access, "canvas.create", openInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { labelId, projectId } = parsed.data;
  const ws = access.workspace.id;
  const label = state.labels.find((l) => l.id === labelId);
  if (!isLive(label, ws)) return fail(notFound("label"));
  if (!isLive(state.project, ws) || state.project.id !== projectId) return fail(notFound("project"));
  const linkOf = (canvasId: Uuid): ProjectCanvas => ({
    project_id: projectId,
    canvas_id: canvasId,
    workspace_id: ws,
    sort_order: nextSortOrder(state.projectLinks.filter((l) => l.project_id === projectId)),
    added_at: ctx.now,
    added_by: ctx.actorId,
  });

  const existing = state.canvases.find((c) => isLive(c, ws) && c.live_label_id === labelId);
  if (existing) {
    if (state.projectLinks.some((l) => l.project_id === projectId && l.canvas_id === existing.id)) {
      return done(ctx, access, { canvasId: existing.id, name: existing.name, created: false, addedToProject: false }, []);
    }
    const denied = checkPermission(access, "canvas.edit_projects");
    if (denied) return fail(denied);
    return done(ctx, access, { canvasId: existing.id, name: existing.name, created: false, addedToProject: true }, [
      { kind: "insert", table: "project_canvas", row: linkOf(existing.id) },
    ]);
  }

  const canvas: Canvas = { ...newRowColumns(ctx), workspace_id: ws, name: label.name, live_label_id: labelId, look: { ...DEFAULT_CANVAS_LOOK } };
  const membership = liveMembership(labelId, liveModelOf(state, ws));
  const items: CanvasItem[] = [
    ...[...membership.tables].map(([id, level]) => ({ ...newCanvasItem(ctx, ws, canvas.id, { source_table_id: id }, { x: 0, y: 0 }), live_level: level, row_filter: liveRowFilter(level) })),
    ...[...membership.entities].map(([id, level]) => ({ ...newCanvasItem(ctx, ws, canvas.id, { entity_id: id }, { x: 0, y: 0 }), live_level: level, row_filter: liveRowFilter(level) })),
  ];
  const writes: Write[] = [
    { kind: "insert", table: "canvas", row: canvas },
    { kind: "insert", table: "project_canvas", row: linkOf(canvas.id) },
  ];
  if (items.length) {
    const heightOf = (i: CanvasItem) => cardHeightOfItem(state, ws, i, membership);
    const { layout, names } = planArrangement(ws, state, items, (i) => ({ width: DEFAULT_CARD_WIDTH, height: heightOf(i) }));
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const { frame, cardIds } of arrangedFrames(ctx, access, canvas.id, layout, names)) {
      writes.push({ kind: "insert", table: "frame", row: frame });
      for (const id of cardIds) Object.assign(byId.get(id)!, { ...layout.positions.get(id)!, frame_id: frame.id });
    }
    writes.push(...items.map((row): Write => ({ kind: "insert", table: "canvas_item", row })));
  }
  return done(ctx, access, { canvasId: canvas.id, name: canvas.name, created: true, addedToProject: false }, writes);
}

function cardHeightOfItem(s: LiveWriteState, ws: Uuid, item: CanvasItem, membership: LiveMembership): number {
  const t = item.entity_id ? { kind: "entity" as const, id: item.entity_id } : { kind: "source_table" as const, id: item.source_table_id! };
  return item.collapsed ? cardHeightFor(0, true) : liveCardHeight(rowIdsOf(s, ws, t), item.row_filter, membership);
}

// ---- take a card off a live canvas: unlabel (PRD item 11) ----

const removeInput = z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RemoveFromLiveCanvasInput = z.input<typeof removeInput>;

/**
 * “Remove from this canvas (unlabel)…”: when the label is on the element itself, it comes off the element (the card
 * stays as context when rows or mappings of it carry the label too); when the element is here as context only, the
 * label comes off those rows and mappings. The card follows through the sync (`completeLiveWrites`).
 */
export function removeFromLiveCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: LiveWriteState,
  input: unknown,
): CommandResult<{ name: string; label: string; mode: "direct" | "context"; what: string; keptAsContext: boolean }> {
  const parsed = begin(access, "label.edit", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const ws = access.workspace.id;
  const item = state.canvasItems.find((i) => i.id === parsed.data.canvasItemId);
  if (!isLive(item, ws)) return fail(notFound("card"));
  if (item.version !== parsed.data.expectedVersion) return fail(staleVersion());
  const canvas = state.canvases.find((c) => c.id === item.canvas_id);
  const label = state.labels.find((l) => l.id === canvas?.live_label_id);
  if (!isLive(canvas, ws) || !isLive(label, ws)) return fail(domainError("invalid", "This is not a live canvas."));

  const target = item.entity_id ? { kind: "entity" as const, id: item.entity_id } : { kind: "source_table" as const, id: item.source_table_id! };
  const name = (target.kind === "entity" ? state.entities : state.sourceTables).find((r) => r.id === target.id)?.name ?? "?";
  const q = liveRemoveQuestion(label.id, target, liveModelOf(state, ws));
  const what = liveRemoveWhat(q, target.kind);
  const off = (k: LabelLink): Write => ({ kind: "update", table: "label_link", before: k, row: softDeleted(ctx, k) });
  if (q.direct) {
    return done(ctx, access, { name, label: label.name, mode: "direct", what, keptAsContext: q.viaRows.length + q.viaMappings.length > 0 }, [off(q.direct)]);
  }
  const links = [...q.viaRows, ...q.viaMappings];
  if (!links.length) return fail(domainError("invalid", "Nothing to change."));
  return done(ctx, access, { name, label: label.name, mode: "context", what, keptAsContext: false }, links.map(off));
}
