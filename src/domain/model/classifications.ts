// Classifications (slice 7c, P1–P3, D-55; prototype `DEFAULT_CLASSES`, `norm`, `classOf`): the workspace's list of what
// a source table or column means for the model. Built-in classifications have a code the app's rules read; the name is
// only what people see, so a renamed one keeps working and a removed one is simply absent (answer F1). Own ones have no
// code and are matched by name only.
//   One way to read them (item 6, P11): `classificationIndex` is built once per load from the list and its links, and
//   every rule asks `has(objectId, code)`; nothing searches the links while drawing.
//   Names (item 8, answer F10): unique per scope against every other classification's name and every built-in code of
//   that scope, removed built-in ones included (their code stays theirs), compared with `norm`. So one value of an
//   import file matches at most one classification.

import type { CommandContext } from "../changes";
import type { Uuid } from "../ids";
import type { Classification, ClassificationLink, ClassificationOrigin, ClassificationScope } from "../types";

/** The codes the app's rules read (answer F1). Only built-in classifications have one. */
export const CLASSIFICATION_CODES = [
  "BK",
  "PII",
  "TECH",
  "LDTS",
  "RSRC",
  "EFF",
  "LK",
  "DCK",
  "DK",
  "MAK",
  "T_MASTER",
  "T_TXN",
  "T_REF",
  "T_STG",
  "T_LOG",
  "T_HIST",
  "T_HUB",
  "T_LNK",
  "T_SAT",
] as const;
export type ClassificationCode = (typeof CLASSIFICATION_CODES)[number];

export interface BuiltinClassification {
  code: ClassificationCode;
  /** The default name; a workspace may rename it (P1). */
  name: string;
  scope: ClassificationScope;
  origin: Exclude<ClassificationOrigin, "own">;
}

/**
 * The built-in list (item 1, P2): the prototype's 19, Effective date in the general group, and the code `PII` named
 * “Personal data” (answer F14: the app's label since slice 1a; a file's “PII” matches by code).
 */
export const BUILTIN_CLASSIFICATIONS: readonly BuiltinClassification[] = [
  { code: "BK", name: "Business key", scope: "column", origin: "builtin" },
  { code: "PII", name: "Personal data", scope: "column", origin: "builtin" },
  { code: "TECH", name: "Technical / audit", scope: "column", origin: "builtin" },
  { code: "LDTS", name: "Load date", scope: "column", origin: "builtin" },
  { code: "RSRC", name: "Record source", scope: "column", origin: "builtin" },
  { code: "EFF", name: "Effective date", scope: "column", origin: "builtin" },
  { code: "LK", name: "Link key", scope: "column", origin: "data_vault" },
  { code: "DCK", name: "Dependent child key", scope: "column", origin: "data_vault" },
  { code: "DK", name: "Driving key", scope: "column", origin: "data_vault" },
  { code: "MAK", name: "Multi-active key", scope: "column", origin: "data_vault" },
  { code: "T_MASTER", name: "Master data", scope: "table", origin: "builtin" },
  { code: "T_TXN", name: "Transactions", scope: "table", origin: "builtin" },
  { code: "T_REF", name: "Reference / code list", scope: "table", origin: "builtin" },
  { code: "T_STG", name: "Staging", scope: "table", origin: "builtin" },
  { code: "T_LOG", name: "Log / audit", scope: "table", origin: "builtin" },
  { code: "T_HIST", name: "History (SCD2)", scope: "table", origin: "builtin" },
  { code: "T_HUB", name: "Hub candidate", scope: "table", origin: "data_vault" },
  { code: "T_LNK", name: "Link candidate", scope: "table", origin: "data_vault" },
  { code: "T_SAT", name: "Satellite source", scope: "table", origin: "data_vault" },
];

const ORDER = new Map<string, number>(BUILTIN_CLASSIFICATIONS.map((b, i) => [b.code, i]));
const BUILTIN = new Map<string, BuiltinClassification>(BUILTIN_CLASSIFICATIONS.map((b) => [b.code, b]));

/** A name or a file's value compared: lower case, without spaces, `_`, `-` and `/` (prototype `norm`). */
export const normClassification = (s: string): string => s.toLowerCase().replace(/[\s_\-/]+/g, "");

