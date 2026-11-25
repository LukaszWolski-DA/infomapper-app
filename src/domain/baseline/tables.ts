// Which tables a baseline holds (slice 35, the design of 11 November 2026, step 1's Q1): every table has a flag, so a
// new one is classified or the build fails (`Record<CoreTable, …>` here, a module's record beside its undo record, joined
// in `src/compose/tables.ts`; `tests/table-registry.test.ts` checks the migrations against them).

import type { CoreTable } from "../types";

/** "in": its live rows go into a baseline; "out": never. */
export type BaselineFlag = "in" | "out";

export const BASELINE_TABLES: Readonly<Record<CoreTable, BaselineFlag>> = {
  // the core
  concept: "in",
  entity: "in",
  attribute: "in",
  attribute_input: "in",
  relationship: "in",
  // sources
  source_system: "in",
  source_table: "in",
  source_column: "in",
  source_relationship: "in",
  source_relationship_column: "in",
  // classifications and their links, stereotypes
  classification: "in",
  classification_link: "in",
  stereotype: "in",
  // mappings, requirements and their links
  mapping: "in",
  mapping_input: "in",
  requirement: "in",
  requirement_link: "in",
  // projects and canvases with their items and frames (B3.3)
  project: "in",
  canvas: "in",
  project_canvas: "in",
  canvas_item: "in",
  frame: "in",
  // the working layer
  label: "out",
  label_link: "out",
  project_pinned_label: "out",
  note: "out",
  // import bookkeeping
  source_import: "out",
  source_change: "out",
  // people and access; the workspace's row gives only its four settings (`BaselineSettings`)
  app_user: "out",
  organization: "out",
  organization_member: "out",
  organization_access: "out",
  organization_licence: "out",
  workspace: "out",
  workspace_member: "out",
  invitation: "out",
  password_reset: "out",
  // a baseline never holds baselines
  baseline: "out",
};
