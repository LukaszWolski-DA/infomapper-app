// The composition root's tables (slice 15a, AD-33): InfoMapper's and every module's, joined once. InfoMapper's layers
// never import a module; `src/app` takes these from here and hands them to undo and the store.
//
// The build fails when a module's table is missing from undo, from the store's rules or from the file's shape: the
// three records below must name every table a command may write (`WritableRows`, which the modules augment).

import { localSchema, type DevDb, type TableRules } from "@/data/local/schema";
import { undoTables, type ModuleTableClass } from "@/domain/commands/undo";
import type { ModuleTable } from "@/domain/types";
import { INFOCUBE_RULES, type InfoCubeDb } from "@/modules/infocube/data/tables";
import { INFOCUBE_BASELINE, INFOCUBE_UNDO } from "@/modules/infocube/domain/tables";
import { INFODOC_RULES, type InfoDocDb } from "@/modules/infodocumenter/data/tables";
import { INFODOC_BASELINE, INFODOC_UNDO } from "@/modules/infodocumenter/domain/tables";
import { BASELINE_TABLES, type BaselineFlag } from "@/domain/baseline/tables";

/** Every module's table, in or outside the undo history. */
const MODULE_UNDO: Readonly<Record<ModuleTable, ModuleTableClass>> = { ...INFOCUBE_UNDO, ...INFODOC_UNDO };
/** Every module's table, with the rules the local adapter enforces. */
const MODULE_RULES: Readonly<Record<ModuleTable, TableRules>> = { ...INFOCUBE_RULES, ...INFODOC_RULES };

/** The whole data file: InfoMapper's tables and the modules' (the AD-31 schema check reads this interface). */
export interface ComposedDb extends DevDb, InfoCubeDb, InfoDocDb {}
type MissingInFile = Exclude<ModuleTable, keyof ComposedDb>;
export const MODULE_TABLES_IN_FILE: [MissingInFile] extends [never] ? true : MissingInFile = true;

/** What undo knows: InfoMapper's tables and the modules'. */
export const UNDO_TABLES = undoTables(MODULE_UNDO);
/** What the local store knows: the rules of every table and the tables undo reads. */
export const STORE_SCHEMA = localSchema(MODULE_RULES, UNDO_TABLES.undoable);

/** Every module's table, in a baseline or not (slice 35, D-87). */
const MODULE_BASELINE: Readonly<Record<ModuleTable, BaselineFlag>> = { ...INFOCUBE_BASELINE, ...INFODOC_BASELINE };
/** Every table's baseline flag: InfoMapper's and the modules' (`tests/table-registry.test.ts` checks the migrations). */
export const BASELINE_FLAGS: Readonly<Record<string, BaselineFlag>> = { ...BASELINE_TABLES, ...MODULE_BASELINE };
/** The module tables a baseline holds: what taking one (and Now in a comparison) asks `store.snapshot` for. */
export const BASELINE_MODULE_TABLES = (Object.keys(MODULE_BASELINE) as ModuleTable[]).filter((t) => MODULE_BASELINE[t] === "in");