/** The workspace's 19 built-in rows (item 4): a new workspace gets them in its creation's change group. */
export function builtinClassificationRows(ctx: CommandContext, workspaceId: Uuid): Classification[] {
  return BUILTIN_CLASSIFICATIONS.map((b) => ({
    id: ctx.newId(),
    workspace_id: workspaceId,
    version: 1,
    created_at: ctx.now,
    created_by: ctx.actorId,
    updated_at: ctx.now,
    updated_by: ctx.actorId,
    deleted_at: null,
    code: b.code,
    name: b.name,
    name_key: normClassification(b.name),
    scope: b.scope,
    origin: b.origin,
  }));
}

const isLiveRow = (r: { deleted_at: string | null }) => r.deleted_at === null;

/** The list's order: built-in ones in the table's order, then the workspace's own by name. */
export function byListOrder(a: Classification, b: Classification): number {
  const oa = a.code !== null ? (ORDER.get(a.code) ?? 999) : 1000;
  const ob = b.code !== null ? (ORDER.get(b.code) ?? 999) : 1000;
  return oa - ob || a.name.localeCompare(b.name);
}

/** The panels' groups (item 13): “General”, “Data Vault 2.0”, “This workspace”. */
export const groupOf = (c: Pick<Classification, "origin">): "General" | "Data Vault 2.0" | "This workspace" =>
  c.origin === "own" ? "This workspace" : c.origin === "data_vault" ? "Data Vault 2.0" : "General";

export const isDataVault = (c: Pick<Classification, "origin">): boolean => c.origin === "data_vault";

export const TAKEN_NAME = "That name is taken";

/**
 * The classification a name collides with (answer F10), or null: another classification of the scope with the same
 * name, live, or any built-in one of the scope (removed too) whose code is that name. `exceptId`: the one being renamed.
 */
export function nameTakenBy(list: readonly Classification[], scope: ClassificationScope, name: string, exceptId: Uuid | null = null): Classification | null {
  const key = normClassification(name);
  for (const c of list) {
    if (c.id === exceptId || c.scope !== scope) continue;
    if (isLiveRow(c) && c.name_key === key) return c;
    if (c.code !== null && normClassification(c.code) === key) return c;
  }
  return null;
}

/** Whether a classification fits a table or a column (P3: the domain refuses a link that does not). */
export const fitsScope = (c: Pick<Classification, "scope">, target: "source_table" | "source_column"): boolean =>
  (c.scope === "table") === (target === "source_table");

// ---- the index (item 6, P11) ----

export interface ClassificationIndex {
  /** Live classifications by id. */
  readonly byId: ReadonlyMap<Uuid, Classification>;
  /** Live built-in classifications by code. */
  readonly byCode: ReadonlyMap<string, Classification>;
  /** The live list, in list order. */
  readonly list: readonly Classification[];
  /** The live classifications on a table or column, in list order. */
  of(objectId: Uuid): readonly Classification[];
  /** Whether a table or column has the live built-in classification with this code. */
  has(objectId: Uuid, code: ClassificationCode): boolean;
  /** The live link of a classification on an object. */
  linkOf(objectId: Uuid, classificationId: Uuid): ClassificationLink | undefined;
  /** The tables and columns a classification is on. */
  uses(classificationId: Uuid): { tables: Uuid[]; columns: Uuid[] };
}

const NONE: readonly Classification[] = [];

/** Built once per load (P11): one pass over the list and one over the links. */
export function classificationIndex(classifications: readonly Classification[], links: readonly ClassificationLink[]): ClassificationIndex {
  const list = classifications.filter(isLiveRow).sort(byListOrder);
  const byId = new Map(list.map((c) => [c.id, c]));
  const byCode = new Map(list.filter((c) => c.code !== null).map((c) => [c.code!, c]));
  const onObject = new Map<Uuid, ClassificationLink[]>();
  const usesOf = new Map<Uuid, { tables: Uuid[]; columns: Uuid[] }>();
  for (const l of links) {
    if (!isLiveRow(l) || !byId.has(l.classification_id)) continue;
    const object = l.source_column_id ?? l.source_table_id;
    if (!object) continue;
    (onObject.get(object) ?? onObject.set(object, []).get(object)!).push(l);
    const u = usesOf.get(l.classification_id) ?? usesOf.set(l.classification_id, { tables: [], columns: [] }).get(l.classification_id)!;
    (l.source_column_id ? u.columns : u.tables).push(object);
  }
  const ofCache = new Map<Uuid, readonly Classification[]>();
  return {
    byId,
    byCode,
    list,
    of(objectId) {
      let out = ofCache.get(objectId);
      if (!out) {
        const ls = onObject.get(objectId);
        out = ls ? ls.map((l) => byId.get(l.classification_id)!).sort(byListOrder) : NONE;
        ofCache.set(objectId, out);
      }
      return out;
    },
    has(objectId, code) {
      const c = byCode.get(code);
      return !!c && !!onObject.get(objectId)?.some((l) => l.classification_id === c.id);
    },
    linkOf(objectId, classificationId) {
      return onObject.get(objectId)?.find((l) => l.classification_id === classificationId);
    },
    uses(classificationId) {
      return usesOf.get(classificationId) ?? { tables: [], columns: [] };
    },
  };
}

