// The import's upload body (slice 30, L2): the review's input as JSON, gzipped in the browser, so an import's text up to
// 20 MB fits a Vercel function's 4.5 MB request (CSV and DDL text compress several times over). Plain data and one
// browser function, shared by the wizard and the route (`src/app/w/[workspaceId]/import/route.ts`).

/** The upload's content type: gzipped JSON. */
export const UPLOAD_TYPE = "application/gzip";
/**
 * The compressed body's limit: under Vercel's 4.5 MB request body, whether it means 4.5 × 10⁶ or 4.5 × 2²⁰ bytes, with
 * room for the request's other parts.
 */
export const MAX_UPLOAD_BYTES = 4_400_000;
/** The inflated body's limit: the largest text an import takes (`MAX_IMPORT_TEXT`) and the review's choices around it. */
export const MAX_INFLATED_BYTES = 25 * 1024 * 1024;
export const TOO_LARGE = "The file is too large for one import. Split it by database or schema.";

/** The JSON gzipped by the browser's own `CompressionStream` (every current browser has it). */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
