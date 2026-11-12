// The registered document sections and the composed store for a module's app part (slice 25, step 4): InfoDocumenter's
// actions and pages check a recipe against the kinds, build a document from the types and read its own table, and a
// module never imports `src/compose/` (only `src/app` does). As `model-command.ts` hands modules the composed store,
// this hands them the composed sections.

import { STORE_SCHEMA } from "@/compose";
import { getDataStore, type DataStore } from "@/data";

export { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";

/** The store that knows the modules' tables. */
export const composedStore = (): DataStore => getDataStore(STORE_SCHEMA);
