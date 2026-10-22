// Undo and redo (slice 1b, AD-13): one change group is one step. Undo writes the group's before-images back as a new
// change group; redo is the undo of that undo. A step is refused when any of its rows has changed since (another
// person, or a later change): its content differs from what the step left, version and updated_* aside, so steps can
// be undone one after the other and a row changed and changed back counts as unchanged. The write itself still carries
// the row's current version (AD-12), so a change that arrives meanwhile is refused by the adapter. A step is also
// refused when reverting it would leave the model inconsistent: a live row whose parent is
// deleted, or a deleted row that live rows still point to. Permissions and the archive apply as to any write; the
// steps themselves come from the person's own history (`model/undo-history.ts`).
// A canvas's look and layer mode are outside undo (D-12, slice 2a): a later change of only `canvas.look` does not
// count as “changed afterwards”, and a canvas row that is written back keeps its current look.
// Slice 3a: labels, label links and notes are undo steps (Łukasz's step 0 answer 3); pinning a label to a project is
// written with its change events but is not an undo step (step 0 answer 3), while the pins that go with a deleted label
// come back when its deletion is undone.
// Slice 4a: requirements and requirement links are undo steps. Creating a requirement also raises the workspace's key
// counter; that write is never reverted (a key is not given out twice), and alone it is not an undo step. A step that
// would bring back a requirement whose key another live requirement uses by then is refused (Łukasz, step 0).

import { buildWriteSet, fail, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, type DomainError } from "../errors";
import { keyTakenMessage, requirementKey, restoreKeyTakenMessage } from "../model/requirements";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess, type WorkspaceAction } from "../permissions";
import { LINK_TABLES, type ChangeEvent, type LinkTable, type RowImage, type WritableRows } from "../types";

export const UNDO_REFUSED_MESSAGE = "This can't be undone because it was changed afterwards.";
export const REDO_REFUSED_MESSAGE = "This can't be redone because it was changed afterwards.";
export const NOT_UNDOABLE_MESSAGE = "This change can't be undone.";

/**
 * The tables in the undo history: the model, the layout and the working layer (slice 3a). Workspace settings and people
 * are outside it, as in the prototype, and so is a canvas's look (D-12).
 */
export const UNDOABLE_TABLES = [
  "project",
  "canvas",
  "project_canvas",
  "concept",
  "entity",
  "attribute",
  "relationship",
  "source_system",
  "source_table",
  "source_column",
  "source_relationship",
  "source_relationship_column",
  "source_import",
  "mapping",
  "mapping_input",
  "canvas_item",
  "frame",
  "label",
  "label_link",
  "project_pinned_label",
  "note",
  "requirement",
  "requirement_link",
] as const;
export type UndoableTable = (typeof UNDOABLE_TABLES)[number];

/** The workspace's current rows of every undoable table, deleted rows included. */
export type WorkspaceRows = { [T in UndoableTable]: readonly WritableRows[T][] };

type AnyRow = RowImage;

/** Columns that point to a parent row whose deletion the domain cascades (data model, section 11). */
const PARENTS: Partial<Record<UndoableTable, readonly (readonly [string, UndoableTable])[]>> = {
  project_canvas: [["project_id", "project"], ["canvas_id", "canvas"]],
  entity: [["concept_id", "concept"]],
  attribute: [["entity_id", "entity"]],
  relationship: [["from_entity_id", "entity"], ["to_entity_id", "entity"]],
  source_table: [["source_system_id", "source_system"]],
  source_column: [["source_table_id", "source_table"]],
  source_relationship: [["source_table_id", "source_table"], ["to_source_table_id", "source_table"]],
  source_relationship_column: [["source_relationship_id", "source_relationship"], ["from_column_id", "source_column"], ["to_column_id", "source_column"]],
  source_import: [["source_system_id", "source_system"]],
  mapping: [["attribute_id", "attribute"]],
  mapping_input: [["mapping_id", "mapping"], ["source_column_id", "source_column"]],
  canvas_item: [["canvas_id", "canvas"], ["entity_id", "entity"], ["source_table_id", "source_table"], ["requirement_id", "requirement"], ["frame_id", "frame"]],
  frame: [["canvas_id", "canvas"], ["concept_id", "concept"], ["source_system_id", "source_system"]],
  label_link: [
    ["label_id", "label"],
    ["entity_id", "entity"],
    ["attribute_id", "attribute"],
    ["mapping_id", "mapping"],
    ["source_table_id", "source_table"],
    ["source_column_id", "source_column"],
  ],
  project_pinned_label: [["project_id", "project"], ["label_id", "label"]],
  note: [["canvas_id", "canvas"], ["pin_canvas_item_id", "canvas_item"], ["pin_frame_id", "frame"], ["frame_id", "frame"]],
  requirement: [["parent_id", "requirement"]],
  requirement_link: [
    ["requirement_id", "requirement"],
    ["entity_id", "entity"],
    ["attribute_id", "attribute"],
    ["mapping_id", "mapping"],
    ["source_table_id", "source_table"],
    ["source_column_id", "source_column"],
  ],
};

