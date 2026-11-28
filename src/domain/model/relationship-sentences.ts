// A relationship read as two sentences (prototype insRel; slice 15b's roles): "Each Customer places zero or more Order
// as buyer." Shared by the relationship panel and InfoCatalog's details (slice 39, guardrail 4). Pure.

import type { CardinalityMax, CardinalityMin, Relationship } from "../types";

/** An end's cardinality in words: "exactly one", "zero or one", "one or more", "zero or more". */
export const cardinalityPhrase = (min: CardinalityMin, max: CardinalityMax): string =>
  max === "n" ? (min ? "one or more" : "zero or more") : min ? "exactly one" : "zero or one";

/** " as {role}" after the entity a role belongs to (slice 15b, RP-A, R-1); nothing without one. */
export const asRole = (role: string | null): string => (role?.trim() ? ` as ${role.trim()}` : "");

type Ends = Pick<Relationship, "label" | "from_min" | "from_max" | "to_min" | "to_max" | "from_role" | "to_role">;

/** The two sentences: from the `from` end, then from the `to` end. */
export function relationshipSentences(r: Ends, from: string, to: string): [string, string] {
  return [
    `Each ${from} ${r.label || "is related to"} ${cardinalityPhrase(r.to_min, r.to_max)} ${to}${asRole(r.to_role)}.`,
    `Each ${to} belongs to ${cardinalityPhrase(r.from_min, r.from_max)} ${from}${asRole(r.from_role)}.`,
  ];
}
