"use server";

// The Baselines tab's actions (slice 35, D-87): take a baseline, rename it, delete it, compare it. The writes go through
// `runCommand` (the rights again inside the write, a change event, never an undo step); the comparison is a read on the
// server (step 1's F12): the browser gets the changes only, never a content.

import { revalidatePath } from "next/cache";
import { baselineContentNow, compareWith } from "@/compose/baselines";
import { STORE_SCHEMA } from "@/compose";
import { getDataStore } from "@/data";
import type { BaselineChange } from "@/domain/baseline/compare";
import { BASELINE_GONE_MESSAGE, nameTakenMessage } from "@/domain/baseline/names";
import { createBaseline, deleteBaseline, renameBaseline, type CreateBaselineInput, type DeleteBaselineInput, type RenameBaselineInput } from "@/domain/commands/baseline";
import { domainError } from "@/domain/errors";
import { loadAccess } from "@/app/_lib/model-command";
import { runCommand, type ActionResult, type Saved } from "@/app/_lib/run-command";
import { getSession } from "@/app/_lib/session";
import { lockedRefusal } from "@/app/_lib/unlock";

const NOT_FOUND = { ok: false as const, error: domainError("not_found", "This workspace does not exist.") };

/**
 * A name taken by another write at the same moment (step 1's F20): both adapters refuse the second as "This already
 * exists" (the unique index on live names); the person reads the name check's own message.
 */
function withNameMessage<T>(result: ActionResult<T>, name: unknown): ActionResult<T> {
  if (!result.ok && result.code === "conflict" && result.message.startsWith("This already exists") && typeof name === "string") {
    return { ...result, message: nameTakenMessage(name.trim()) };
  }
  return result;
}

/** Create baseline: the workspace's state now, read once, taken under the name and the note. */
export async function createBaselineAction(input: CreateBaselineInput): Promise<ActionResult<{ id: string; name: string }>> {
  {
    const result = await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const content = await baselineContentNow(store, access.workspace.id);
      if (!content) return NOT_FOUND;
      const r = createBaseline(ctx, access, { baselines: await store.baselines.listAll(access.workspace.id) }, content, input);
      return r.ok ? { ...r, value: { id: r.value.baseline.id, name: r.value.baseline.name } } : r;
    });
    if (result.ok) revalidatePath("/", "layout");
    return withNameMessage(result, input?.name);
  }
}

/** Rename: the name and the note, against the row's version (D-59). */
export async function renameBaselineAction(input: RenameBaselineInput & { workspaceId: string }): Promise<ActionResult<Saved<{ name: string; renamed: boolean }>>> {
  const { workspaceId, ...rest } = input ?? ({} as typeof input);
  const result = await runCommand(async (ctx, store, user) => {
    const access = await loadAccess(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const baseline = typeof rest.baselineId === "string" ? await store.baselines.get(access.workspace.id, rest.baselineId) : null;
    const r = renameBaseline(ctx, access, { baselines: await store.baselines.listAll(access.workspace.id) }, baseline, rest);
    return r.ok ? { ...r, value: { version: r.value.baseline.version, name: r.value.baseline.name, renamed: r.value.renamed } } : r;
  });
  if (result.ok) revalidatePath("/", "layout");
  return withNameMessage(result, rest.name);
}

/** Delete baseline: soft, after the question (B2.1). */
export async function deleteBaselineAction(input: DeleteBaselineInput & { workspaceId: string }): Promise<ActionResult<Saved>> {
  const { workspaceId, ...rest } = input ?? ({} as typeof input);
  const result = await runCommand(async (ctx, store, user) => {
    const access = await loadAccess(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const baseline = typeof rest.baselineId === "string" ? await store.baselines.get(access.workspace.id, rest.baselineId) : null;
    const r = deleteBaseline(ctx, access, baseline, rest);
    return r.ok ? { ...r, value: { version: r.value.baseline.version } } : r;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** One side of a comparison as the dialog names it: a baseline, or Now (null). */
export type CompareSide = { id: string; name: string; created_at: string } | null;

export interface CompareAnswer {
  older: CompareSide;
  newer: CompareSide;
  changes: BaselineChange[];
}

/**
 * Compare…: the baseline with Now (`otherId` null) or with another baseline, the older state first (B4.6); a read for
 * every member, in an archived workspace too. A baseline gone meanwhile answers F17's message.
 */
export async function compareBaselineAction(input: { workspaceId: string; baselineId: string; otherId: string | null }): Promise<ActionResult<CompareAnswer>> {
  {
    const session = await getSession();
    if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
    const store = getDataStore(STORE_SCHEMA);
    const access = await loadAccess(store, input?.workspaceId, session.user.id);
    if (!access?.member) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
    const locked = await lockedRefusal(store, session.unlocked, access.workspace.organization_id);
    if (locked) return locked;
    if (typeof input.baselineId !== "string" || (input.otherId !== null && typeof input.otherId !== "string")) {
      return { ok: false, code: "invalid", message: "The input is not valid." };
    }
    const outcome = await compareWith(store, access.workspace.id, input.baselineId, input.otherId);
    if (!outcome.ok) return { ok: false, code: "not_found", message: BASELINE_GONE_MESSAGE };
    const side = (b: typeof outcome.older): CompareSide => (b ? { id: b.id, name: b.name, created_at: b.created_at } : null);
    return { ok: true, value: { older: side(outcome.older), newer: side(outcome.newer), changes: outcome.changes } };
  }
}
