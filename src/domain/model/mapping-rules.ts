// Rules for mappings: input counts (AD-26, D-49), four-eyes approval (AD-06), approval belongs to a version (D-51)
// and the business-key suggestion (AD-28).

import { domainError, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import type { Attribute, ChangeEvent, Mapping, MappingKind, SourceColumn, Workspace } from "../types";

export const FOUR_EYES_MESSAGE = "Four-eyes is on: someone else has to approve your change.";
export const BACK_TO_REVIEW_MESSAGE = "This mapping was approved; your change sends it back to review.";

/**
 * D-51: changing an approved mapping's inputs, kind or rule sends it back to review and clears the approval, whether
 * four-eyes is on or not. Returns the extra columns for the mapping's next version and the message to show.
 */
export function afterContentChange(before: Pick<Mapping, "status">): { patch: Partial<Mapping>; notice: string | null } {
  if (before.status !== "approved") return { patch: {}, notice: null };
  return { patch: { status: "review", approved_by: null, approved_at: null }, notice: BACK_TO_REVIEW_MESSAGE };
}

/**
 * The shape every saved mapping must have: at least one input; a direct mapping exactly one; a transform a rule.
 * Adding a second input therefore needs a rule in the same save.
 */
export function checkMappingShape(kind: MappingKind, ruleExpression: string | null, inputCount: number): DomainError | null {
  if (inputCount < 1) return domainError("invalid", "A mapping reads at least one column. Delete the mapping instead.");
  if (kind === "direct" && inputCount > 1) {
    return domainError("invalid", "A direct copy reads exactly one column. With more inputs it is a transformation.");
  }
  if (kind === "transform" && !ruleExpression?.trim()) {
    return inputCount > 1
      ? domainError("invalid", "A mapping with more than one input needs a transformation rule.", { ruleExpression: "Write the rule." })
      : domainError("invalid", "A transformation needs a rule.", { ruleExpression: "Write the rule." });
  }
  return null;
}

/**
 * Who last changed what a mapping does: its inputs, kind or rule (AD-06). Read from the change log, because no column
 * records it (Łukasz, 3 October 2026). Status and note changes do not count. Without any such event (seeded data),
 * the mapping's creator is the author.
 */
export function lastContentEditor(mapping: Mapping, events: readonly ChangeEvent[]): Uuid {
  let last: ChangeEvent | null = null;
  for (const e of events) {
    if (!isContentChange(mapping.id, e)) continue;
    if (!last || e.occurred_at >= last.occurred_at) last = e;
  }
  return last?.user_id ?? mapping.created_by;
}

function isContentChange(mappingId: Uuid, e: ChangeEvent): boolean {
  if (e.object_type === "mapping_input") {
    return (e.after_image ?? e.before_image)?.mapping_id === mappingId;
  }
  if (e.object_type !== "mapping" || e.object_id !== mappingId) return false;
  if (e.operation === "create") return true;
  const before = e.before_image ?? {};
  const after = e.after_image ?? {};
  return before.kind !== after.kind || before.rule_expression !== after.rule_expression;
}

/** Four-eyes (AD-06): with the setting on, the last content author cannot approve. */
export function checkFourEyes(workspace: Workspace, actorId: Uuid, contentAuthorId: Uuid): DomainError | null {
  if (workspace.four_eyes && actorId === contentAuthorId) return domainError("forbidden", FOUR_EYES_MESSAGE);
  return null;
}

/** The panel suggests the business-key flag when an input column is marked BK and the attribute is not yet (AD-28). */
export const suggestsBusinessKey = (attribute: Pick<Attribute, "is_business_key">, inputColumns: readonly Pick<SourceColumn, "is_business_key">[]): boolean =>
  !attribute.is_business_key && inputColumns.some((c) => c.is_business_key);