const isUndoableTable = (table: string): table is UndoableTable => (UNDOABLE_TABLES as readonly string[]).includes(table);

const isLinkTable = (table: string): table is LinkTable => (LINK_TABLES as readonly string[]).includes(table);

/** Link tables have no id or version: the key is the pair, and a row is removed rather than soft-deleted. */
const keyOf = (table: UndoableTable, row: AnyRow): string =>
  table === "project_canvas"
    ? `${String(row.project_id)}|${String(row.canvas_id)}`
    : table === "project_pinned_label"
      ? `${String(row.project_id)}|${String(row.label_id)}`
      : String(row.id);

const isLiveRow = (table: UndoableTable, row: AnyRow | undefined): boolean =>
  !!row && (isLinkTable(table) || row.deleted_at === null);

const BOOKKEEPING = new Set(["version", "updated_at", "updated_by"]);

/** The workspace's requirement key counter going up with a new requirement (slice 4a): kept, never reverted. */
function isKeyCounter(e: ChangeEvent): boolean {
  if (e.object_type !== "workspace" || e.operation !== "update" || !e.before_image || !e.after_image) return false;
  const changed = Object.keys({ ...e.before_image, ...e.after_image }).filter((k) => !BOOKKEEPING.has(k) && !sameValue(e.before_image![k], e.after_image![k]));
  return changed.length > 0 && changed.every((k) => k === "requirement_key_next");
}

/**
 * A change group can be undone when every row it wrote is in the undo history's tables and no canvas look changed.
 * Pinning or unpinning a label on a project alone is not an undo step (slice 3a), nor is the requirement key counter.
 */
export function isUndoable(events: readonly ChangeEvent[]): boolean {
  const rows = events.filter((e) => !isKeyCounter(e));
  return (
    rows.length > 0 &&
    !rows.every((e) => e.object_type === "project_pinned_label") &&
    rows.every(
      (e) =>
        isUndoableTable(e.object_type) &&
        !(e.object_type === "canvas" && e.before_image && e.after_image && !sameValue(e.before_image.look, e.after_image.look)),
    )
  );
}
// slice 7a: approving clears an import's `review_reason`, so a reviewer's approval may change it too
const STATUS_COLUMNS = new Set(["status", "approved_by", "approved_at", "review_reason"]);

/** Whether an update changed only status columns (a reviewer's approval). */
function statusOnly(e: ChangeEvent): boolean {
  if (!e.before_image || !e.after_image) return false;
  const changed = Object.keys({ ...e.before_image, ...e.after_image }).filter((k) => !BOOKKEEPING.has(k) && !sameValue(e.before_image![k], e.after_image![k]));
  return changed.length > 0 && changed.every((k) => STATUS_COLUMNS.has(k));
}

/**
 * The action a person needs to write this event's row again (AD-05); reviewers can only change a mapping's or a
 * requirement's status.
 */
function actionFor(e: ChangeEvent): WorkspaceAction {
  switch (e.object_type) {
    case "mapping":
      return statusOnly(e) ? "mapping.set_status" : "model.edit";
    case "requirement":
      return statusOnly(e) ? "requirement.set_status" : "requirement.edit";
    case "requirement_link":
      return "requirement.edit";
    case "canvas_item":
    case "frame":
      return "canvas.edit_items";
    case "project_canvas":
      return "canvas.edit_projects";
    case "project":
      return "project.create";
    case "label":
    case "label_link":
    case "project_pinned_label":
      return "label.edit";
    case "note":
      return "note.edit";
    case "canvas":
      return e.operation === "create" ? "canvas.create" : e.operation === "update" ? "canvas.rename" : "canvas.delete";
    default:
      return "model.edit";
  }
}

