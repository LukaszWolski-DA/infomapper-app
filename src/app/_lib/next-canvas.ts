import "server-only";
import { cookies } from "next/headers";
import { isUuid, type Uuid } from "@/domain/ids";

// Where to go when your own action takes the open canvas out of its project (slice 2a): delete it, take it out, or
// undo its duplicate. The action remembers the canvas to open instead, for a minute; when the page is drawn again as
// the action's result, that canvas opens without further ado. Any other visit to the address of a canvas no longer in
// the project opens the project's first canvas, with a toast that says so (`shell.ts`).

const NEXT_CANVAS_COOKIE = "infomapper_next_canvas";

export async function rememberNextCanvas(from: Uuid, to: Uuid): Promise<void> {
  (await cookies()).set(NEXT_CANVAS_COOKIE, `${from}:${to}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
}

/** The canvas to open instead of `from`, when an action of this browser just remembered one. */
export async function nextCanvasFor(from: Uuid): Promise<Uuid | null> {
  const [f, to] = ((await cookies()).get(NEXT_CANVAS_COOKIE)?.value ?? "").split(":");
  return f === from && to && isUuid(to) ? to : null;
}
