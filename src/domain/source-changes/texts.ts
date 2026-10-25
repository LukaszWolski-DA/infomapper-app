// The words of changes to resolve (slice 7b; prototype `KIND`, `ACTS`, the `issue(...)` details and the resolutions in
// `issueAction` and `confirmPending`). One place, so the acceptance doc can list every text and the panels, the toasts
// and the history read the same ones. Dates are ISO dates (`2026-10-25`), as slice 7a's panels show them.

import type { SourceChangeKind } from "../types";

/** A change's title on its card and in the history (prototype `KIND[kind].title`). */
export const KIND_TITLE: Record<SourceChangeKind, string> = {
  column_left: "Column left the source",
  table_left: "Table left the source",
  new_column: "New column to decide",
  new_table: "New table to decide",
  type_conflict: "Mapping no longer fits the source",
  business_key_changed: "Business key column changed",
  rule_updated: "Rule updated for a renamed column",
};

/** The kind in the review's callout (“They wait on CRM's page until you decide: columns that left, …”). */
export const KIND_SHORT: Record<SourceChangeKind, string> = {
  column_left: "columns that left",
  table_left: "a table that left",
  new_column: "new columns",
  new_table: "new tables",
  type_conflict: "type conflicts",
  business_key_changed: "business key changes",
  rule_updated: "updated rules",
};

export const SOURCE_CHANGE_ACTIONS = [
  "retire",
  "move",
  "delete",
  "map",
  "not_needed",
  "split",
  "approve",
  "leave",
  "acknowledge",
] as const;
export type SourceChangeAction = (typeof SOURCE_CHANGE_ACTIONS)[number];

/** The buttons on a change's card (prototype `ACTS`). */
export const ACTION_LABEL: Record<SourceChangeAction, string> = {
  retire: "Retire: keep as historical",
  move: "Move its mappings…",
  delete: "Delete…",
  map: "Map to an attribute…",
  not_needed: "Not needed",
  split: "Decide column by column",
  approve: "Approve the mapping again",
  leave: "Leave it in review",
  acknowledge: "Acknowledge",
};
/** A new table's “Not needed” reads differently. */
export const NONE_NEEDED_LABEL = "None of it is needed";

