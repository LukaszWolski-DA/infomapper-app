// The comparison's words (slice 35, step 1's Q5): kinds, groups, field names, values; one dictionary per documentation
// language, so slice 36's section "Changes since …" prints the same comparison in the document's language. The app's
// dialogs read English; a document reads its own language's (slice 36).

import type { DocLanguage } from "../types";
import type { BaselineChange, ChangeKind, ClosedList, CompareValue, FieldChange, FieldName, ItemKind } from "./compare";

export interface CompareWords {
  readonly kinds: Readonly<Record<ItemKind, string>>;
  readonly groups: Readonly<Record<ChangeKind, string>>;
  readonly fields: Readonly<Record<FieldName, string>>;
  readonly closed: Readonly<Record<ClosedList, Readonly<Record<string, string>>>>;
  readonly yes: string;
  readonly no: string;
  /** An empty value. */
  readonly none: string;
  /** A long text that changed: "{field} (changed)". */
  readonly changedLong: (field: string) => string;
  /** A short value that changed: "{field}: {old} → {new}". */
  readonly changedShort: (field: string, before: string, after: string) => string;
}

const EN: CompareWords = {
  kinds: {
    entity: "Entity",
    attribute: "Attribute",
    mapping: "Mapping",
    relationship: "Relationship",
    requirement: "Requirement",
    source_table: "Source table",
    source_column: "Source column",
  },
  groups: { added: "Added", changed: "Changed", removed: "Removed" },
  fields: {
    name: "name",
    alias: "alias",
    stereotype: "stereotype",
    concept: "concept",
    definition: "definition",
    type: "type",
    pk: "PK",
    fk: "FK",
    bk: "BK",
    pii: "personal data",
    nullable: "nullable",
    calculated: "calculated",
    rule: "rule",
    status: "status",
    kind: "kind",
    source_columns: "source columns",
    target_attribute: "target attribute",
    note: "note",
    label: "label",
    from_min: "from min",
    from_max: "from max",
    to_min: "to min",
    to_max: "to max",
    from_role: "role at the left end",
    to_role: "role at the right end",
    description: "description",
    priority: "priority",
    severity: "severity",
    owner: "owner",
    external_ref: "external reference",
    parent: "parent",
    expression: "expression",
    system: "system",
    database: "database",
    schema: "schema",
    object_type: "object type",
    file_format: "file format",
    missing: "missing from source",
    classifications: "classifications",
    comment: "comment",
    default: "default",
    not_needed: "not needed",
  },
  closed: {
    mapping_status: { draft: "Draft", review: "In review", approved: "Approved" },
    mapping_kind: { direct: "Direct", transform: "Transform" },
    requirement_kind: { need: "Business need", data: "Data requirement", business_rule: "Business rule", dq_rule: "Data quality rule", non_functional: "Non-functional" },
    requirement_status: { draft: "Draft", agreed: "Agreed", implemented: "Implemented", verified: "Verified" },
    requirement_priority: { must: "Must", should: "Should", could: "Could", wont: "Won't" },
    requirement_severity: { warn: "Warn", block: "Block" },
    object_type: { table: "Table", view: "View", file: "File" },
  },
  yes: "yes",
  no: "no",
  none: "–",
  changedLong: (field) => `${field} (changed)`,
  changedShort: (field, before, after) => `${field}: ${before} → ${after}`,
};

// Slice 36 (Q5, Łukasz's answer 9): Polish accepted as proposed; German for Łukasz's review before the closing. A closed
// value InfoDocumenter's `labels.ts` already names takes that word (`tests/baseline-words.test.ts` compares the two).
const PL: CompareWords = {
  kinds: {
    entity: "Encja",
    attribute: "Atrybut",
    mapping: "Mapowanie",
    relationship: "Relacja",
    requirement: "Wymaganie",
    source_table: "Tabela źródłowa",
    source_column: "Kolumna źródłowa",
  },
  groups: { added: "Dodane", changed: "Zmienione", removed: "Usunięte" },
  fields: {
    name: "nazwa",
    alias: "alias",
    stereotype: "stereotyp",
    concept: "koncept",
    definition: "definicja",
    type: "typ",
    pk: "PK",
    fk: "FK",
    bk: "BK",
    pii: "dane osobowe",
    nullable: "może być pusty",
    calculated: "wyliczany",
    rule: "reguła",
    status: "status",
    kind: "rodzaj",
    source_columns: "kolumny źródłowe",
    target_attribute: "atrybut docelowy",
    note: "notatka",
    label: "etykieta",
    from_min: "od min",
    from_max: "od max",
    to_min: "do min",
    to_max: "do max",
    from_role: "rola po lewej stronie",
    to_role: "rola po prawej stronie",
    description: "opis",
    priority: "priorytet",
    severity: "przy niespełnieniu",
    owner: "właściciel",
    external_ref: "odwołanie zewnętrzne",
    parent: "nadrzędne",
    expression: "wyrażenie",
    system: "system",
    database: "baza danych",
    schema: "schemat",
    object_type: "typ obiektu",
    file_format: "format pliku",
    missing: "brak w źródle",
    classifications: "klasyfikacje",
    comment: "komentarz",
    default: "wartość domyślna",
    not_needed: "niepotrzebna",
  },
  closed: {
    mapping_status: { draft: "Szkic", review: "W przeglądzie", approved: "Zatwierdzone" },
    mapping_kind: { direct: "Kopia bezpośrednia", transform: "Transformacja" },
    requirement_kind: { need: "Potrzeba biznesowa", data: "Wymaganie dotyczące danych", business_rule: "Reguła biznesowa", dq_rule: "Reguła jakości danych", non_functional: "Niefunkcjonalne" },
    requirement_status: { draft: "Szkic", agreed: "Uzgodnione", implemented: "Wdrożone", verified: "Zweryfikowane" },
    requirement_priority: { must: "Musi", should: "Powinno", could: "Może", wont: "Nie teraz" },
    requirement_severity: { warn: "Ostrzeżenie", block: "Blokuje ładowanie" },
    object_type: { table: "Tabela", view: "Widok", file: "Plik" },
  },
  yes: "tak",
  no: "nie",
  none: "–",
  changedLong: (field) => `${field} (zmieniono)`,
  changedShort: (field, before, after) => `${field}: ${before} → ${after}`,
};

