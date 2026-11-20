import "server-only";
// The links of invitations and password resets (slice 33, PT2, Q5): 32 random bytes as base64url (43 characters) in the
// link; only their SHA-256 goes to the domain and the database. The token is in the action's answer once, never in a
// log, a change event or a stored row. The link's address is the request's own (Vercel's forwarded host and protocol).

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The SHA-256 (hex) of a link's token, or null when the text cannot be one (an altered or cut link). */
export function hashOfToken(token: unknown): string | null {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A new token and its hash. */
export function newLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOfToken(token)! };
}

/** The link on this server's address: `/invite/{token}` or `/reset/{token}`. */
export async function linkFor(kind: "invite" | "reset", token: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}/${kind}/${token}`;
}
