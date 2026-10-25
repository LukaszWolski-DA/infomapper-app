// The commands on changes to resolve (slice 7b, items 10–19, P5–P10; step 1 answers F22, Q6, Q11): each checks who may
// act, the archive and the change's version, runs the action (`source-changes/actions.ts`), and returns its rows as one
// change group, one undo step, with what the toast says (“{resolution}: {label}”, item 19).
//   Approving again, leaving in review and approving all of an import's mappings answer a review: reviewers may do
//   them as they approve in the mapping panel (`mapping.set_status`, AD-05). Every other action changes the model
//   (`model.edit`: owners, admins, modelers). An archived workspace refuses all (AD-09).
//   Four-eyes (AD-06, D-51): the last content editor of a mapping (`lastContentEditor`, the importer after a send-back)
//   cannot approve it again.

import { z } from "zod";
import { fail, type CommandContext, type CommandResult } from "../changes";
import { domainError, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess, type WorkspaceAction } from "../permissions";
import {
  acknowledge,
  approveAgain,
  approveAllEdits,
  approveAllPlan,
  decideColumnByColumn,
  deleteForChange,
  leaveInReview,
  mapToAttribute,
  markAsNeeded,
  markNotNeeded,
  moveMappings,
  retire,
  type ActionResult,
  type BulkPlan,
  type ChangeActionRows,
} from "../source-changes/actions";
import type { SourceDeleteRows } from "../source-changes/delete";
import { RESOLUTION } from "../source-changes/texts";
import type { SourceColumn } from "../types";
import { parseInput, uuidSchema, versionSchema } from "../validation";
import { done, nothingToChange } from "./shared";

/** The workspace's rows an action reads; a delete reads its cascade's rows too. */
export type SourceChangeState = ChangeActionRows & Partial<Omit<SourceDeleteRows, keyof ChangeActionRows>>;

/** What the toast says: “{resolution}: {label}” (item 19). */
export interface ChangeOutcome {
  resolution: string;
  label: string;
}

const ref = { changeId: uuidSchema, expectedVersion: versionSchema };
const SOURCE_CHANGE_ACTIONS_INPUT = {
  retire: z.object(ref).strict(),
  move: z.object({ ...ref, targetColumnId: uuidSchema }).strict(),
  delete: z.object(ref).strict(),
  map: z.object({ ...ref, attributeId: uuidSchema }).strict(),
  notNeeded: z.object(ref).strict(),
  split: z.object(ref).strict(),
  approve: z.object(ref).strict(),
  leave: z.object(ref).strict(),
  acknowledge: z.object(ref).strict(),
};
export type SourceChangeInput = z.input<typeof SOURCE_CHANGE_ACTIONS_INPUT.retire>;
export type MoveMappingsInput = z.input<typeof SOURCE_CHANGE_ACTIONS_INPUT.move>;
export type MapChangeInput = z.input<typeof SOURCE_CHANGE_ACTIONS_INPUT.map>;

/** Permission first, then the input, then the change at the version the person read. */
function run<S extends z.ZodType<{ changeId: Uuid; expectedVersion: number }>>(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: SourceChangeState,
  action: WorkspaceAction,
  schema: S,
  input: unknown,
  act: (data: z.output<S>) => ActionResult,
): CommandResult<ChangeOutcome> {
  const denied = checkPermission(access, action);
  if (denied) return fail(denied);
  const parsed = parseInput(schema, input);
  if (!parsed.ok) return fail(parsed.error);
  const change = state.changes.find((c) => c.id === parsed.data.changeId && c.workspace_id === access.workspace.id && c.deleted_at === null);
  if (change && change.version !== parsed.data.expectedVersion) return fail(staleVersion());
  const result = act(parsed.data);
  if (!result.ok) return fail(result.error);
  return done(ctx, access, { resolution: result.resolution, label: result.change.object_label }, result.edits);
}

const deleteRows = (s: SourceChangeState): SourceDeleteRows & ChangeActionRows => ({
  ...s,
  relationships: s.relationships ?? [],
  relationshipColumns: s.relationshipColumns ?? [],
  canvasItems: s.canvasItems ?? [],
});

