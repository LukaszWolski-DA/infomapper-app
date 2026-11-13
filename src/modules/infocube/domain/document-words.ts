// InfoCube's words in a generated document (slice 25, Q-L4: three languages, given by InfoCube with its section): the
// Dimensional model's headings and labels (the prototype's `LBL` keys of `cube.dim`) and the words the prototype prints
// in English in every language (fact types, histories, additivity, kinds and the role's long text, F25; new). German is
// marked for Łukasz's review (PRD section 7). Names, definitions, grains and rules stay as the model has them.

import type { DocLanguage } from "@/domain/types";
import type { Additivity, FactType } from "./types";
import { ENGLISH_TITLE_WORDS, FACT_TYPE_NAMES, type CubeTitleWords } from "./view";

export interface CubeDocWords {
  readonly title: string;
  readonly facts: string;
  readonly dims: string;
  readonly ftype: string;
  readonly grain: string;
  readonly dimension: string;
  readonly role: string;
  readonly key: string;
  readonly noMatch: string;
  readonly def: string;
  readonly measures: string;
  readonly attribute: string;
  readonly additivity: string;
  readonly note: string;
  readonly history: string;
  readonly unk: string;
  readonly unkOff: string;
  readonly type: string;
  readonly value: string;
  /** Beside a value that does not fit its attribute's type. */
  readonly unkBad: string;
  readonly fedFrom: string;
  readonly rule: string;
  readonly notMapped: string;
  readonly direct: string;
  readonly lookup: string;
  readonly noDims: string;
  readonly rels: string;
  readonly related: string;
  readonly relname: string;
  readonly cardin: string;
  readonly outScope: string;
  readonly status: Readonly<Record<"draft" | "review" | "approved", string>>;
  readonly factTypes: Readonly<Record<FactType, string>>;
  readonly factless: string;
  readonly additivities: Readonly<Record<Additivity, string>>;
  /** The history's "Snapshot" ("SCD n" is the same in every language). */
  readonly snapshot: string;
  /** The role's long text above an entity (`cubeTitle`). */
  readonly titles: CubeTitleWords;
  /** Slice 26: the Bus matrix's heading and its first column (the prototype's `t_bus`, `fact`). */
  readonly busTitle: string;
  readonly fact: string;
}

const EN: CubeDocWords = {
  title: "Dimensional model",
  facts: "Facts",
  dims: "Dimensions",
  ftype: "Fact type",
  grain: "Grain",
  dimension: "Dimension",
  role: "Role",
  key: "Key",
  noMatch: "No match →",
  def: "Definition",
  measures: "Measures",
  attribute: "Attribute",
  additivity: "Additivity",
  note: "Note",
  history: "History",
  unk: "Unknown member",
  unkOff: "This dimension has no unknown member.",
  type: "Type",
  value: "Value",
  unkBad: "does not fit its type",
  fedFrom: "Fed from",
  rule: "Rule",
  notMapped: "Not mapped",
  direct: "Direct copy",
  lookup: "Lookup",
  noDims: "There are no facts or dimensions in this model state.",
  rels: "Relationships",
  related: "Related entity",
  relname: "Relationship",
  cardin: "Cardinality (this : related)",
  outScope: "outside this document",
  status: { draft: "Draft", review: "In review", approved: "Approved" },
  factTypes: FACT_TYPE_NAMES,
  factless: "factless",
  additivities: { additive: "Additive", semi: "Semi-additive", non: "Non-additive" },
  snapshot: "Snapshot",
  titles: ENGLISH_TITLE_WORDS,
  busTitle: "Bus matrix",
  fact: "Fact",
};

