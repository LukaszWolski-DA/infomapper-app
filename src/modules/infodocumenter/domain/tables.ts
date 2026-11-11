// How undo treats InfoDocumenter's table (slice 25, R2-4a2): outside the undo history. A document's save writes its
// change event (AD-13) but is never an undo step, and undo never reads or reverts a document.

import type { ModuleTableClass } from "@/domain/commands/undo";
import type { InfoDocTable } from "./types";

export const INFODOC_UNDO: Readonly<Record<InfoDocTable, ModuleTableClass>> = {
  document_definition: "outside undo",
};
