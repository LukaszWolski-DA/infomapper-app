"use server";

// Changes to resolve (slice 7b, items 10–19): the actions on a change's card, “Approve again all {n}” for an import,
// and “Mark as needed” on a column. Each is one write through its domain command (AD-23), one change group, one undo
// step; the toast reads “{resolution}: {label}” with Undo (step 4).

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { writtenVersions, type CommandContext, type CommandResult } from "@/domain/changes";
import {
  acknowledgeChange,
  approveChangeAgain,
  approveImportAgain,
  deleteChangeObject,
  leaveChangeInReview,
  mapChangeColumn,
  markChangeNotNeeded,
  markColumnNeeded,
  moveChangeMappings,
  retireChange,
  splitChange,
  type ApproveAllInput,
  type ChangeOutcome,
  type MapChangeInput,
  type MarkNeededInput,
  type MoveMappingsInput,
  type SourceChangeInput,
  type SourceChangeState,
} from "@/domain/commands/source-change";
import type { Uuid } from "@/domain/ids";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import type { WorkspaceAccess } from "@/domain/permissions";
import { sourceDeleteCascade, sourceDeleteImpact, type SourceDeleteImpact } from "@/domain/source-changes/delete";
import { getDataStore } from "@/data";
import { getSession } from "../_lib/session";
import { lockedRefusal } from "../_lib/unlock";
import { runCommand, type ActionResult, type Saved } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

/** The rows a change's action reads: the model, the changes, and what a delete takes with it. */
async function stateOf(store: DataStore, workspaceId: Uuid): Promise<SourceChangeState> {
  const [model, changes, canvasItems, frames, notes, labelLinks, requirementLinks] = await Promise.all([
    store.model.load(workspaceId),
    store.model.listChanges(workspaceId),
    store.canvasItems.list(workspaceId),
    store.frames.list(workspaceId),
    store.notes.list(workspaceId),
    store.labels.listLinks(workspaceId),
    store.requirements.listLinks(workspaceId),
  ]);
  return {
    tables: model.sourceTables,
    columns: model.sourceColumns,
    mappings: model.mappings,
    mappingInputs: model.mappingInputs,
    attributes: model.attributes,
    entities: model.entities,
    changes,
    relationships: model.sourceRelationships,
    relationshipColumns: model.sourceRelationshipColumns,
    canvasItems,
    frames,
    notes,
    labelLinks,
    requirementLinks,
    classificationLinks: model.classificationLinks,
  };
}

/**
 * Runs a change's action. The answer carries the versions it wrote (slice 10a, F2): only the server knows which tables,
 * columns and mappings an action writes, so the browser's next saves of those rows take their versions from here.
 */
async function changeCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, store: DataStore) => Promise<CommandResult<T>> | CommandResult<T>,
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    if (typeof workspaceId !== "string") return NOT_FOUND;
    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    return build(ctx, access, await stateOf(store, workspace.id), store);
  }, { versions: true });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function retireChangeAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => retireChange(ctx, access, state, input));
}

export async function moveChangeMappingsAction(workspaceId: string, input: MoveMappingsInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => moveChangeMappings(ctx, access, state, input));
}

export async function deleteChangeObjectAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => deleteChangeObject(ctx, access, state, input));
}

export async function mapChangeColumnAction(workspaceId: string, input: MapChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => mapChangeColumn(ctx, access, state, input));
}

export async function markChangeNotNeededAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => markChangeNotNeeded(ctx, access, state, input));
}

export async function splitChangeAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => splitChange(ctx, access, state, input));
}

export async function acknowledgeChangeAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => acknowledgeChange(ctx, access, state, input));
}

export async function leaveChangeInReviewAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, (ctx, access, state) => leaveChangeInReview(ctx, access, state, input));
}

export async function approveChangeAgainAction(workspaceId: string, input: SourceChangeInput): Promise<ActionResult<ChangeOutcome>> {
  return changeCommand(workspaceId, async (ctx, access, state, store) => {
    const change = state.changes.find((c) => c.id === input?.changeId);
    const mapping = change?.mapping_id ? state.mappings.find((m) => m.id === change.mapping_id) : undefined;
    const contentAuthorId = mapping ? lastContentEditor(mapping, await store.changeEvents.listForMapping(access.workspace.id, mapping.id)) : ctx.actorId;
    return approveChangeAgain(ctx, access, { ...state, contentAuthorId }, input);
  });
}

export async function approveImportAgainAction(workspaceId: string, input: ApproveAllInput): Promise<ActionResult<ChangeOutcome & { approved: number }>> {
  return changeCommand(workspaceId, async (ctx, access, state, store) => {
    // four-eyes reads each mapping's last content editor from the change log (AD-06); off, nobody is refused
    const events = access.workspace.four_eyes ? await store.changeEvents.list(access.workspace.id) : [];
    const mappings = new Map(state.mappings.map((m) => [m.id, m]));
    const authorOf = (id: Uuid) => (access.workspace.four_eyes && mappings.has(id) ? lastContentEditor(mappings.get(id)!, events) : "");
    const result = approveImportAgain(ctx, access, { ...state, authorOf }, input);
    return result.ok ? { ...result, value: { resolution: result.value.resolution, label: result.value.label, approved: result.value.approved } } : result;
  });
}

/** “Mark as needed”; the column's version lets its note, typed right after, through (slice 10a, F1). */
export async function markColumnNeededAction(workspaceId: string, input: MarkNeededInput): Promise<ActionResult<Saved<{ name: string }>>> {
  return changeCommand(workspaceId, (ctx, access, state) => {
    const column = state.columns.find((c) => c.id === input?.sourceColumnId) ?? null;
    const result = markColumnNeeded(ctx, access, { column }, input);
    if (!result.ok) return result;
    // found, or the command refused it
    return { ...result, value: { name: result.value.name, version: writtenVersions(result.writeSet.writes)[column!.id]! } };
  });
}

/**
 * What a delete of a source table or column takes with it, before anything happens (D-47, item 13; step 1 answer Q7):
 * read on the server, where every canvas's cards and the requirements are, for the change's “Delete…” and the table
 * panel's “Delete table”. Reading needs membership only; the delete itself checks the rights.
 */
export async function sourceDeleteImpactAction(workspaceId: string, target: { tableId: string } | { columnId: string }): Promise<ActionResult<SourceDeleteImpact>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const { user } = session;
  const store = getDataStore();
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  if (!workspace || !(await store.workspaces.getMember(workspace.id, user.id))) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
  const locked = await lockedRefusal(store, session.unlocked, workspace.organization_id);
  if (locked) return locked;
  const [state, canvases, requirements] = await Promise.all([stateOf(store, workspace.id), store.canvases.list(workspace.id), store.requirements.list(workspace.id)]);
  const rows = { ...state, relationships: state.relationships ?? [], relationshipColumns: state.relationshipColumns ?? [], canvasItems: state.canvasItems ?? [] };
  const cascade = target && typeof target === "object" ? sourceDeleteCascade(rows, "tableId" in target ? { tableId: target.tableId } : { columnId: target.columnId }) : null;
  if (!cascade) return { ok: false, code: "not_found", message: "This table or column does not exist any more." };
  return { ok: true, value: sourceDeleteImpact(rows, cascade, { canvases, requirements, requirementLinks: state.requirementLinks ?? [] }) };
}
