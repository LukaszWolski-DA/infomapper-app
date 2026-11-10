// Classifications (slice 7c, P1–P3, D-55; prototype `DEFAULT_CLASSES`, `norm`, `classOf`): the workspace's list of what
// a source table or column means for the model. Built-in classifications have a code the app's rules read; the name is
// only what people see, so a renamed one keeps working and a removed one is simply absent (answer F1). Own ones are
// matched by name and, since slice 23 (D-78), by the code they may get when they are added.
//   One way to read them (item 6, P11): `classificationIndex` is built once per load from the list and its links, and
//   every rule asks `has(objectId, code)`; nothing searches the links while drawing.
//   Names (item 8, answer F10): unique per scope against every other classification's name and every code of that scope
//   (built-in and, since slice 23, own ones), removed ones included (their code stays theirs), compared with `norm`.
//   Codes (slice 23, F4): unique the same way against every code of the workspace, removed and deleted rows and the
//   built-in codes included, and against the names of their scope. So one value of an import file matches at most one
//   classification.
//   Built-in ones are told by `origin` (`isBuiltin`), never by having a code (slice 23, F5).
//   Built-in texts (slice 23, Appendix A): a name and a definition per documentation language; a workspace gets them in
//   its language when it is created, and a later change of the language renames nothing.

import type { CommandContext } from "../changes";
import type { Uuid } from "../ids";
import type { Classification, ClassificationLink, ClassificationOrigin, ClassificationScope, DocLanguage } from "../types";

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

/** A built-in one's name and definition in one documentation language. */
export interface BuiltinText {
  name: string;
  definition: string;
}

/**
 * The built-in names and definitions per documentation language (slice 23, PRD Appendix A, word for word; prototype
 * `CONV.DEF`). English names are the list's own (`BUILTIN_CLASSIFICATIONS`).
 */
