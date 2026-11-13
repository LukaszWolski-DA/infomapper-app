// InfoDocumenter's own sections as content trees (slice 25, step 3; PRD section 2): Text, the Data dictionary and the
// Source-to-target mapping; since slice 26 the dictionary's three layouts, its long definitions at the end and the
// dimensional entities with their role and feeds (PRD item 8), and the long-texts choice of the source-to-target. Pure:
// each reads the document's model state (`src/domain/document/state.ts`: one snapshot and the app's indexes over it)
// and nothing else, and draws what the prototype's `DOC` draws. The other sections are in `sections-*.ts`.

import { EMPTY, lines, longTextTable, marksStatus, mono, muted, relationshipsBlock, statusShown, strong, text, typeRuns, warn } from "@/domain/document/blocks";
import type { DocColumn, DocNode, DocRun, DocRuns } from "@/domain/document/content";
import type { DocumentSectionType, SectionBuildInput, SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import { checkMappingTypes, formatColumnType } from "@/domain/model/type-check";
import type { Attribute, DocLanguage, Entity, Mapping, SourceColumn } from "@/domain/types";
import { label, type LabelKey } from "./labels";
import { buildReadiness } from "./readiness";
import { buildConventions, buildOverview } from "./sections-model";
import { buildQuality, buildRequirements, buildTrace } from "./sections-requirements";
import { buildRegister, buildSources } from "./sections-sources";
import { attributeLabel, attributesOf, byConcept, columnRuns, feedStatus, fedRule, logicalEntities, NONE, requirementKeys, scopeEntities, statusRun, wordsIn, wordsOf, type L } from "./parts";
import {
  dictionaryOptions,
  INFODOC_SECTION_KINDS,
  s2tOptions,
  textOptions,
  type DictionaryColumn,
  type DictionaryOptions,
  type S2TColumn,
  type S2TOptions,
} from "./sections";

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
  if (state.lookup.isDimensional(a.id)) return fedFromRuns(state, a, scope, t);
  const shown = (state.lookup.mappingsOfAttribute.get(a.id) ?? []).filter((m) => statusShown(scope.mappings, m.status));
  if (!shown.length) return calculatedOrNot(state, a, t);
  return lines(
    shown.map((m) => {
      const cols = state.lookup.inputsOf.get(m.id) ?? [];
      const runs: DocRun[] = cols.flatMap((c, i) => (i ? [text(" + "), ...columnRuns(state, c, t)] : [...columnRuns(state, c, t)]));
      if (marksStatus(scope.mappings) && m.status !== "approved") runs.push(text(" "), statusRun(m.status, t));
      return runs;
    }),
  );
}

/** A calculated attribute without a shown mapping: "= a, b" (its inputs); otherwise "Not mapped". */
function calculatedOrNot(state: DocumentState, a: Attribute, t: L): DocRuns {
  const inputs = state.derivations.inputsOf(a.id);
  if (state.derivations.isCalculated(a.id) && inputs.length) return [muted(`= ${inputs.map((id) => state.lookup.attribute.get(id)?.name ?? "?").join(", ")}`)];
  return [muted(t("notMapped"))];
}

/**
 * A dimensional attribute's "Mapped from" (PRD item 8, the prototype's `attrCell` "src"): each shown feed as the logical
 * attributes it reads, "Entity.attr + Entity.attr", with its status pill while drafts are marked.
 */