const refusal = (mode: "undo" | "redo"): DomainError =>
  domainError("conflict", mode === "undo" ? UNDO_REFUSED_MESSAGE : REDO_REFUSED_MESSAGE);

export interface RevertState {
  /** The events of the change group to revert, as recorded. */
  events: readonly ChangeEvent[];
  /** The workspace's current rows. */
  rows: WorkspaceRows;
}

/**
 * Reverts one change group of the acting person: `undo` for a step from the history, `redo` for the undo group of a
 * step that was undone. Returns the new change group; its id goes into the history.
 */
export function revertChangeGroup(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: RevertState,
  mode: "undo" | "redo",
): CommandResult<{ changeGroupId: Uuid }> {
  const refused = () => refusal(mode);
  const events = state.events;
  const workspaceId = access.workspace.id;
  if (!isUndoable(events) || events.some((e) => e.workspace_id !== workspaceId)) {
    return fail(domainError("invalid", NOT_UNDOABLE_MESSAGE));
  }
  if (events.some((e) => e.user_id !== ctx.actorId)) {
    return fail(domainError("forbidden", "You can only undo your own changes."));
  }
  for (const action of new Set(events.filter((e) => !isKeyCounter(e)).map(actionFor))) {
    const denied = checkPermission(access, action);
    if (denied) return fail(denied);
  }

  // The rows as they are now, then as they will be after the revert.
  const now = new Map<UndoableTable, Map<string, AnyRow>>();
  for (const table of UNDOABLE_TABLES) {
    const rows = (state.rows[table] as readonly unknown[] as readonly AnyRow[]).filter((r) => r.workspace_id === workspaceId);
    now.set(table, new Map(rows.map((r) => [keyOf(table, r), r])));
  }
  const after = new Map([...now].map(([t, rows]) => [t, new Map(rows)]));
  const touched: { table: UndoableTable; key: string; wasLive: boolean }[] = [];
  const writes: Write[] = [];

  for (const e of [...events].reverse()) {
    if (isKeyCounter(e)) continue;
    const table = e.object_type as UndoableTable;
    const rows = after.get(table)!;
    const image = (e.after_image ?? e.before_image)!;
    const key = keyOf(table, image);
    const current = rows.get(key);
    touched.push({ table, key, wasLive: isLiveRow(table, now.get(table)!.get(key)) });

    if (isLinkTable(table)) {
      if (e.after_image) {
        // The link was added: it must still be there as it was, and goes again.
        if (!current || !sameValue(current, e.after_image)) return fail(refused());
        writes.push({ kind: "remove", table, before: current } as unknown as Write);
        rows.delete(key);
      } else {
        // The link was removed: it must still be absent, and comes back.
        if (current) return fail(refused());
        const row = structuredClone(e.before_image!);
        writes.push({ kind: "insert", table, row } as unknown as Write);
        rows.set(key, row);
      }
      continue;
    }

    if (!current || !e.after_image || !unchangedSince(table, current, e.after_image)) return fail(refused());
    const base = e.before_image ?? { ...current, deleted_at: ctx.now };
    const row: AnyRow = { ...structuredClone(base), version: (current.version as number) + 1, updated_at: ctx.now, updated_by: ctx.actorId };
    if (table === "canvas") row.look = structuredClone(current.look);
    writes.push({ kind: "update", table, before: current, row } as unknown as Write);
    rows.set(key, row);
  }

  if (!consistent(after, touched)) return fail(refused());
  const keyClash = requirementKeyClash(after, touched);
  if (keyClash) return fail(keyClash);
  const writeSet = buildWriteSet(ctx, workspaceId, writes);
  return { ok: true, value: { changeGroupId: writeSet.changeGroupId }, writeSet };
}

/**
 * The row's content is what the step left (its after-image), version and updated_* aside, and for a canvas its look
 * (D-12). An undo before it only raised the version, so the next older step still matches.
 */
