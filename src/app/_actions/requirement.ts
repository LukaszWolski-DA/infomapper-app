"use server";

// Requirements (slice 4a): created from the left panel or an element panel (“+ New requirement…”, linked to it),
// changed one field at a time and given a status in the requirement panel, deleted, linked and unlinked. Each runs one
// domain command on the data as stored now; pages are fresh again afterwards. A create builds again from fresh data
// when the workspace's key counter changed meanwhile (`freshOnStale`), so two people creating at once both succeed.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import {
  createRequirement,
  deleteRequirement,
  linkRequirement,
  setRequirementStatus,
  unlinkRequirement,
  updateRequirement,
  type CreateRequirementInput,
  type LinkRequirementInput,
  type UpdateRequirementInput,
} from "@/domain/commands/requirement";
import type { Uuid } from "@/domain/ids";
import { lastRequirementEditor } from "@/domain/model/requirements";
import type { WorkspaceAccess } from "@/domain/permissions";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function requirementCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, store: DataStore) => Promise<CommandResult<T>>,
  options: { freshOnStale?: boolean } = {},
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    // read inside the attempt, so a retry sees the workspace's current key counter
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    return build(ctx, { workspace, member: await store.workspaces.getMember(workspace.id, user.id) }, store);
  }, options);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** A new requirement (REQ-{next}), optionally linked to one element; its id and key. */
export async function createRequirementAction(workspaceId: string, input: CreateRequirementInput): Promise<ActionResult<{ requirementId: Uuid; key: string }>> {
  return requirementCommand(
    workspaceId,
    async (ctx, access, store) => {
      const ws = access.workspace.id;
      const [requirements, model] = await Promise.all([store.requirements.list(ws), input?.link ? store.model.load(ws) : null]);
      const r = createRequirement(ctx, access, { requirements, ...(model ?? {}) }, input);
      return r.ok ? { ...r, value: { requirementId: r.value.requirement.id, key: r.value.requirement.key } } : r;
    },
    { freshOnStale: true },
  );
}

/** Changes one field of a requirement. */
export async function updateRequirementAction(workspaceId: string, input: UpdateRequirementInput): Promise<ActionResult> {
  return requirementCommand(workspaceId, async (ctx, access, store) => {
    const r = updateRequirement(ctx, access, { requirements: await store.requirements.list(access.workspace.id) }, input);
    return r.ok ? { ...r, value: undefined } : r;
  });
}

/** Sets a requirement's status (reviewers too); with four-eyes on, its last content author cannot set Agreed. */
export async function setRequirementStatusAction(
  workspaceId: string,
  input: { requirementId: string; expectedVersion: number; status: string },
): Promise<ActionResult> {
  return requirementCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const requirement = await store.requirements.get(ws, str(input?.requirementId));
    const contentAuthorId = requirement ? lastRequirementEditor(requirement, await store.changeEvents.listForRequirement(ws, requirement.id)) : ctx.actorId;
    const r = setRequirementStatus(ctx, access, { requirement, contentAuthorId }, input);
    return r.ok ? { ...r, value: undefined } : r;
  });
}

/** Deletes a requirement and its links; its children become top level. The toast's text comes back. */
export async function deleteRequirementAction(workspaceId: string, input: { requirementId: string; expectedVersion: number }): Promise<ActionResult<{ message: string }>> {
  return requirementCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [requirements, links, items] = await Promise.all([store.requirements.list(ws), store.requirements.listLinks(ws), store.canvasItems.list(ws)]);
    const r = deleteRequirement(ctx, access, { requirements, links, items }, input);
    return r.ok ? { ...r, value: { message: r.value.message } } : r;
  });
}

/** Links a requirement to an entity, attribute, mapping, source table or column; the toast's text comes back. */
export async function linkRequirementAction(workspaceId: string, input: LinkRequirementInput): Promise<ActionResult<{ message: string }>> {
  return requirementCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [requirement, links, model] = await Promise.all([store.requirements.get(ws, str(input?.requirementId)), store.requirements.listLinks(ws), store.model.load(ws)]);
    const r = linkRequirement(ctx, access, { requirement, links, ...model }, input);
    return r.ok ? { ...r, value: { message: r.value.message } } : r;
  });
}

/** Takes one link away. */
export async function unlinkRequirementAction(workspaceId: string, input: { requirementLinkId: string; expectedVersion: number }): Promise<ActionResult> {
  return requirementCommand(workspaceId, async (ctx, access, store) =>
    unlinkRequirement(ctx, access, { link: await store.requirements.getLink(access.workspace.id, str(input?.requirementLinkId)) }, input),
  );
}
