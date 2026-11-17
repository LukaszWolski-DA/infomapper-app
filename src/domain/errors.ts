// Errors a command can return. The message is shown to the user as is.

export type DomainErrorCode = "forbidden" | "archived" | "not_found" | "invalid" | "stale_version" | "conflict";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  /** Field-level messages for "invalid". */
  fields?: Record<string, string>;
}

/** A stale version (AD-12). The refusal's answer brings the fresh page (slice 13), so there is nothing to reload. */
export const STALE_VERSION_MESSAGE = "Someone changed this meanwhile.";
export const ARCHIVED_MESSAGE = "This workspace is archived, so it is read-only.";
/**
 * A server whose store takes no writes (slice 29, Q5: the Postgres adapter until slice B). Refused with the archive's code,
 * so every client rule for a read-only refusal applies (the fresh page, the kept draft, the cut saves).
 */
export const READ_ONLY_SERVER_MESSAGE = "This server is read-only for now, so nothing was saved.";

export function domainError(code: DomainErrorCode, message: string, fields?: Record<string, string>): DomainError {
  return fields ? { code, message, fields } : { code, message };
}

export const staleVersion = (): DomainError => domainError("stale_version", STALE_VERSION_MESSAGE);
export const notFound = (what: string): DomainError => domainError("not_found", `This ${what} does not exist.`);