const PL: CubeDocWords = {
  title: "Model wymiarowy",
  facts: "Fakty",
  dims: "Wymiary",
  ftype: "Typ faktu",
  grain: "Ziarno",
  dimension: "Wymiar",
  role: "Rola",
  key: "Klucz",
  noMatch: "Brak dopasowania →",
  def: "Definicja",
  measures: "Miary",
  attribute: "Atrybut",
  additivity: "Addytywność",
  note: "Uwaga",
  history: "Historia",
  unk: "Element nieznany",
  unkOff: "Ten wymiar nie ma elementu nieznanego.",
  type: "Typ",
  value: "Wartość",
  unkBad: "nie pasuje do typu",
  fedFrom: "Zasilany z",
  rule: "Reguła",
  notMapped: "Brak mapowania",
  direct: "Kopia bezpośrednia",
  lookup: "Lookup",
  noDims: "W tym stanie modelu nie ma faktów ani wymiarów.",
  rels: "Relacje",
  related: "Powiązana encja",
  relname: "Relacja",
  cardin: "Krotność (ta : powiązana)",
  outScope: "poza tym dokumentem",
  status: { draft: "Szkic", review: "W przeglądzie", approved: "Zatwierdzone" },
  factTypes: { transaction: "Transakcyjny", periodic: "Migawka okresowa", accumulating: "Migawka narastająca" },
  factless: "bez miar",
  additivities: { additive: "Addytywna", semi: "Częściowo addytywna", non: "Nieaddytywna" },
  snapshot: "Migawka",
  titles: {
    fact: (type) => ({ transaction: "Fakt transakcyjny", periodic: "Fakt – migawka okresowa", accumulating: "Fakt – migawka narastająca" })[type],
    factless: "bez miar",
    aggregateOf: (name) => `agregat faktu ${name}`,
    dimension: "Wymiar",
    junkDimension: "Wymiar typu junk",
    snapshot: (period) => `migawka${period ? ` (${period})` : ""}`,
    outriggerOf: (names) => `outrigger wymiaru ${names}`,
  },
  busTitle: "Macierz bus matrix",
  fact: "Fakt",
};

/** German: for Łukasz's review (PRD section 7). */
const DE: CubeDocWords = {
  title: "Dimensionales Modell",
  facts: "Fakten",
  dims: "Dimensionen",
  ftype: "Fakttyp",
  grain: "Granularität",
  dimension: "Dimension",
  role: "Rolle",
  key: "Schlüssel",
  noMatch: "Kein Treffer →",
  def: "Definition",
  measures: "Kennzahlen",
  attribute: "Attribut",
  additivity: "Additivität",
  note: "Hinweis",
  history: "Historie",
  unk: "Unbekanntes Element",
  unkOff: "Diese Dimension hat kein unbekanntes Element.",
  type: "Typ",
  value: "Wert",
  unkBad: "passt nicht zum Typ",
  fedFrom: "Befüllt aus",
  rule: "Regel",
  notMapped: "Nicht gemappt",
  direct: "Direkte Übernahme",
  lookup: "Lookup",
  noDims: "In diesem Modellstand gibt es keine Fakten oder Dimensionen.",
  rels: "Beziehungen",
  related: "Verbundene Entität",
  relname: "Beziehung",
  cardin: "Kardinalität (diese : verbundene)",
  outScope: "außerhalb dieses Dokuments",
  status: { draft: "Entwurf", review: "In Prüfung", approved: "Freigegeben" },
  factTypes: { transaction: "Transaktion", periodic: "Periodischer Snapshot", accumulating: "Akkumulierender Snapshot" },
  factless: "ohne Kennzahlen",
  additivities: { additive: "Additiv", semi: "Semi-additiv", non: "Nicht additiv" },
  snapshot: "Snapshot",
  titles: {
    fact: (type) => ({ transaction: "Transaktionsfakt", periodic: "Fakt (periodischer Snapshot)", accumulating: "Fakt (akkumulierender Snapshot)" })[type],
    factless: "ohne Kennzahlen",
    aggregateOf: (name) => `Aggregat von ${name}`,
    dimension: "Dimension",
    junkDimension: "Junk-Dimension",
    snapshot: (period) => `Snapshot${period ? ` (${period})` : ""}`,
    outriggerOf: (names) => `Outrigger von ${names}`,
  },
  busTitle: "Bus-Matrix",
  fact: "Fakt",
};

export const CUBE_DOC_WORDS: Readonly<Record<DocLanguage, CubeDocWords>> = { en: EN, pl: PL, de: DE };