export const retireChange = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.retire, input, (i) => retire(ctx, state, i.changeId));

export const moveChangeMappings = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.move, input, (i) => moveMappings(ctx, state, i.changeId, i.targetColumnId));

export const deleteChangeObject = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.delete, input, (i) => deleteForChange(ctx, deleteRows(state), i.changeId));

export const mapChangeColumn = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.map, input, (i) => mapToAttribute(ctx, state, i.changeId, i.attributeId, access.workspace.id));

export const markChangeNotNeeded = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.notNeeded, input, (i) => markNotNeeded(ctx, state, i.changeId));

export const splitChange = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.split, input, (i) => decideColumnByColumn(ctx, state, i.changeId, access.workspace.id));

export const acknowledgeChange = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "model.edit", SOURCE_CHANGE_ACTIONS_INPUT.acknowledge, input, (i) => acknowledge(ctx, state, i.changeId));

/** Approve the mapping again (P8): `contentAuthorId` is the mapping's last content editor (four-eyes). */
export const approveChangeAgain = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState & { contentAuthorId: Uuid }, input: unknown) =>
  run(ctx, access, state, "mapping.set_status", SOURCE_CHANGE_ACTIONS_INPUT.approve, input, (i) => approveAgain(ctx, state, i.changeId, access.workspace, state.contentAuthorId));

export const leaveChangeInReview = (ctx: CommandContext, access: WorkspaceAccess, state: SourceChangeState, input: unknown) =>
  run(ctx, access, state, "mapping.set_status", SOURCE_CHANGE_ACTIONS_INPUT.leave, input, (i) => leaveInReview(ctx, state, i.changeId));

// ---- approve again all {n} (item 17, P9, Q11) ----

const approveAllInput = z.object({ importId: uuidSchema, count: z.number().int().min(1) }).strict();
export type ApproveAllInput = z.input<typeof approveAllInput>;

/**
 * Approves the mappings one import sent back that fit and that this person may approve, in one change group. `count`
 * is what the person saw (“Approve {n}”): a list that changed meanwhile is refused as stale, so nothing is approved
 * that was not shown.
 */
export function approveImportAgain(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: SourceChangeState & { authorOf: (mappingId: Uuid) => Uuid },
  input: unknown,
): CommandResult<ChangeOutcome & { approved: number; plan: BulkPlan }> {
  const denied = checkPermission(access, "mapping.set_status");
  if (denied) return fail(denied);
  const parsed = parseInput(approveAllInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const plan = approveAllPlan(state, parsed.data.importId, access.workspace, ctx.actorId, state.authorOf);
  if (!plan.approve.length) return fail(nothingToChange());
  if (plan.approve.length !== parsed.data.count) return fail(staleVersion());
  const n = plan.approve.length;
  return done(ctx, access, { resolution: RESOLUTION.approved, label: `${n} mapping${n === 1 ? "" : "s"}`, approved: n, plan }, approveAllEdits(ctx, state, plan));
}

// ---- mark as needed (P10, item 18) ----

const markNeededInput = z.object({ sourceColumnId: uuidSchema, expectedVersion: versionSchema }).strict();
export type MarkNeededInput = z.input<typeof markNeededInput>;

export function markColumnNeeded(ctx: CommandContext, access: WorkspaceAccess, state: { column: SourceColumn | null }, input: unknown): CommandResult<{ name: string }> {
  const denied = checkPermission(access, "model.edit");
  if (denied) return fail(denied);
  const parsed = parseInput(markNeededInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const c = state.column;
  if (!c || c.id !== parsed.data.sourceColumnId || c.workspace_id !== access.workspace.id) return fail(domainError("not_found", "This source column does not exist."));
  if (c.version !== parsed.data.expectedVersion) return fail(staleVersion());
  const result = markAsNeeded(ctx, c);
  if (!result.ok) return fail(result.error);
  return done(ctx, access, { name: c.name }, result.edits);
}
