// InfoDocumenter's own sections as content trees (slice 25, step 3; PRD section 2): Text, the Data dictionary (the
// logical level only, PRD item 3 as answered) and the Source-to-target mapping. Pure: each reads the document's model
// state (`src/domain/document/state.ts`: one snapshot and the app's indexes over it) and nothing else, and draws what
// the prototype's `DOC` draws for this slice's options (step 1's D6, D8, D9): one layout, long texts under the row.

import { EMPTY, marksStatus, mono, muted, relationshipsBlock, statusShown, strong, text, typeRuns, warn } from "@/domain/document/blocks";
import type { DocColumn, DocNode, DocRow, DocRun, DocRuns } from "@/domain/document/content";
import type { DocumentSectionType, SectionBuildInput, SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import type { LabelTargetKind } from "@/domain/model/labels";
import { checkMappingTypes, formatColumnType } from "@/domain/model/type-check";
import type { Attribute, DocLanguage, Entity, Mapping, SourceColumn } from "@/domain/types";
import { label, type LabelKey } from "./labels";
import {
  dictionaryOptions,
  INFODOC_SECTION_KINDS,
  s2tOptions,
  textOptions,
  type DictionaryColumn,
  type DictionaryOptions,
  type S2TColumn,
  type S2TOptions,
  type TextOptions,
} from "./sections";

type L = (key: LabelKey, values?: Readonly<Record<string, string | number>>) => string;
const wordsOf = (language: DocLanguage): L => (key, values) => label(language, key, values);
const NONE = (t: L): DocNode => ({ kind: "paragraph", runs: [muted(t("none"))] });

/** Runs on separate lines: the first as it is, every later one starting a new line. */
function lines(parts: readonly DocRuns[]): DocRuns {
  return parts.flatMap((runs, i) => (i && runs.length ? [{ ...runs[0]!, lineBreak: true }, ...runs.slice(1)] : runs));
}

/** The keys of an element's own requirements, joined (the prototype's `reqKeys`: its direct links). */
function requirementKeys(state: DocumentState, kind: LabelTargetKind, id: Uuid): DocRuns {
  const keys = state.requirements.of({ kind, id }).direct.map((r) => r.key);
  return keys.length ? [mono(keys.join(", "))] : EMPTY;
}

/** "Order.order_id": a source column with its table (the prototype's `colLabel`), marked when it left the source. */
function columnRuns(state: DocumentState, c: SourceColumn, t: L): DocRuns {
  const table = state.table.get(c.source_table_id);
  const runs: DocRun[] = [mono(`${table?.name ?? "?"}.${c.name}`)];
  if (c.missing_since !== null) runs.push(warn(` ${t("colMissing")}`));
  else if (c.retired_since !== null) runs.push(muted(` ${t("colRetired")}`));
  return runs;
}

const statusRun = (status: Mapping["status"], t: L): DocRun => ({ text: t(status), pill: true });

/** The logical entities of the scope, in the Model tab's order: by concept (the concepts' order), then by name. */
function logicalEntities(state: DocumentState, scope: SectionScope): Map<Uuid, Entity[]> {
  const out = new Map<Uuid, Entity[]>();
  if (!scope.logical) return out;
  for (const c of state.snapshot.model.concepts) out.set(c.id, []);
  for (const e of state.snapshot.model.entities) {
    if (e.model_level !== "logical" || !scope.entityIds.has(e.id)) continue;
    out.get(e.concept_id)?.push(e);
  }
  for (const [id, list] of out) if (!list.length) out.delete(id);
  return out;
}

const attributesOf = (state: DocumentState, entityId: Uuid): readonly Attribute[] => state.lookup.attributesOf.get(entityId) ?? [];

// ---- Text (D8) ----

/** Plain text: a blank line starts a paragraph, a single line break is kept within it. */
export function buildText({ options }: SectionBuildInput): DocNode[] {
  const o = textOptions.parse(options);
  return o.body
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim())
    .map((p) => ({ kind: "paragraph", runs: lines(p.split("\n").map((l) => [text(l)])) }));
}

// ---- Data dictionary ----

const DICTIONARY_LABEL: Record<DictionaryColumn, LabelKey> = {
  attribute: "attribute",
  type: "type",
  keys: "keys",
  nullable: "nullable",
  pii: "pii",
  definition: "def",
  mappedFrom: "mappedFrom",
  calculation: "calc",
  requirements: "reqs",
};

