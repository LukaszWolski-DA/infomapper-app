// The document sections every module registers (slice 25, AD-33's addition as proposed): InfoDocumenter's own and
// InfoCube's, joined once. InfoDocumenter's commands read their kinds and its document builder their types by stored
// name; neither module imports the other.
//
// Which module tables a document's snapshot reads comes from here (step 3): every registered type's `tables` and the
// tables of the requirement feeds, which a module derives from its rows (InfoCube's dimensional mappings). The document
// state is built here too, with those feeds, so InfoDocumenter never names a module or its tables.

import { sectionKinds, type DocumentSectionKind, type DocumentSectionType } from "@/domain/document/sections";
import { documentStateOf, type DocumentContributions, type DocumentState } from "@/domain/document/state";
import type { CheckInput } from "@/domain/model/checks";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable, Workspace } from "@/domain/types";
import {
  CUBE_BUS_SECTION,
  CUBE_FEED_TABLES,
  CUBE_SECTION,
  cubeCheckRowsOf,
  cubeDocumentFeeds,
  cubeDocumentRoles,
  type CubeSectionTable,
} from "@/modules/infocube/domain/document-section";
import { cubeModuleChecks } from "./checks";
import { INFODOC_SECTION_TYPES } from "@/modules/infodocumenter/domain/builders";

/** Every registered section type by its stored type; a name registered twice fails at once. */
export const DOCUMENT_SECTION_TYPES: ReadonlyMap<string, DocumentSectionType<ModuleTable>> = sectionKinds<DocumentSectionType<ModuleTable>>([
  ...INFODOC_SECTION_TYPES,
  CUBE_SECTION as DocumentSectionType<ModuleTable>,
  CUBE_BUS_SECTION as DocumentSectionType<ModuleTable>,
]);

/** Slice 26: whether a workspace draws the dimensional level (InfoCube on), for the editor's "Model levels". */
export const dimensionalLevelOn = (workspace: Workspace): boolean => workspace.infocube;

/** The same registrations as the commands read them (their kinds). */
export const DOCUMENT_SECTION_KINDS: ReadonlyMap<string, DocumentSectionKind> = DOCUMENT_SECTION_TYPES;

/** The module tables a document's snapshot reads: the section types' and the feeds', each once. */
export const DOCUMENT_TABLES: readonly ModuleTable[] = [...new Set<ModuleTable>([...[...DOCUMENT_SECTION_TYPES.values()].flatMap((t) => t.tables), ...CUBE_FEED_TABLES])];

/**
 * A document's model state from its snapshot (read with `DOCUMENT_TABLES`): the indexes with the modules' feeds, and
 * since slice 26 their contributions (Q6, F12): InfoCube's role words for the dictionary and its model checks for
 * readiness, while it is on. Pure.
 */
export function documentStateFor(snapshot: WorkspaceSnapshot<ModuleTable>): DocumentState<ModuleTable> {
  const cube = snapshot as WorkspaceSnapshot<CubeSectionTable>;
  const on = dimensionalLevelOn(snapshot.workspace);
  const modules: DocumentContributions = {
    dimensionalOn: on,
    entityRole: on ? cubeDocumentRoles(cube) : () => null,
    moduleChecks: (input: CheckInput) => cubeModuleChecks(on, on ? cubeCheckRowsOf(cube) : null, input),
  };
  return documentStateOf(snapshot, cubeDocumentFeeds(snapshot as WorkspaceSnapshot<(typeof CUBE_FEED_TABLES)[number]>), modules);
}
