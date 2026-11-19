import "server-only";
import { revalidatePath } from "next/cache";
import { importSources, importStateOf, type ImportOutcome } from "@/domain/commands/import";
import { runCommand, type ActionResult } from "./run-command";

export { MAX_INFLATED_BYTES, MAX_UPLOAD_BYTES, TOO_LARGE, UPLOAD_TYPE } from "@/ui/import-upload";

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