function mappedFromRuns(state: DocumentState, a: Attribute, scope: SectionScope, t: L): DocRuns {
  const shown = (state.lookup.mappingsOfAttribute.get(a.id) ?? []).filter((m) => statusShown(scope.mappings, m.status));
  if (!shown.length) {
    const inputs = state.derivations.inputsOf(a.id);
    if (state.derivations.isCalculated(a.id) && inputs.length) return [muted(`= ${inputs.map((id) => state.lookup.attribute.get(id)?.name ?? "?").join(", ")}`)];
    return [muted(t("notMapped"))];
  }
  return lines(
    shown.map((m) => {
      const cols = state.lookup.inputsOf.get(m.id) ?? [];
      const runs: DocRun[] = cols.flatMap((c, i) => (i ? [text(" + "), ...columnRuns(state, c, t)] : [...columnRuns(state, c, t)]));
      if (marksStatus(scope.mappings) && m.status !== "approved") runs.push(text(" "), statusRun(m.status, t));
      return runs;
    }),
  );
}

function dictionaryCell(state: DocumentState, a: Attribute, column: DictionaryColumn, scope: SectionScope, t: L): DocRuns {
  switch (column) {
    case "attribute":
      return [mono(a.name)];
    case "type":
      return typeRuns(a);
    case "keys": {
      const keys = [a.is_primary_key && "PK", a.is_foreign_key && "FK"].filter(Boolean).join(" ");
      return keys ? [mono(keys)] : EMPTY;
    }
    case "nullable":
      return [text(a.is_nullable && !a.is_primary_key ? t("yes") : t("no"))];
    case "pii":
      return a.is_pii ? [strong("PII")] : EMPTY;
    case "definition":
      return a.definition_text ? [text(a.definition_text)] : EMPTY;
    case "mappedFrom":
      return mappedFromRuns(state, a, scope, t);
    case "calculation":
      return a.is_calculated && a.calc_rule?.trim() ? [mono(a.calc_rule)] : EMPTY;
    case "requirements":
      return requirementKeys(state, "attribute", a.id);
  }
}

/**
 * Entities grouped by concept; above each entity's table the chosen fields (stereotype, coverage, requirements on one
 * line, then the definition); the chosen columns, the definition under each row; the relationships after them. The
 * coverage line counts by the app's rule whatever the mapping filter (Q-L3): any mapping, any status, or through a
 * calculation.
 */