function fedFromRuns(state: DocumentState, a: Attribute, scope: SectionScope, t: L): DocRuns {
  const feeds = state.lookup.feedsOf(a.id).filter((f) => statusShown(scope.mappings, feedStatus(f)));
  if (!feeds.length) return calculatedOrNot(state, a, t);
  return lines(
    feeds.map((f) => {
      const runs: DocRun[] = [mono(f.inputs.map((id) => attributeLabel(state, id)).join(" + "))];
      if (marksStatus(scope.mappings) && feedStatus(f) !== "approved") runs.push(text(" "), statusRun(feedStatus(f), t));
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

/** The prototype's `COLW`: the columns' shares of what the definition column leaves, in the "as a column" layout. */
const COLUMN_WEIGHTS: Record<DictionaryColumn, number> = { attribute: 2, type: 1.2, keys: 0.7, nullable: 0.9, pii: 0.8, definition: 0, mappedFrom: 2.3, calculation: 1.6, requirements: 1 };
/** The cards' one line of properties (the prototype's `cardsH`), and their labelled lines. */
const CARD_PROPS: readonly DictionaryColumn[] = ["type", "keys", "nullable", "pii"];
const CARD_LINES: readonly DictionaryColumn[] = ["mappedFrom", "calculation", "requirements"];

/**
 * The entities of the scope, by concept when chosen (a concept on a new page when chosen), each a block: above its table
 * the chosen fields (the stereotype, or a dimensional entity's role in its module's words, PRD item 8; the coverage; the
 * requirements; then the definition), its attributes in the chosen layout (D1: the definition under each row, as a
 * column with its width, or one block per attribute), its relationships after them. With long definitions moved, a
 * longer definition leaves "→ note {n}" and comes in full at the section's end. The coverage line counts by the app's
 * rule whatever the mapping filter (Q-L3): any mapping or feed, any status, or through a calculation.
 */
export function buildDictionary({ state, scope, options, language, keepRows }: SectionBuildInput): DocNode[] {
  const o: DictionaryOptions = dictionaryOptions.parse(options);
  const t = wordsOf(language);
  const fed = fedRule(state);
  const definitions = o.columns.includes("definition");
  const columns = o.layout === "column" ? o.columns : o.columns.filter((c) => c !== "definition");
  const rest = columns.filter((c) => c !== "definition").reduce((n, c) => n + COLUMN_WEIGHTS[c], 0);
  const width = (c: DictionaryColumn) => (c === "definition" ? o.definitionWidth : Math.round(((100 - (definitions ? o.definitionWidth : 0)) * COLUMN_WEIGHTS[c] * 10) / rest) / 10);
  const head: DocColumn[] = columns.map((c) => ({ key: c, label: t(DICTIONARY_LABEL[c]), ...(o.layout === "column" ? { width: width(c) } : {}) }));
  const words = { heading: t("rels"), related: t("related"), name: t("relname"), cardinality: t("cardin"), outsideScope: t("outScope") };
  const moved: Attribute[] = [];
  /** A definition in place, or its reference when it goes to the end (counted in plain words, the prototype's). */
  const definitionRuns = (a: Attribute): DocRuns => {
    if (!a.definition_text) return EMPTY;
    if (o.longDefinitions && wordsIn(a.definition_text).join(" ").length > o.longDefinitions) {
      moved.push(a);
      return [{ text: `→ ${t("defNote")} ${moved.length}`, ref: true }];
    }
    return [text(a.definition_text)];
  };
  const cell = (a: Attribute, c: DictionaryColumn) => (c === "definition" ? definitionRuns(a) : dictionaryCell(state, a, c, scope, t));

  const attributesNode = (attributes: readonly Attribute[]): DocNode => {
    if (o.layout === "cards")
      return {
        kind: "cards",
        variant: "attribute",
        cards: attributes.map((a) => ({
          title: [mono(a.name)],
          props: CARD_PROPS.filter((c) => o.columns.includes(c))
            .map((c) => (c === "nullable" ? (a.is_nullable && !a.is_primary_key ? [text(t("nullable").toLowerCase())] : EMPTY) : dictionaryCell(state, a, c, scope, t)))
            .filter((runs) => runs.length),
          ...(definitions && a.definition_text ? { text: definitionRuns(a) } : {}),
          lines: CARD_LINES.filter((c) => o.columns.includes(c))
            .map((c) => ({ label: t(DICTIONARY_LABEL[c]), runs: dictionaryCell(state, a, c, scope, t) }))
            .filter((x) => x.runs.length),
        })),
      };
    if (o.layout === "column") return { kind: "table", style: "fixed", columns: head, rows: attributes.map((a) => ({ cells: columns.map((c) => cell(a, c)) })) };
    return {
      kind: "table",
      columns: head,
      rows: attributes.map((a) => {
        const below = definitions ? definitionRuns(a) : EMPTY;
        return { cells: columns.map((c) => dictionaryCell(state, a, c, scope, t)), ...(below.length ? { below: [below] } : {}) };
      }),
    };
  };

  const entityNodes = (e: Entity): DocNode[] => {
    const attributes = attributesOf(state, e.id);
    const meta: DocRuns[] = [];
    if (o.entity.includes("stereotype")) {
      const role = e.model_level === "dimensional" ? state.modules.entityRole(e.id, language) : null;
      meta.push([text(role ?? state.stereotypes.name(e.stereotype))]);
    }
    if (o.entity.includes("coverage")) meta.push([text(t("mappedCnt", { a: attributes.filter((a) => fed(a.id)).length, b: attributes.length }))]);
    if (o.entity.includes("requirements")) {
      const keys = requirementKeys(state, "entity", e.id);
      if (keys.length) meta.push(keys);
    }
    const nodes: DocNode[] = [{ kind: "heading", level: 3, text: e.name }];
    if (meta.length) nodes.push({ kind: "meta", parts: meta });
    if (o.entity.includes("definition") && e.definition_text) nodes.push({ kind: "paragraph", runs: [text(e.definition_text)] });
    nodes.push(attributes.length ? attributesNode(attributes) : NONE(t));
    if (o.entity.includes("relationships")) nodes.push(...relationshipsBlock(state, e.id, scope, words));
    // a short entity moves whole to the next page (the style's "keep a table on one page up to", step 4)
    return [{ kind: "group", nodes, mark: state.concept.get(e.concept_id)?.color, ...(keepRows && attributes.length <= keepRows ? { keep: true } : {}) }];
  };

  // the dimensional entities with a role from their module (PRD item 8); with it off or out of scope, none
  const entities = scopeEntities(state, scope).filter((e) => e.model_level === "logical" || state.modules.entityRole(e.id, language) !== null);
  const out: DocNode[] = [];
  if (o.byConcept) {
    let first = true;
    for (const [conceptId, list] of byConcept(state, entities)) {
      if (o.conceptPage && !first) out.push({ kind: "pageBreak" });
      first = false;
      const c = state.concept.get(conceptId);
      out.push({ kind: "heading", level: 2, text: c?.name ?? "?", ...(c ? { swatch: c.color } : {}) }, ...list.flatMap(entityNodes));
    }
  } else out.push(...entities.flatMap(entityNodes));
  if (moved.length)
    out.push(
      { kind: "heading", level: 2, text: t("t_longdefs") },
      { kind: "list", ordered: true, items: moved.map((a) => ({ label: [strong(attributeLabel(state, a.id)), text(" ")], runs: [text(a.definition_text ?? "")] })) },
    );
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
  // the rule and the note are the long texts (D1): under the row, after the table numbered, or a column
  const head = o.columns.map((c) => ({ key: c, label: t(S2T_LABEL[c]), long: S2T_BELOW.has(c) }));
  const rowOf = (m: Mapping): DocRuns[] => o.columns.map((c) => s2tCell(state, m, c, t));
  const table = (rows: readonly DocRuns[][]): DocNode[] => longTextTable(head, rows, o.longTexts, t("none"));
  const firstShort = o.columns.findIndex((c) => !S2T_BELOW.has(c) && c !== "target");
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
      out.push({ kind: "heading", level: 2, text: s.name }, ...table(ms.map(rowOf)));
    }
  } else {
    for (const e of entities) {
      const rows: DocRuns[][] = [];
      for (const a of attributesOf(state, e.id)) {
        const ms = shownOf(a);
        rows.push(...ms.map(rowOf));
        if (!ms.length && o.unmapped) {
          rows.push(o.columns.map((c, i) => (c === "target" ? [mono(a.name)] : i === firstShort ? [warn(t("notMapped"))] : EMPTY)));
        }
      }
      if (rows.length) out.push({ kind: "heading", level: 2, text: e.name }, ...table(rows));
    }
  }
  return out.length ? out : [NONE(t)];
}

// ---- the registrations ----

const titled = (key: LabelKey) => (language: DocLanguage) => label(language, key);

type Registration = Pick<DocumentSectionType, "label" | "description" | "build">;

/** InfoDocumenter's section types: their kinds (`sections.ts`) with their headings, the prototype's "+ Add section" lines and builders. */
const OWN: Record<string, Registration> = {
  text: { label: titled("t_text"), description: "Your own words: introduction, scope, assumptions, open points. Not stored in the model.", build: buildText },
  overview: { label: titled("t_overview"), description: "The workspace's description, what the model holds, and its concepts.", build: buildOverview },
  dict: { label: titled("t_dict"), description: "Entities by concept with the attribute properties you choose.", build: buildDictionary },
  s2t: { label: titled("t_s2t"), description: "Every mapping from source columns to logical attributes, with rules, types and status.", build: buildS2T },
  sources: {
    label: titled("t_sources"),
    description: "The source tables in scope: their classifications and notes, their columns with classifications, notes and use, and a Data Vault reading.",
    build: buildSources,
  },
  classreg: {
    label: titled("t_classreg"),
    description: "Every column and table with the classifications you choose, e.g. all personal data in the sources and the attributes that carry it.",
    build: buildRegister,
  },
  reqs: {
    label: titled("t_reqs"),
    description: "Requirements that touch the scope: their description, kind, status, owner and coverage by approved mappings.",
    build: buildRequirements,
  },
  ready: {
    label: titled("t_ready"),
    description: "What is still open: missing or weak definitions, unmapped attributes, type problems, unapproved mappings, uncovered requirements.",
    build: buildReadiness,
  },
  conv: {
    label: titled("t_conv"),
    description: "How to read the document: relationship notation, mapping statuses, marks, stereotypes, type conversions, naming.",
    build: buildConventions,
  },
  trace: {
    label: titled("t_trace"),
    description: "From each requirement to the attributes that meet it, their source columns and the facts or dimensions they feed.",
    build: buildTrace,
  },
  dq: {
    label: titled("t_dq"),
    description: "Requirements of the kind data-quality rule: the rule, what happens when it fails, its owner and what it applies to.",
    build: buildQuality,
  },
};

export const INFODOC_SECTION_TYPES: readonly DocumentSectionType[] = INFODOC_SECTION_KINDS.map((k) => ({ ...k, module: null, tables: [], ...OWN[k.type]! }));
