// Input validation for commands (Zod at the boundary, AD-23).

import { z } from "zod";
import { domainError, type DomainError } from "./errors";
import { isUuid } from "./ids";

export const uuidSchema = z.string().refine(isUuid, "Not a valid id.");

/** A required name: trimmed, not empty. */
export const nameSchema = z.string().trim().min(1, "Enter a name.");

/** An optional text: trimmed; empty becomes null. */
export const optionalTextSchema = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v ? v : null));

export const versionSchema = z.number().int().positive();

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: DomainError };

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  const first = Object.values(fields)[0] ?? "The input is not valid.";
  return { ok: false, error: domainError("invalid", first, fields) };
}
