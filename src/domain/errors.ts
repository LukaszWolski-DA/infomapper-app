// Errors a command can return. The message is shown to the user as is.

export type DomainErrorCode = "forbidden" | "archived" | "not_found" | "invalid" | "stale_version" | "conflict";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  /** Field-level messages for "invalid". */
  fields?: Record<string, string>;
}

export const STALE_VERSION_MESSAGE = "Someone changed this meanwhile. Reload to see the latest version.";
export const ARCHIVED_MESSAGE = "This workspace is archived, so it is read-only.";

export function domainError(code: DomainErrorCode, message: string, fields?: Record<string, string>): DomainError {
  return fields ? { code, message, fields } : { code, message };
}

export const staleVersion = (): DomainError => domainError("stale_version", STALE_VERSION_MESSAGE);
export const notFound = (what: string): DomainError => domainError("not_found", `This ${what} does not exist.`);
