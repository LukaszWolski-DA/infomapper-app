// The composition root's tables (slice 15a, AD-33): InfoMapper's and every module's, joined once. InfoMapper's layers
// never import a module; `src/app` takes these from here and hands them to undo and the store.
//
// The build fails when a module's table is missing from undo, from the store's rules or from the file's shape: the
// three records below must name every table a command may write (`WritableRows`, which the modules augment).

import { localSchema, type DevDb, type TableRules } from "@/data/local/schema";
import { undoTables, type ModuleTableClass } from "@/domain/commands/undo";
import type { ModuleTable } from "@/domain/types";
import { INFOCUBE_RULES, type InfoCubeDb } from "@/modules/infocube/data/tables";
import { INFOCUBE_UNDO } from "@/modules/infocube/domain/tables";

/** Every module's table, in or outside the undo history. */
const MODULE_UNDO: Readonly<Record<ModuleTable, ModuleTableClass>> = { ...INFOCUBE_UNDO };
/** Every module's table, with the rules the local adapter enforces. */
const MODULE_RULES: Readonly<Record<ModuleTable, TableRules>> = { ...INFOCUBE_RULES };

/** The whole data file: InfoMapper's tables and the modules' (the AD-31 schema check reads this interface). */
export interface ComposedDb extends DevDb, InfoCubeDb {}
type MissingInFile = Exclude<ModuleTable, keyof ComposedDb>;
export const MODULE_TABLES_IN_FILE: [MissingInFile] extends [never] ? true : MissingInFile = true;

/** What undo knows: InfoMapper's tables and the modules'. */
export const UNDO_TABLES = undoTables(MODULE_UNDO);
/** What the local store knows: the rules of every table and the tables undo reads. */
export const STORE_SCHEMA = localSchema(MODULE_RULES, UNDO_TABLES.undoable);