export function buildDictionary({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o: DictionaryOptions = dictionaryOptions.parse(options);
  const t = wordsOf(language);
  const columns = o.columns.filter((c) => c !== "definition");
  const definitions = o.columns.includes("definition");
  const head: DocColumn[] = columns.map((c) => ({ key: c, label: t(DICTIONARY_LABEL[c]) }));
  const words = { heading: t("rels"), related: t("related"), name: t("relname"), cardinality: t("cardin"), outsideScope: t("outScope") };
  const out: DocNode[] = [];
  for (const [conceptId, entities] of logicalEntities(state, scope)) {
    out.push({ kind: "heading", level: 2, text: state.concept.get(conceptId)?.name ?? "?" });
    for (const e of entities) {
      const attributes = attributesOf(state, e.id);
      out.push({ kind: "heading", level: 3, text: e.name });
      const meta: DocRuns[] = [];
      if (o.entity.includes("stereotype")) meta.push([text(state.stereotypes.name(e.stereotype))]);
      if (o.entity.includes("coverage")) meta.push([text(t("mappedCnt", { a: attributes.filter((a) => state.mapped(a.id)).length, b: attributes.length }))]);
      if (o.entity.includes("requirements")) {
        const keys = requirementKeys(state, "entity", e.id);
        if (keys.length) meta.push(keys);
      }
      if (meta.length) out.push({ kind: "meta", parts: meta });
      if (o.entity.includes("definition") && e.definition_text) out.push({ kind: "paragraph", runs: [text(e.definition_text)] });
      if (!attributes.length) out.push(NONE(t));
      else {
        const rows: DocRow[] = attributes.map((a) => {
          const below = definitions && a.definition_text ? [[text(a.definition_text)]] : undefined;
          return { cells: columns.map((c) => dictionaryCell(state, a, c, scope, t)), ...(below ? { below } : {}) };
        });
        out.push({ kind: "table", columns: head, rows });
      }
      if (o.entity.includes("relationships")) out.push(...relationshipsBlock(state, e.id, scope, words));
    }
  }
  return out.length ? out : [NONE(t)];
}

// ---- Source-to-target mapping ----

const S2T_LABEL: Record<S2TColumn, LabelKey> = {
  target: "target",
  targetType: "ttype",
  system: "system",
  sourceColumn: "srcCol",
  sourceType: "stype",
  rule: "rule",
  status: "status",
  typeCheck: "check",
  note: "note",
  requirements: "reqs",
};
/** Long texts, under the row (D9). */
const S2T_BELOW: ReadonlySet<S2TColumn> = new Set(["rule", "note"]);

function s2tCell(state: DocumentState, m: Mapping, column: S2TColumn, t: L): DocRuns {
  const a = state.lookup.attribute.get(m.attribute_id)!;
  const cols = state.lookup.inputsOf.get(m.id) ?? [];
  const joined = (part: (c: SourceColumn) => DocRuns) => cols.flatMap((c, i) => (i ? [text(" + "), ...part(c)] : [...part(c)]));
  switch (column) {
    case "target":
      return [mono(a.name)];
    case "targetType":
      return typeRuns(a);
    case "system": {
      const names = [...new Set(cols.map((c) => state.system.get(state.table.get(c.source_table_id)?.source_system_id ?? "")?.name ?? "?"))];
      return names.length ? [text(names.join(", "))] : EMPTY;
    }
    case "sourceColumn":
      return joined((c) => columnRuns(state, c, t));
    case "sourceType":
      return joined((c) => [mono(formatColumnType(c))]);
    case "rule":
      return m.kind === "transform" ? [text(`${t("transform")}: `), mono(m.rule_expression ?? "")] : [text(t("direct"))];
    case "status":
      return [statusRun(m.status, t)];
    case "typeCheck": {
      const check = checkMappingTypes(m, a, cols);
      return check.ok ? [text("✓")] : [warn(check.message)];
    }
    case "note":
      return m.note_text ? [text(m.note_text)] : EMPTY;
    case "requirements":
      return requirementKeys(state, "mapping", m.id);
  }
}

/**
 * Every shown mapping onto the scope's logical attributes (a mapping's target is logical, AD-34), with the chosen
 * columns, the rule and the note under the row (D9); grouped by target entity, with the attributes that have no mapping
 * when chosen, or by source system (a mapping reading two systems is under both), the systems by name.
 */
export function buildS2T({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o: S2TOptions = s2tOptions.parse(options);
  const t = wordsOf(language);
  const columns = o.columns.filter((c) => !S2T_BELOW.has(c));
  const below = o.columns.filter((c) => S2T_BELOW.has(c));
  const head: DocColumn[] = columns.map((c) => ({ key: c, label: t(S2T_LABEL[c]) }));
  const rowOf = (m: Mapping): DocRow => {
    const parts = below.map((c) => ({ c, runs: s2tCell(state, m, c, t) })).filter((x) => x.runs.length);
    // with both chosen, each long text is labelled (the prototype's `ltable`)
    const long = parts.map((x) => (below.length > 1 ? [strong(`${t(S2T_LABEL[x.c])}: `), ...x.runs] : x.runs));
    return { cells: columns.map((c) => s2tCell(state, m, c, t)), ...(long.length ? { below: long } : {}) };
  };
  const entities = [...logicalEntities(state, scope).values()].flat();
  const shownOf = (a: Attribute) => (state.lookup.mappingsOfAttribute.get(a.id) ?? []).filter((m) => statusShown(scope.mappings, m.status));
  const out: DocNode[] = [];
  if (o.group === "system") {
    const bySystem = new Map<Uuid, Mapping[]>();
    for (const e of entities)
      for (const a of attributesOf(state, e.id))
        for (const m of shownOf(a)) {
          const systems = new Set((state.lookup.inputsOf.get(m.id) ?? []).map((c) => state.table.get(c.source_table_id)?.source_system_id).filter((id): id is Uuid => !!id));
          for (const s of systems) (bySystem.get(s) ?? bySystem.set(s, []).get(s)!).push(m);
        }
    for (const s of state.snapshot.model.sourceSystems) {
      const ms = bySystem.get(s.id);
      if (!ms) continue;
      out.push({ kind: "heading", level: 2, text: s.name }, { kind: "table", columns: head, rows: ms.map(rowOf) });
    }
  } else {
    for (const e of entities) {
      const rows: DocRow[] = [];
      for (const a of attributesOf(state, e.id)) {
        const ms = shownOf(a);
        rows.push(...ms.map(rowOf));
        if (!ms.length && o.unmapped) {
          rows.push({ cells: columns.map((c, i) => (c === "target" ? [mono(a.name)] : i === (columns[0] === "target" ? 1 : 0) ? [warn(t("notMapped"))] : EMPTY)) });
        }
      }
      if (rows.length) out.push({ kind: "heading", level: 2, text: e.name }, { kind: "table", columns: head, rows });
    }
  }
  return out.length ? out : [NONE(t)];
}

// ---- the registrations ----

const kind = (type: string) => INFODOC_SECTION_KINDS.find((k) => k.type === type)!;
const titled = (key: LabelKey) => (language: DocLanguage) => label(language, key);

/** InfoDocumenter's three section types: their kinds (`sections.ts`) with their headings and builders. */
export const INFODOC_SECTION_TYPES: readonly DocumentSectionType[] = [
  { ...kind("text"), module: null, label: titled("t_text"), heading: (options) => (options as Partial<TextOptions>).heading ?? null, tables: [], build: buildText },
  { ...kind("dict"), module: null, label: titled("t_dict"), tables: [], build: buildDictionary },
  { ...kind("s2t"), module: null, label: titled("t_s2t"), tables: [], build: buildS2T },
];
