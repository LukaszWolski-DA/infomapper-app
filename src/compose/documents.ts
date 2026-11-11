// The document sections every module registers (slice 25, AD-33's addition as proposed): InfoDocumenter's own and
// InfoCube's, joined once. InfoDocumenter's commands read their kinds by type; neither module imports the other.

import { sectionKinds, type DocumentSectionKind } from "@/domain/document/sections";
import { CUBE_SECTION_KIND } from "@/modules/infocube/domain/document-section";
import { INFODOC_SECTION_KINDS } from "@/modules/infodocumenter/domain/sections";

/** Every registered section kind by its stored type; a name registered twice fails at once. */
export const DOCUMENT_SECTION_KINDS: ReadonlyMap<string, DocumentSectionKind> = sectionKinds([...INFODOC_SECTION_KINDS, CUBE_SECTION_KIND]);