export const BUILTIN_TEXTS: Readonly<Record<DocLanguage, Readonly<Record<ClassificationCode, BuiltinText>>>> = {
  en: {
    BK: { name: "Business key", definition: "The column identifies the business object in the source; it survives system changes." },
    PII: { name: "Personal data", definition: "The column holds personal data in the sense of the GDPR." },
    TECH: { name: "Technical / audit", definition: "A technical or audit column of the source system; not business content." },
    LDTS: { name: "Load date", definition: "When the row was loaded." },
    RSRC: { name: "Record source", definition: "Which system or file the row came from." },
    EFF: { name: "Effective date", definition: "The date from which the row is valid in the business." },
    LK: { name: "Link key", definition: "A foreign key that becomes a link between hubs." },
    DCK: { name: "Dependent child key", definition: "Part of the key of a link or a satellite, not a hub of its own." },
    DK: { name: "Driving key", definition: "The side of a link whose change an effectivity satellite tracks." },
    MAK: { name: "Multi-active key", definition: "Several rows are valid at the same time for one key." },
    T_MASTER: { name: "Master data", definition: "Master data: customers, products, organisational units." },
    T_TXN: { name: "Transactions", definition: "Business events: orders, payments, movements." },
    T_REF: { name: "Reference / code list", definition: "Codes and their meanings." },
    T_STG: { name: "Staging", definition: "A copy for loading, not a source of truth." },
    T_LOG: { name: "Log / audit", definition: "Logs and audit trails." },
    T_HIST: { name: "History (SCD2)", definition: "The source keeps history itself (SCD type 2)." },
    T_HUB: { name: "Hub candidate", definition: "Likely the source of a hub." },
    T_LNK: { name: "Link candidate", definition: "Likely the source of a link." },
    T_SAT: { name: "Satellite source", definition: "Likely the source of a satellite." },
  },
  pl: {
    BK: { name: "Klucz biznesowy", definition: "Kolumna identyfikuje obiekt biznesowy w źródle; przetrwa zmiany systemu." },
    PII: { name: "Dane osobowe", definition: "Kolumna zawiera dane osobowe w rozumieniu RODO." },
    TECH: { name: "Techniczna / audytowa", definition: "Kolumna techniczna lub audytowa systemu źródłowego; nie treść biznesowa." },
    LDTS: { name: "Data załadowania", definition: "Kiedy wiersz został załadowany." },
    RSRC: { name: "Źródło rekordu", definition: "Z którego systemu lub pliku pochodzi wiersz." },
    EFF: { name: "Data obowiązywania", definition: "Data, od której wiersz obowiązuje biznesowo." },
    LK: { name: "Klucz linku", definition: "Klucz obcy, który staje się linkiem między hubami." },
    DCK: { name: "Zależny klucz podrzędny", definition: "Część klucza linku lub satelity, a nie osobny hub." },
    DK: { name: "Klucz wiodący", definition: "Strona linku, której zmianę śledzi satelita efektywności." },
    MAK: { name: "Klucz wieloaktywny", definition: "Dla jednego klucza obowiązuje jednocześnie kilka wierszy." },
    T_MASTER: { name: "Dane podstawowe", definition: "Dane podstawowe: klienci, produkty, jednostki organizacyjne." },
    T_TXN: { name: "Transakcje", definition: "Zdarzenia biznesowe: zamówienia, płatności, ruchy." },
    T_REF: { name: "Słownik / lista kodów", definition: "Kody i ich znaczenia." },
    T_STG: { name: "Staging", definition: "Kopia do ładowania, nie źródło prawdy." },
    T_LOG: { name: "Log / audyt", definition: "Logi i ślady audytowe." },
    T_HIST: { name: "Historia (SCD2)", definition: "Źródło samo przechowuje historię (SCD typu 2)." },
    T_HUB: { name: "Kandydat na hub", definition: "Prawdopodobnie źródło huba." },
    T_LNK: { name: "Kandydat na link", definition: "Prawdopodobnie źródło linku." },
    T_SAT: { name: "Źródło satelity", definition: "Prawdopodobnie źródło satelity." },
  },
  de: {
    BK: { name: "Fachlicher Schlüssel", definition: "Die Spalte identifiziert das Geschäftsobjekt in der Quelle; sie überdauert Systemwechsel." },
    PII: { name: "Personenbezogene Daten", definition: "Die Spalte enthält personenbezogene Daten im Sinne der DSGVO." },
    TECH: { name: "Technisch / Audit", definition: "Eine technische oder Audit-Spalte des Quellsystems; kein fachlicher Inhalt." },
    LDTS: { name: "Ladedatum", definition: "Wann die Zeile geladen wurde." },
    RSRC: { name: "Datensatzquelle", definition: "Aus welchem System oder welcher Datei die Zeile stammt." },
    EFF: { name: "Gültigkeitsdatum", definition: "Das Datum, ab dem die Zeile fachlich gilt." },
    LK: { name: "Link-Schlüssel", definition: "Ein Fremdschlüssel, der zu einem Link zwischen Hubs wird." },
    DCK: { name: "Abhängiger Kindschlüssel", definition: "Teil des Schlüssels eines Links oder Satelliten, kein eigener Hub." },
    DK: { name: "Treiberschlüssel", definition: "Die Seite eines Links, deren Wechsel ein Effektivitätssatellit verfolgt." },
    MAK: { name: "Multi-aktiver Schlüssel", definition: "Für einen Schlüssel gelten gleichzeitig mehrere Zeilen." },
    T_MASTER: { name: "Stammdaten", definition: "Stammdaten: Kunden, Produkte, Organisationseinheiten." },
    T_TXN: { name: "Bewegungsdaten", definition: "Geschäftsereignisse: Bestellungen, Zahlungen, Bewegungen." },
    T_REF: { name: "Referenz / Codeliste", definition: "Codes und ihre Bedeutungen." },
    T_STG: { name: "Staging", definition: "Eine Kopie zum Laden, keine führende Quelle." },
    T_LOG: { name: "Log / Audit", definition: "Logs und Audit-Trails." },
    T_HIST: { name: "Historie (SCD2)", definition: "Die Quelle führt selbst Historie (SCD Typ 2)." },
    T_HUB: { name: "Hub-Kandidat", definition: "Wahrscheinlich Quelle eines Hubs." },
    T_LNK: { name: "Link-Kandidat", definition: "Wahrscheinlich Quelle eines Links." },
    T_SAT: { name: "Satellitenquelle", definition: "Wahrscheinlich Quelle eines Satelliten." },
  },
};

/** A built-in one's text in a language (the upgrade, the seed, a new workspace). */
export const builtinText = (code: ClassificationCode, language: DocLanguage): BuiltinText => BUILTIN_TEXTS[language][code];

/** A name or a file's value compared: lower case, without spaces, `_`, `-` and `/` (prototype `norm`). */
export const normClassification = (s: string): string => s.toLowerCase().replace(/[\s_\-/]+/g, "");

