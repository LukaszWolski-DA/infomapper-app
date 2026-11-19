// The import's upload (slice 7a, step 1 answer 12; gzipped since slice 30, L2): a server action takes at most 1 MB, an
// import's text up to 20 MB, and a Vercel function's request at most 4.5 MB. The browser sends the review's input as
// gzipped JSON (`CompressionStream`, `content-type: application/gzip`); the route refuses a compressed body above
// `MAX_UPLOAD_BYTES` and inflates the rest with a cap on the inflated size (`MAX_INFLATED_BYTES`, today's 25 MB), so a
// small body cannot expand without limit. The answer is the action result the browser shows (the summary, or the
// domain's message: P8's refusal carries `fields.review`). The write goes through the domain command like any other
// (AD-23), the same on both adapters; one import is one change group and one undo step.

import { gunzipSync } from "node:zlib";
import { runImport, MAX_INFLATED_BYTES, MAX_UPLOAD_BYTES, TOO_LARGE, UPLOAD_TYPE } from "@/app/_lib/import-sources";

/** A large import's write takes seconds (S30-05): Vercel's Pro default, set here so it is reviewed. */
export const maxDuration = 300;

const UNREADABLE = "The upload could not be read. Try again.";

export async function POST(request: Request, ctx: RouteContext<"/w/[workspaceId]/import">) {
  const { workspaceId } = await ctx.params;
  const refuse = (message: string, status: number) => Response.json({ ok: false, code: "invalid", message }, { status });
  if (request.headers.get("content-type") !== UPLOAD_TYPE) return refuse(UNREADABLE, 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return refuse(TOO_LARGE, 413);
  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength > MAX_UPLOAD_BYTES) return refuse(TOO_LARGE, 413);
  let text: string;
  try {
    text = gunzipSync(body, { maxOutputLength: MAX_INFLATED_BYTES }).toString("utf8");
  } catch (e) {
    // inflated past the cap: as large as today's refused upload
    if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") return refuse(TOO_LARGE, 413);
    return refuse(UNREADABLE, 400);
  }
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return refuse(UNREADABLE, 400);
  }
  return Response.json(await runImport(workspaceId, input));
}