/** The index of a model that has a list (an empty one before step 3's data upgrade). */
export const indexOf = (model: { classifications?: readonly Classification[]; classificationLinks?: readonly ClassificationLink[] }): ClassificationIndex =>
  classificationIndex(model.classifications ?? [], model.classificationLinks ?? []);

// ---- what stops when a built-in one is removed (item 10, answers F1, F3) ----

/**
 * One text per built-in classification a rule reads (Q7's tables). Texts name the role, not the classification's
 * current name (answer F1). Built-in ones no rule reads have none.
 */
export const WHAT_STOPS: Partial<Record<ClassificationCode, string>> = {
  BK: "Without it, the app no longer suggests business keys on attributes, sends approved mappings back when a business key column changes type, raises business key changes on import, suggests business keys in the import, filters keys by it or shows the BK badge on source rows, and the Data Vault reading shows no hub.",
  PII: "Without it, the app no longer copies personal data to attributes created from a column or shows a separate personal data satellite in the Data Vault reading.",
  TECH: "Without it, the Data Vault reading counts these columns as descriptive columns of a satellite.",
  LDTS: "Without it, the Data Vault reading counts these columns as descriptive columns of a satellite.",
  RSRC: "Without it, the Data Vault reading counts these columns as descriptive columns of a satellite.",
  EFF: "Without it, the Data Vault reading no longer shows what a table is effective-dated by.",
  LK: "Without it, the import no longer suggests link keys, and the Data Vault reading no longer marks link keys or asks about link keys with no relationship.",
  DCK: "Without it, the Data Vault reading no longer shows dependent child keys and counts these columns as descriptive.",
  DK: "Without it, the Data Vault reading no longer shows driving keys and counts these columns as descriptive.",
  MAK: "Without it, the Data Vault reading no longer shows multi-active satellites and counts these columns as descriptive.",
  T_HUB: "Without it, the Data Vault reading no longer notes a hub candidate that has no business key column yet.",
};

export const whatStops = (c: Pick<Classification, "code">): string | null => (c.code !== null ? (WHAT_STOPS[c.code as ClassificationCode] ?? null) : null);

// ---- Data Vault 2.0 mode (P5, item 17; answers F16, F17) ----

/** The workspace settings' methodology text (answer F17). */
export const DATA_VAULT_MODE_TEXT =
  "InfoMapper is methodology-neutral. The Data Vault 2.0 mode adds Data Vault classifications and a Data Vault reading to source table panels (hubs, links, satellites); nothing is generated or enforced.";

/** Uses of Data Vault classifications: their links on tables and columns (answer F16). */
export const dataVaultUses = (cls: ClassificationIndex): number =>
  cls.list.filter(isDataVault).reduce((n, c) => {
    const u = cls.uses(c.id);
    return n + u.tables.length + u.columns.length;
  }, 0);

/** Switching the mode off (item 17): the count only when there are any. */
export const dataVaultOffMessage = (uses: number): string =>
  uses
    ? `Data Vault 2.0 mode is off. ${uses.toLocaleString("en-GB")} Data Vault classification${uses === 1 ? " on a table or column stays" : "s on tables and columns stay"} stored and show${uses === 1 ? "s" : ""} again when the mode is on.`
    : "Data Vault 2.0 mode is off.";

/** The default of a built-in code (tests, the upgrade). */
export const builtinOf = (code: string): BuiltinClassification | undefined => BUILTIN.get(code);