export const isoDate = (t: string): string => t.slice(0, 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---- what an import writes when it raises a change (prototype `applyPlan`) ----

export const DETAIL = {
  tableLeft: (columns: number) => `Not in the file. Its ${plural(columns, "column")} ${columns === 1 ? "is" : "are"} marked missing from source.`,
  columnLeft: (type: string, mappings: number) => `Not in the file. Was ${type}${mappings ? `, with ${plural(mappings, "mapping")}` : ""}.`,
  newTable: (columns: number) => `New in the source, ${plural(columns, "column")} with no mapping yet.`,
  newColumn: (type: string) => `New in the source, ${type}.`,
  mappingSentBack: (attribute: string, reasons: readonly string[]) => `The approved mapping to ${attribute} went back to review: ${reasons.join("; ")}.`,
  businessKeyChanged: (before: string, after: string) => `Business key column changed type, ${before} → ${after}. Hash keys built on it change too.`,
  /** Added to a change the format-7 upgrade derived from a slice 7a import (P2). */
  derived: "Raised when slice 7b was installed.",
} as const;

/**
 * The review's callout before an import (item 9; prototype `issBox`): “After the import, 8 changes to resolve, 3 of
 * them high. They wait on CRM’s page until you decide: new columns, columns that left, …”; null when it raises none.
 */
export function raisedCallout(raised: readonly { kind: SourceChangeKind; severity: string }[], system: string): string | null {
  if (!raised.length) return null;
  const high = raised.filter((r) => r.severity === "high").length;
  const kinds = [...new Set(raised.map((r) => KIND_SHORT[r.kind]))].join(", ");
  return `After the import, ${plural(raised.length, "change")} to resolve${high ? `, ${high} of them high` : ""}. They wait on ${system}’s page until you decide: ${kinds}.`;
}

// ---- how a change is settled ----

/** By the actions on its card (PRD items 11–17; the toast reads “{resolution}: {label}”, item 19). */
export const RESOLUTION = {
  retired: "Retired: kept as historical",
  moved: (table: string, column: string) => `Mappings moved to ${table}.${column}`,
  deleted: "Deleted from the model",
  mapped: (attribute: string) => `Mapped to ${attribute} (draft)`,
  notNeeded: "Marked not needed",
  split: "Split into one decision per column",
  approved: "Approved again",
  leftInReview: "Left in review",
  acknowledged: "Acknowledged: hash keys built on it change",
} as const;

/** By an import (P7). */
export const SETTLED_BY_IMPORT = {
  back: (date: string) => `Back in the source on ${date}`,
  leftBeforeDecision: (date: string) => `Left the source on ${date} before a decision`,
} as const;

/** What a deletion took with it (Q12): “Settled: the attribute was deleted”. */
export type DeletedObject = "entity" | "attribute" | "mapping" | "column" | "table";

/** By something done elsewhere, or as a side effect of another change's action (step 1, answer Q12). */
export const SETTLED = {
  deleted: (what: DeletedObject) => `Settled: the ${what} was deleted`,
  merged: "Settled: the mapping was merged into another",
  approvedInPanel: "Settled: the mapping was approved in its panel",
  /** The panel's status words: “Draft”, “In review”. */
  statusInPanel: (status: "Draft" | "In review") => `Settled: the mapping's status was set to ${status} in its panel`,
  inputRemoved: (column: string) => `Settled: ${column} no longer feeds the mapping`,
  mappedElsewhere: (attribute: string, status: string) => `Settled: mapped to ${attribute} (${status})`,
  movedHere: (from: string) => `Settled: mappings moved here from ${from}`,
  tableRetired: "Settled: the table was retired",
  approvedAgain: "Settled: the mapping was approved again",
} as const;

/** A mapping's status as the panels word it (slice 7a, step 5, decision 7). */
export const STATUS_WORD = { draft: "draft", review: "in review", approved: "approved" } as const;

// ---- refusals and the pending forms' lines ----

export const MOVE_HINT = "Moved approved mappings go back to review; the old column is retired.";
export const MOVED_REASON = (from: string) => `moved from ${from} after it left the source`;
export const MOVE_DROPS_INPUT = (attribute: string, target: string, from: string) => `${attribute} already reads ${target}; the input from ${from} is removed.`;
export const MOVE_DUPLICATE = (attribute: string, target: string) => `${attribute} already has a mapping from ${target}. Delete this one instead.`;
export const MAP_HINT = "The mapping starts as a draft.";
export const DELETED_INPUT_REASON = (column: string) => `${column} was deleted from the model`;
export const DELETE_RETIRE_HINT = "Retiring keeps the history instead; in Data Vault the column stays in its satellite.";
export const NO_COVERAGE_CHANGE = "No requirement’s coverage changes.";
export const NOT_FIT_HEAD = "These don't fit the source yet:";
export const FOUR_EYES_HEAD = "You changed or imported these last, so someone else has to approve them.";
/** Why a card's “Approve the mapping again” is disabled under four-eyes (Łukasz's step 4 answer 1). */
export const FOUR_EYES_CARD = (byImport: boolean) =>
  `Someone else approves this: ${byImport ? "your import sent it back" : "you changed it last"}, and four-eyes is on.`;
/** The system panel's entry to “Approve again all” for one import (Łukasz's step 4 answer 2). */
export const REVIEW_SENT_BACK = (n: number) => `Review the ${n} sent back…`;
export const NOT_IN_REVIEW = "This mapping is no longer in review.";
export const DOES_NOT_FIT = "This mapping does not fit the source yet, so it cannot be approved again.";
export const CHANGE_RESOLVED = "This change is already resolved.";
export const INPUT_MISSING = (column: string) => `${column} is missing from source`;
