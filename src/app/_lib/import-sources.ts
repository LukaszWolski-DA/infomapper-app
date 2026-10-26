import "server-only";
import { revalidatePath } from "next/cache";
import { importSources, importStateOf, type ImportOutcome } from "@/domain/commands/import";
import { runCommand, type ActionResult } from "./run-command";

/** Bytes one upload may have: the largest text an import takes (`MAX_IMPORT_TEXT`) and the review's choices around it. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const TOO_LARGE = "The file is too large for one import. Split it by database or schema.";

/**
 * An import (slice 7a): the route handler's write, as a server action's (AD-23): the signed-in user, the workspace's
 * live model, the domain command (P8's check), the live canvas rules, the adapter, the undo history.
 */
export async function runImport(workspaceId: string, input: unknown): Promise<ActionResult<ImportOutcome>> {
  const result = await runCommand<ImportOutcome>(async (ctx, store, user) => {
    const workspace = await store.workspaces.get(workspaceId);
    if (!workspace) return { ok: false, error: { code: "not_found", message: "This workspace does not exist." } };
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const [model, changes] = await Promise.all([store.model.load(workspace.id), store.model.listChanges(workspace.id)]);
    return importSources(ctx, access, importStateOf(model, changes), input);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