function unchangedSince(table: UndoableTable, current: AnyRow, image: AnyRow): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(image)]);
  // a column added to the table after the step was recorded is null on the row and absent from the image (slice 7a)
  return [...keys].every((k) => BOOKKEEPING.has(k) || (table === "canvas" && k === "look") || sameValue(current[k] ?? null, image[k] ?? null));
}

/**
 * After the revert: every touched live row has live parents; every touched row that stopped being live has no live
 * children; a card that comes back is not on its canvas twice; a canvas keeps at least one project and a project at
 * least one canvas (D-28).
 */
function consistent(rows: Map<UndoableTable, Map<string, AnyRow>>, touched: readonly { table: UndoableTable; key: string; wasLive: boolean }[]): boolean {
  const live = (table: UndoableTable, id: unknown) => typeof id === "string" && isLiveRow(table, rows.get(table)!.get(id));
  // built once per revert (slice 7a: an import's undo touches tens of thousands of rows): the parents that have live
  // children, and the live cards per canvas and element
  let parentsWithChildren: Set<string> | null = null;
  const hasLiveChild = (table: UndoableTable, key: string) => {
    if (!parentsWithChildren) {
      parentsWithChildren = new Set();
      for (const [childTable, refs] of Object.entries(PARENTS) as [UndoableTable, readonly (readonly [string, UndoableTable])[]][]) {
        for (const child of rows.get(childTable)!.values()) {
          if (!isLiveRow(childTable, child)) continue;
          for (const [column, parent] of refs) if (typeof child[column] === "string") parentsWithChildren.add(`${parent}|${child[column] as string}`);
        }
      }
    }
    return parentsWithChildren.has(`${table}|${key}`);
  };
  let cardsOn: Map<string, number> | null = null;
  const cardKey = (c: AnyRow) => `${String(c.canvas_id)}|${String(c.entity_id ?? "")}|${String(c.source_table_id ?? "")}`;
  const cardsAt = (c: AnyRow) => {
    if (!cardsOn) {
      cardsOn = new Map();
      for (const o of rows.get("canvas_item")!.values()) {
        if (o.deleted_at !== null || (o.entity_id === null && o.source_table_id === null)) continue;
        cardsOn.set(cardKey(o), (cardsOn.get(cardKey(o)) ?? 0) + 1);
      }
    }
    return cardsOn.get(cardKey(c)) ?? 0;
  };
  for (const { table, key, wasLive } of touched) {
    const row = rows.get(table)!.get(key);
    if (isLiveRow(table, row)) {
      for (const [column, parent] of PARENTS[table] ?? []) {
        if (row![column] !== null && !live(parent, row![column])) return false;
      }
      // a card that comes back must not be on its canvas twice (itself counted once)
      if (table === "canvas_item" && !wasLive && (row!.entity_id !== null || row!.source_table_id !== null) && cardsAt(row!) > 1) return false;
    } else if (wasLive) {
      if (table === "project_canvas") {
        const [projectId, canvasId] = key.split("|");
        const links = [...rows.get("project_canvas")!.values()];
        if (live("canvas", canvasId) && !links.some((l) => l.canvas_id === canvasId)) return false;
        if (live("project", projectId) && !links.some((l) => l.project_id === projectId)) return false;
        continue;
      }
      if (isLinkTable(table)) continue;
      if (hasLiveChild(table, key)) return false;
    }
  }
  return true;
}

/**
 * A requirement that is live after the revert and whose key, in any case, another live requirement has (Łukasz, step
 * 0): bringing back a deleted one, or giving one its old key back.
 */
function requirementKeyClash(rows: Map<UndoableTable, Map<string, AnyRow>>, touched: readonly { table: UndoableTable; key: string; wasLive: boolean }[]): DomainError | null {
  const requirements = [...rows.get("requirement")!.values()].filter((r) => r.deleted_at === null);
  for (const { table, key, wasLive } of touched) {
    if (table !== "requirement") continue;
    const row = rows.get("requirement")!.get(key);
    if (!row || row.deleted_at !== null) continue;
    const k = requirementKey(String(row.key));
    if (requirements.some((o) => o.id !== row.id && requirementKey(String(o.key)) === k)) {
      return domainError("conflict", wasLive ? keyTakenMessage(String(row.key)) : restoreKeyTakenMessage(String(row.key)));
    }
  }
  return null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
