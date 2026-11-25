// The registered document sections and the composed store for a module's app part (slice 25, step 4): InfoDocumenter's
// actions and pages check a recipe against the kinds, build a document from the types and read its own table, and a
// module never imports `src/compose/` (only `src/app` does). As `model-command.ts` hands modules the composed store,
// this hands them the composed sections.

import { STORE_SCHEMA } from "@/compose";
import { getDataStore, type DataStore } from "@/data";

export { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, dimensionalLevelOn, documentStateFor } from "@/compose/documents";
// slice 36: a document's model from its source, its comparisons and the canvases of its figures
export { baselineDocumentCounts, baselineRefs, documentCanvases, documentChanges, documentModel, type DocumentModel } from "@/compose/document-model";

/** The store that knows the modules' tables. */
export const composedStore = (): DataStore => getDataStore(STORE_SCHEMA);
