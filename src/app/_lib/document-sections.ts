// The registered document sections for the browser (slice 26, D7): the editor builds a document's content tree from
// the snapshot it reads once, so it needs the section types and the document state's rule, which only `src/compose/`
// joins. Pure code only (no store, no server module), so a module's client part may import it, as it imports
// `model-command.ts`'s helpers on the server.

export { DOCUMENT_SECTION_TYPES, dimensionalLevelOn, documentStateFor } from "@/compose/documents";
