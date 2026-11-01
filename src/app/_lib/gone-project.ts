import "server-only";
import { cookies } from "next/headers";
import { isUuid, type Uuid } from "@/domain/ids";

// When your own action removes the project whose page is open (slice 12a, F2): its delete, an undo of "Create project",
// a redo of a delete. The action remembers the project for a minute; when the page is drawn again as the action's
// result, `loadShell` goes to the workspace home without "That project no longer exists.", and the action's own toast
// says what happened. Any other visit to a project that no longer exists keeps that toast (D-38). The twin of
// `next-canvas.ts`.

const GONE_PROJECT_COOKIE = "infomapper_gone_project";

export async function rememberGoneProject(projectId: Uuid): Promise<void> {
  (await cookies()).set(GONE_PROJECT_COOKIE, projectId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
}

/** Whether an action of this browser just removed this project. */
export async function goneByMe(projectId: string): Promise<boolean> {
  const value = (await cookies()).get(GONE_PROJECT_COOKIE)?.value ?? "";
  return isUuid(value) && value === projectId;
}
