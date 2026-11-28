// What a module gives InfoCatalog (slice 39, Q3 as answered, AD-33's new extension point): its tables (read with the
// catalog's rows), its kinds' tabs and items, and the documents that include an item. Plain data and pure functions;
// `src/compose/catalog.ts` joins the modules' and applies them after the port's read, so neither the data layer nor
// InfoCatalog names a module.

import type { DocumentState } from "../document/state";
import type { Uuid } from "../ids";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { CatalogWorkspace } from "../permissions";
import type { ModuleTable, WorkspaceMember } from "../types";
import type { CatalogItem, CatalogTab } from "./items";

/** Who reads: the person, and their role in the item's workspace (null: they read it without a role). */
export interface CatalogViewer {
  readonly userId: Uuid;
  readonly member: WorkspaceMember | null;
}

/** A document an item is in, as its reader would see it in InfoMapper. */
export interface CatalogDocument {
  readonly id: Uuid;
  readonly name: string;
  readonly shared: boolean;
}

export interface CatalogContribution {
  /** The module's name (for a reader of the code; never shown). */
  readonly module: string;
  /** The module tables read with the catalog's rows, live rows of the readable workspaces only. */
  readonly tables: readonly ModuleTable[];
  /** Its kinds' tabs, after InfoMapper's, in this order. */
  readonly tabs?: readonly CatalogTab[];
  /** Where the module is on: its tabs show only when a workspace in scope has it on (none: always). */
  readonly on?: (workspace: CatalogWorkspace) => boolean;
  /** Its items of one workspace (none where the module is off), each kind in its model order. */
  readonly items?: (snapshot: WorkspaceSnapshot<ModuleTable>) => CatalogItem[];
  /** The documents that include the item, only those the viewer sees in InfoMapper (none without a role). */
  readonly documentsIncluding?: (state: DocumentState<ModuleTable>, item: CatalogItem, viewer: CatalogViewer) => CatalogDocument[];
}
