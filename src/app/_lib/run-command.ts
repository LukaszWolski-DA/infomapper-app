import "server-only";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import type { DomainErrorCode } from "@/domain/errors";
import { uuidv7 } from "@/domain/ids";
import type { AppUser } from "@/domain/types";
import { getSessionUser } from "./session";

/** What a server action returns to the browser: the value, or the domain's message to show in a toast. */
export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: DomainErrorCode | "unauthenticated" | "unexpected"; message: string };

/**
 * Runs one write (AD-23): the signed-in user, a fresh context, the domain command, then the adapter applies
 * the rows and change events together. Refusals come back with the domain's message.
 */
export async function runCommand<T>(
  build: (ctx: CommandContext, store: DataStore, user: AppUser) => Promise<CommandResult<T>>,
): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore();
  const ctx: CommandContext = { actorId: user.id, now: new Date().toISOString(), newId: () => uuidv7() };
  try {
    const result = await build(ctx, store, user);
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
    const applied = await store.apply(result.writeSet);
    if (!applied.ok) return { ok: false, code: applied.error.code, message: applied.error.message };
    return { ok: true, value: result.value };
  } catch (e) {
    // No row content in the log (personal data, rich text): only what kind of error it was.
    console.error("Write failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
  }
}
