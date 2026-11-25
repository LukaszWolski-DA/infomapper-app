// How undo treats InfoDocumenter's table (slice 25, R2-4a2): outside the undo history. A document's save writes its
// change event (AD-13) but is never an undo step, and undo never reads or reverts a document.

import type { BaselineFlag } from "@/domain/baseline/tables";
import type { ModuleTableClass } from "@/domain/commands/undo";
import type { InfoDocTable } from "./types";

/**
 * Not in a baseline (slice 35, step 1's F3): a document is a recipe, not the model; other people's private documents are
 * never told to exist (D-80), and a document may point to a baseline.
 */
export const INFODOC_BASELINE: Readonly<Record<InfoDocTable, BaselineFlag>> = { document_definition: "out" };

export const INFODOC_UNDO: Readonly<Record<InfoDocTable, ModuleTableClass>> = {
  document_definition: "outside undo",
};