/**
 * The workspace's 19 built-in rows (item 4): a new workspace gets them in its creation's change group, with the names
 * and definitions of its documentation language (slice 23, item 9).
 */
export function builtinClassificationRows(ctx: CommandContext, workspaceId: Uuid, language: DocLanguage): Classification[] {
  return BUILTIN_CLASSIFICATIONS.map((b) => {
    const text = builtinText(b.code, language);
    return {
      id: ctx.newId(),
      workspace_id: workspaceId,
      version: 1,
      created_at: ctx.now,
      created_by: ctx.actorId,
      updated_at: ctx.now,
      updated_by: ctx.actorId,
      deleted_at: null,
      code: b.code,
      name: text.name,
      name_key: normClassification(text.name),
      scope: b.scope,
      origin: b.origin,
      definition: text.definition,
    };
  });
}

const isLiveRow = (r: { deleted_at: string | null }) => r.deleted_at === null;

/** Built in (General or Data Vault 2.0), told by its origin, never by having a code (slice 23, F5). */
export const isBuiltin = (c: Pick<Classification, "origin">): boolean => c.origin !== "own";

/** The list's order: built-in ones in the table's order, then the workspace's own by name (with or without a code). */
export function byListOrder(a: Classification, b: Classification): number {
  const oa = isBuiltin(a) && a.code !== null ? (ORDER.get(a.code) ?? 999) : 1000;
  const ob = isBuiltin(b) && b.code !== null ? (ORDER.get(b.code) ?? 999) : 1000;
  return oa - ob || a.name.localeCompare(b.name);
}

/** The panels' groups (item 13): “General”, “Data Vault 2.0”, “This workspace”. */
export const groupOf = (c: Pick<Classification, "origin">): "General" | "Data Vault 2.0" | "This workspace" =>
  c.origin === "own" ? "This workspace" : c.origin === "data_vault" ? "Data Vault 2.0" : "General";

export const isDataVault = (c: Pick<Classification, "origin">): boolean => c.origin === "data_vault";

export const TAKEN_NAME = "That name is taken";

/**
 * The classification a name collides with (answer F10), or null: another classification of the scope with the same
 * name, live, or any one of the scope (removed too) whose code is that name: built-in codes and, since slice 23, own
 * ones (F4). `exceptId`: the one being renamed.
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

// ---- own codes (slice 23, D-78; F4) ----

/** A code's shape: letters, digits and `_`, starting with a letter, at most 30 characters (upper case as stored). */
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
export const BAD_CODE = "Letters, digits and _; starting with a letter";
export const TAKEN_CODE = "That code is taken";

/** A code as typed: trimmed and upper-cased; empty is none. */
export const typedCode = (s: string): string | null => {
  const t = s.trim().toUpperCase();
  return t ? t : null;
};

/**
 * Why a new code is refused, or null (F4): its shape; then, compared as the import compares (`normClassification`),
 * any code of the workspace (built-in codes, removed and deleted rows included, both scopes) or the name of a live
 * classification of its scope. `list`: the workspace's every row.
 */
export function codeRefusal(list: readonly Classification[], scope: ClassificationScope, code: string): string | null {
  if (!CODE_PATTERN.test(code)) return BAD_CODE;
  const key = normClassification(code);
  if (CLASSIFICATION_CODES.some((b) => normClassification(b) === key)) return TAKEN_CODE;
  for (const c of list) {
    if (c.code !== null && normClassification(c.code) === key) return TAKEN_CODE;
    if (c.scope === scope && isLiveRow(c) && c.name_key === key) return TAKEN_CODE;
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
  // built-in ones only (slice 23, F5): the rules read built-in codes; an own code is the import's matter
  const byCode = new Map(list.filter((c) => isBuiltin(c) && c.code !== null).map((c) => [c.code!, c]));
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
  BK: "Without it, the app no longer: suggests business keys on attributes; sends approved mappings back when a business key column changes type; raises business key changes on import; suggests business keys in the import; shows the BK badge on source rows or keeps them in the Keys filter; shows a hub in the Data Vault reading.",
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

export const whatStops = (c: Pick<Classification, "code" | "origin">): string | null =>
  isBuiltin(c) && c.code !== null ? (WHAT_STOPS[c.code as ClassificationCode] ?? null) : null;

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
