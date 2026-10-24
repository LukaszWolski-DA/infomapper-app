// The import's upload (slice 7a, step 1 answer 12): a server action takes at most 1 MB, an import's text up to 20 MB.
// POST the review's input as JSON; the answer is the action result the browser shows (the summary, or the domain's
// message: P8's refusal carries `fields.review`). The write goes through the domain command like any other (AD-23).

import { runImport, MAX_UPLOAD_BYTES, TOO_LARGE } from "@/app/_lib/import-sources";

export async function POST(request: Request, ctx: RouteContext<"/w/[workspaceId]/import">) {
  const { workspaceId } = await ctx.params;
  const refuse = (message: string, status: number) => Response.json({ ok: false, code: "invalid", message }, { status });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return refuse(TOO_LARGE, 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_UPLOAD_BYTES) return refuse(TOO_LARGE, 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return refuse("The upload could not be read. Try again.", 400);
  }
  return Response.json(await runImport(workspaceId, input));
}
