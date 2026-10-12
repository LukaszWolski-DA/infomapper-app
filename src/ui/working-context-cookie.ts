// Where the active working context is kept (slice 3b, Q1): a preference of one person in one workspace, in their
// browser only. It is a cookie the browser writes (never the server), so every write the browser sends carries it and
// the server can label the change (`runCommand`); the label's name rides along for the toast when it was deleted.

/** One cookie per person and workspace. */
export const contextCookieName = (userId: string, workspaceId: string): string => `im-ctx.${userId}.${workspaceId}`;

/** A year, like the other preferences. */
export const CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const formatContextCookie = (labelId: string, name: string): string => `${labelId}:${encodeURIComponent(name)}`;

export function parseContextCookie(value: string | null | undefined): { labelId: string; name: string } | null {
  if (!value) return null;
  const i = value.indexOf(":");
  const labelId = i < 0 ? value : value.slice(0, i);
  if (!/^[0-9a-f-]{36}$/i.test(labelId)) return null;
  let name = "";
  try {
    name = i < 0 ? "" : decodeURIComponent(value.slice(i + 1));
  } catch {
    name = "";
  }
  return { labelId, name };
}