const DE: CompareWords = {
  kinds: {
    entity: "Entität",
    attribute: "Attribut",
    mapping: "Mapping",
    relationship: "Beziehung",
    requirement: "Anforderung",
    source_table: "Quelltabelle",
    source_column: "Quellspalte",
  },
  groups: { added: "Hinzugefügt", changed: "Geändert", removed: "Entfernt" },
  fields: {
    name: "Name",
    alias: "Alias",
    stereotype: "Stereotyp",
    concept: "Konzept",
    definition: "Definition",
    type: "Typ",
    pk: "PK",
    fk: "FK",
    bk: "BK",
    pii: "personenbezogene Daten",
    nullable: "NULL zulässig",
    calculated: "berechnet",
    rule: "Regel",
    status: "Status",
    kind: "Art",
    source_columns: "Quellspalten",
    target_attribute: "Zielattribut",
    note: "Notiz",
    label: "Bezeichnung",
    from_min: "von min",
    from_max: "von max",
    to_min: "bis min",
    to_max: "bis max",
    from_role: "Rolle am linken Ende",
    to_role: "Rolle am rechten Ende",
    description: "Beschreibung",
    priority: "Priorität",
    severity: "Schweregrad",
    owner: "Verantwortlich",
    external_ref: "externe Referenz",
    parent: "übergeordnet",
    expression: "Ausdruck",
    system: "System",
    database: "Datenbank",
    schema: "Schema",
    object_type: "Objekttyp",
    file_format: "Dateiformat",
    missing: "fehlt in der Quelle",
    classifications: "Klassifikationen",
    comment: "Kommentar",
    default: "Standardwert",
    not_needed: "nicht benötigt",
  },
  closed: {
    mapping_status: { draft: "Entwurf", review: "In Prüfung", approved: "Freigegeben" },
    mapping_kind: { direct: "Direkte Übernahme", transform: "Transformation" },
    requirement_kind: { need: "Geschäftlicher Bedarf", data: "Datenanforderung", business_rule: "Geschäftsregel", dq_rule: "Datenqualitätsregel", non_functional: "Nicht-funktional" },
    requirement_status: { draft: "Entwurf", agreed: "Abgestimmt", implemented: "Umgesetzt", verified: "Verifiziert" },
    requirement_priority: { must: "Muss", should: "Sollte", could: "Könnte", wont: "Nicht jetzt" },
    requirement_severity: { warn: "Warnen", block: "Ladung blockieren" },
    object_type: { table: "Tabelle", view: "Sicht", file: "Datei" },
  },
  yes: "ja",
  no: "nein",
  none: "–",
  changedLong: (field) => `${field} (geändert)`,
  changedShort: (field, before, after) => `${field}: ${before} → ${after}`,
};

/** By documentation language (slice 36: Polish and German). */
export const COMPARE_WORDS: Readonly<Record<DocLanguage, CompareWords>> = { en: EN, pl: PL, de: DE };

/** A short value as text: "–" when empty, "yes"/"no", a list joined with ", ", a closed list's label. */
export function valueText(v: CompareValue, words: CompareWords): string {
  if (v === null || v === "") return words.none;
  if (typeof v === "boolean") return v ? words.yes : words.no;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length ? v.join(", ") : words.none;
  const coded = v as { list: ClosedList; code: string };
  return words.closed[coded.list][coded.code] ?? coded.code;
}

/** One field's change as text (B4.2): "type: varchar(10) → varchar(20)", or "definition (changed)" for a long text. */
export function fieldText(f: FieldChange, words: CompareWords): string {
  const name = words.fields[f.field];
  return f.long ? words.changedLong(name) : words.changedShort(name, valueText(f.before, words), valueText(f.after, words));
}

/** A change's "What changed": its fields joined with ", " (empty for an added or removed item). */
export const whatChanged = (c: BaselineChange, words: CompareWords): string => c.fields.map((f) => fieldText(f, words)).join(", ");
