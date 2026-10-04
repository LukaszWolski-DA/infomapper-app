"use server";

// Mapping writes from the right panel (slice 1a, AD-26, D-49): create from the attribute panel, kind, rule and note,
// the Inputs section, status with four-eyes (AD-06), delete. Changes to an approved mapping's inputs, kind or rule
// send it back to review (D-51); the domain's notice comes back for a toast.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import {
  addMappingInput,
  createMapping,
  deleteMapping,
  removeMappingInput,
  reorderMappingInputs,
  setMappingStatus,
  updateMapping,
  type AddMappingInputInput,
  type RemoveMappingInputInput,
  type ReorderMappingInputsInput,
  type SetMappingStatusInput,
  type UpdateMappingInput,
} from "@/domain/commands/mapping";
import type { Uuid } from "@/domain/ids";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { WorkspaceModel } from "@/domain/types";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

async function mappingCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, model: WorkspaceModel, store: DataStore) => Promise<CommandResult<T>> | CommandResult<T>,
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    if (typeof workspaceId !== "string") return NOT_FOUND;
    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    return build(ctx, access, await store.model.load(workspace.id), store);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const byId = <R extends { id: string }>(rows: readonly R[], id: unknown): R | null => rows.find((r) => r.id === id) ?? null;
const mappingState = (model: WorkspaceModel, mappingId: unknown) => ({
  mapping: byId(model.mappings, mappingId),
  inputs: model.mappingInputs.filter((i) => i.mapping_id === mappingId),
});
type Notice = { notice: string | null };
const withNotice = <T extends Notice>(r: CommandResult<T>): CommandResult<Notice> => (r.ok ? { ...r, value: { notice: r.value.notice } } : r);

/** “Add a source column” in the attribute panel: a direct draft mapping. */
export async function createMappingAction(
  workspaceId: string,
  input: { attributeId: string; sourceColumnId: string },
): Promise<ActionResult<{ mappingId: Uuid }>> {
  return mappingCommand(workspaceId, (ctx, access, model) =>
    createMapping(
      ctx,
      access,
      {
        attribute: byId(model.attributes, input?.attributeId),
        column: byId(model.sourceColumns, input?.sourceColumnId),
        mappings: model.mappings,
        mappingInputs: model.mappingInputs,
      },
      input,
    ),
  );
}

/** Kind, rule and note. */
export async function updateMappingAction(workspaceId: string, input: UpdateMappingInput): Promise<ActionResult<Notice>> {
  return mappingCommand(workspaceId, (ctx, access, model) => withNotice(updateMapping(ctx, access, mappingState(model, input?.mappingId), input)));
}

/** A further input; a second one needs the rule in the same save (D-49). */
export async function addMappingInputAction(workspaceId: string, input: AddMappingInputInput): Promise<ActionResult<Notice>> {
  return mappingCommand(workspaceId, (ctx, access, model) =>
    withNotice(
      addMappingInput(ctx, access, { ...mappingState(model, input?.mappingId), column: byId(model.sourceColumns, input?.sourceColumnId) }, input),
    ),
  );
}

export async function removeMappingInputAction(workspaceId: string, input: RemoveMappingInputInput): Promise<ActionResult<Notice>> {
  return mappingCommand(workspaceId, (ctx, access, model) => withNotice(removeMappingInput(ctx, access, mappingState(model, input?.mappingId), input)));
}

export async function reorderMappingInputsAction(workspaceId: string, input: ReorderMappingInputsInput): Promise<ActionResult<Notice>> {
  return mappingCommand(workspaceId, (ctx, access, model) =>
    withNotice(reorderMappingInputs(ctx, access, mappingState(model, input?.mappingId), input)),
  );
}

/** Draft, in review, approved; reviewers too. Four-eyes reads the mapping's change log (AD-06). */
export async function setMappingStatusAction(workspaceId: string, input: SetMappingStatusInput): Promise<ActionResult<null>> {
  return mappingCommand(workspaceId, async (ctx, access, model, store) => {
    const mapping = byId(model.mappings, input?.mappingId);
    const events = mapping ? await store.changeEvents.listForMapping(access.workspace.id, mapping.id) : [];
    const contentAuthorId = mapping ? lastContentEditor(mapping, events) : ctx.actorId;
    const result = setMappingStatus(ctx, access, { mapping, contentAuthorId }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

export async function deleteMappingAction(workspaceId: string, input: { mappingId: string; expectedVersion: number }): Promise<ActionResult<null>> {
  return mappingCommand(workspaceId, (ctx, access, model) => {
    const result = deleteMapping(ctx, access, mappingState(model, input?.mappingId), input);
    return result.ok ? { ...result, value: null } : result;
  });
}
