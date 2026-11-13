// InfoCube's section of a generated document (slice 25, R2-2b1): the Dimensional model, registered through InfoMapper's
// extension point (`src/domain/document/sections.ts`), so InfoDocumenter stores and draws it without knowing InfoCube.
// Its options as stored, its builder (step 3) and its words in the three documentation languages (`document-words.ts`,
// Q-L4). The builder reads InfoCube's own indexes over the snapshot's rows (`cubeIndex`, `mappingIndex`, `historyLabel`,
// `cubeTitle`, `unknownValueOf`, `unknownFit`), never a copy of their rules and never a store.

import { z } from "zod";
import { EMPTY, marksStatus, mono, muted, relationshipsBlock, statusShown, strong, text, typeRuns, warn } from "@/domain/document/blocks";
import type { DocNode, DocRow, DocRun, DocRuns } from "@/domain/document/content";
import type { DocumentSectionKind, DocumentSectionType, SectionBuildInput } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import type { AttributeFeeds } from "@/domain/model/requirements";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { DocLanguage, Entity } from "@/domain/types";
import { busMatrix } from "./bus-matrix";
import type { CubeCheckRows } from "./checks";
import { CUBE_DOC_WORDS, type CubeDocWords } from "./document-words";
import { cubeIndex } from "./keys";
import { cubeRequirementFeeds, mappingIndex, type MappingIndex } from "./mappings";
import type { CubeEntity, CubeMappingStatus, InfoCubeTable } from "./types";
import { unknownFit, unknownValueOf } from "./unknown-member";
import { cubeTitle, historyLabel, type TypeContext } from "./view";

/** The stored name of InfoCube's section. */
export const CUBE_SECTION_TYPE = "cube.dim";

export const cubeSectionOptions = z
  .object({
    /** Facts: type, grain, their dimensions with role, key and "no match" value, measures. */
    facts: z.boolean(),
    /** Dimensions: history and unknown member. */
    dimensions: z.boolean(),
    /** The definitions of a fact's dimensions in its table. */
    dimensionDefinitions: z.boolean(),
    /** Measures with their additivity. */
    measures: z.boolean(),
    /** Each dimension's relationships. */
    relationships: z.boolean(),
    /** Every dimensional attribute with its feed from the logical model. */
    feeds: z.boolean(),
  })
  .strict();
export type CubeSectionOptions = z.output<typeof cubeSectionOptions>;

export const CUBE_SECTION_DEFAULTS: CubeSectionOptions = { facts: true, dimensions: true, dimensionDefinitions: true, measures: true, relationships: true, feeds: true };

/** Available while InfoCube is on; it ends the source-to-target preset (step 1's D1). */
export const CUBE_SECTION_KIND: DocumentSectionKind = {
  type: CUBE_SECTION_TYPE,
  available: (workspace) => workspace.infocube,
  presets: ["s2t"],
  defaults: () => ({ ...CUBE_SECTION_DEFAULTS }),
  options: cubeSectionOptions as unknown as z.ZodType<Record<string, unknown>>,
};

/** The tables the section reads from the snapshot. */
export const CUBE_SECTION_TABLES = ["cube_entity", "cube_measure", "cube_key", "cube_mapping", "cube_mapping_input", "cube_attribute"] as const satisfies readonly InfoCubeTable[];
export type CubeSectionTable = (typeof CUBE_SECTION_TABLES)[number];

/** The tables the requirement feeds read (`cubeDocumentFeeds`). */
export const CUBE_FEED_TABLES = ["cube_mapping", "cube_mapping_input"] as const satisfies readonly InfoCubeTable[];
type FeedTable = (typeof CUBE_FEED_TABLES)[number];

const mappingsOf = (snapshot: WorkspaceSnapshot<FeedTable>): MappingIndex =>
  mappingIndex({
    entities: snapshot.model.entities,
    attributes: snapshot.model.attributes,
    cubeMappings: snapshot.modules.cube_mapping,
    cubeMappingInputs: snapshot.modules.cube_mapping_input,
    relationships: snapshot.model.relationships,
  });

/**
 * What the dimensional mappings feed, for the document's requirement index (slice 15d's `cubeRequirementFeeds`, as every
 * later caller of the index passes them): from the snapshot's rows; none while there is no dimensional mapping.
 */
export function cubeDocumentFeeds(snapshot: WorkspaceSnapshot<FeedTable>): AttributeFeeds {
  if (!snapshot.modules.cube_mapping.length) return {};
  return cubeRequirementFeeds(mappingsOf(snapshot), snapshot.model.attributes);
}

const statusRun = (status: CubeMappingStatus, w: CubeDocWords): DocRun => ({ text: w.status[status], pill: true, status });

/** Runs on separate lines. */
const lines = (parts: readonly DocRuns[]): DocRuns => parts.flatMap((runs, i) => (i && runs.length ? [{ ...runs[0]!, lineBreak: true }, ...runs.slice(1)] : runs));

/**
 * The Dimensional model (the prototype's `cube.dim` without the star diagram and the figures, slice C): the facts, then
 * the dimensions, of the scope's dimensional entities in the model's order. A fact: its role's long text, definition,
 * type and grain, its dimensions with role, key and the unknown member's key value ("No match →"), their definitions
 * under the row, its measures with additivity. A dimension: its history, its unknown member's values (or that it has
 * none) and its relationships. Each with its attributes' feeds from the logical model, in the document's language.
 */
export function buildCubeSection({ state, scope, options, language }: SectionBuildInput<CubeSectionTable>): DocNode[] {
  const o = cubeSectionOptions.parse(options);
  const w = CUBE_DOC_WORDS[language];
  const { snapshot } = state;
  const model = snapshot.model;
  const rows = snapshot.modules;
  const ix = cubeIndex({
    entities: model.entities,
    attributes: model.attributes,
    relationships: model.relationships,
    cubeEntities: rows.cube_entity,
    cubeMeasures: rows.cube_measure,
    cubeKeys: rows.cube_key,
    cubeAttributes: rows.cube_attribute,
  });
  const entities = scope.dimensional ? model.entities.filter((e) => e.model_level === "dimensional" && scope.entityIds.has(e.id) && ix.roleOf(e.id)) : [];
  if (!entities.length) return [{ kind: "paragraph", runs: [muted(w.noDims)] }];
  const maps = mappingsOf(snapshot);
  const context: TypeContext = { aggregates: ix.aggregates(), outriggers: ix.outriggers(), nameOf: ix.nameOf };
  const relationshipWords = { heading: w.rels, related: w.related, name: w.relname, cardinality: w.cardin, outsideScope: w.outScope };
  const table = (labels: readonly string[], body: DocRow[]): DocNode => ({ kind: "table", columns: labels.map((label, i) => ({ key: `c${i}`, label })), rows: body });

  const feeds = (e: Entity): DocNode[] => {
    if (!o.feeds) return [];
    const body = ix.attributesOf(e.id).map((a): DocRow => {
      const ms = maps.mappingsTo(a.id).filter((m) => statusShown(scope.mappings, m.status));
      let from: DocRuns;
      if (ms.length) {
        from = lines(
          ms.map((m) => {
            const runs: DocRun[] = [mono(maps.inputsOf(m.id).map((i) => maps.label(i.attribute_id)).join(" + "))];
            if (marksStatus(scope.mappings) && m.status !== "approved") runs.push(text(" "), statusRun(m.status, w));
            return runs;
          }),
        );
      } else if (a.is_calculated) from = [text("= "), mono(a.calc_rule ?? "")];
      else from = [muted(w.notMapped)];
      const rule = lines(ms.map((m) => (m.kind === "direct" ? [text(w.direct)] : m.kind === "lookup" ? [text(w.lookup)] : [mono(m.rule_expression ?? "")])));
      return { cells: [[mono(a.name)], typeRuns(a), from, rule] };
    });
    return body.length ? [{ kind: "heading", level: 4, text: w.fedFrom }, table([w.attribute, w.type, w.fedFrom, w.rule], body)] : [];
  };

  const definitionOf = (id: Uuid) => model.entities.find((x) => x.id === id)?.definition_text ?? null;

  const fact = (e: Entity, c: CubeEntity): DocNode[] => {
    const type = [w.factTypes[c.fact_type ?? "transaction"], c.is_factless ? w.factless : ""].filter(Boolean).join(" · ");
    const out: DocNode[] = [table([w.ftype, w.grain], [{ cells: [[text(type)], [text(c.grain?.trim() || "–")]] }])];
    const keys = ix.factKeys(e.id);
    if (keys.length) {
      const noMatch = (dimensionId: Uuid): DocRuns => {
        if (!ix.unknownOn(dimensionId)) return [text("–")];
        const pk = ix.pkOf(dimensionId);
        return pk ? [mono(unknownValueOf(ix, pk) || "NULL")] : [text("–")];
      };
      const body = keys.map((k): DocRow => {
        const definition = o.dimensionDefinitions ? definitionOf(k.dimensionId) : null;
        return {
          cells: [[strong(ix.nameOf(k.dimensionId))], k.role ? [text(k.role)] : EMPTY, k.key ? [mono(k.key.name)] : [text("–")], noMatch(k.dimensionId)],
          ...(definition ? { below: [[text(definition)]] } : {}),
        };
      });
      out.push({ kind: "heading", level: 4, text: w.dims }, table([w.dimension, w.role, w.key, w.noMatch], body));
    }
    if (o.measures) {
      const measures = ix.attributesOf(e.id).filter((a) => ix.measureOf(a.id));
      if (measures.length) {
        const body = measures.map((a): DocRow => {
          const m = ix.measureOf(a.id)!;
          return { cells: [[mono(a.name)], [text(w.additivities[m.additivity])], m.semi_note ? [text(m.semi_note)] : EMPTY] };
        });
        out.push({ kind: "heading", level: 4, text: w.measures }, table([w.attribute, w.additivity, w.note], body));
      }
    }
    return out;
  };

  const dimension = (e: Entity, c: CubeEntity): DocNode[] => {
    const out: DocNode[] = [table([w.history], [{ cells: [[text(historyLabel(c, w.snapshot))]] }])];
    if (ix.unknownOn(e.id)) {
      const body = ix.attributesOf(e.id).map((a): DocRow => {
        const value = unknownValueOf(ix, a);
        const cell: DocRuns = value === "" ? [muted("NULL")] : unknownFit(value, a) ? [mono(value), warn(` ${w.unkBad}`)] : [mono(value)];
        return { cells: [[mono(a.name)], typeRuns(a), cell] };
      });
      if (body.length) out.push({ kind: "heading", level: 4, text: w.unk }, table([w.attribute, w.type, w.value], body));
    } else out.push({ kind: "meta", parts: [[text(w.unkOff)]] });
    if (o.relationships) out.push(...relationshipsBlock(state, e.id, scope, relationshipWords));
    return out;
  };

  const one = (e: Entity): DocNode[] => {
    const c = ix.cubeOf(e.id)!;
    const out: DocNode[] = [
      { kind: "heading", level: 3, text: e.name },
      { kind: "meta", parts: [[text(cubeTitle(c, context, w.titles).long)]] },
    ];
    if (e.definition_text) out.push({ kind: "paragraph", runs: [text(e.definition_text)] });
    out.push(...(c.role === "fact" ? fact(e, c) : dimension(e, c)), ...feeds(e));
    return out;
  };

  const facts = entities.filter((e) => ix.roleOf(e.id) === "fact");
  const dimensions = entities.filter((e) => ix.roleOf(e.id) === "dimension");
  const out: DocNode[] = [];
  if (o.facts && facts.length) out.push({ kind: "heading", level: 2, text: w.facts }, ...facts.flatMap(one));
  if (o.dimensions && dimensions.length) out.push({ kind: "heading", level: 2, text: w.dims }, ...dimensions.flatMap(one));
  return out.length ? out : [{ kind: "paragraph", runs: [muted(w.noDims)] }];
}

/** The section type: its kind, its words and its builder, registered by the composition root (`src/compose/documents.ts`). */
export const CUBE_SECTION: DocumentSectionType<CubeSectionTable> = {
  ...CUBE_SECTION_KIND,
  module: "InfoCube",
  label: (language) => CUBE_DOC_WORDS[language].title,
  // slice 26: the prototype's line without the star diagram and the canvases' figures (slice C)
  description: "Facts with grain and type, dimensions and measures; dimensions with history; every dimensional attribute's feed.",
  // the form's check boxes (step 1's list of texts); the dimensions' definitions and the measures keep their defaults
  optionChecks: [
    { key: "facts", label: "Facts: type, grain, dimensions, measures" },
    { key: "dimensions", label: "Dimensions: history and attributes" },
    { key: "relationships", label: "Relationships of each dimension" },
    { key: "feeds", label: "Attributes with their feed from the logical model" },
  ],
  tables: CUBE_SECTION_TABLES,
  build: buildCubeSection,
};

// ---- slice 26: the Bus matrix, and what InfoCube contributes to InfoDocumenter's own sections (Q6, F12) ----

const cubeIndexOf = (snapshot: WorkspaceSnapshot<CubeSectionTable>) =>
  cubeIndex({
    entities: snapshot.model.entities,
    attributes: snapshot.model.attributes,
    relationships: snapshot.model.relationships,
    cubeEntities: snapshot.modules.cube_entity,
    cubeMeasures: snapshot.modules.cube_measure,
    cubeKeys: snapshot.modules.cube_key,
    cubeAttributes: snapshot.modules.cube_attribute,
  });

/** The stored name of InfoCube's second section. */
export const CUBE_BUS_SECTION_TYPE = "cube.bus";

/**
 * The Bus matrix (the prototype's `cube.bus`): the scope's facts against its dimensions, a dot where a relationship joins
 * them (`busMatrix`, the Cube tab's dialog's rows), and under each dimension how many facts use it (conformed when more
 * than one). Nothing to set.
 */
export function buildBusSection({ state, scope, language }: SectionBuildInput<CubeSectionTable>): DocNode[] {
  const w = CUBE_DOC_WORDS[language];
  const { snapshot } = state;
  const ix = cubeIndexOf(snapshot);
  const inScope = scope.dimensional ? snapshot.model.entities.filter((e) => e.model_level === "dimensional" && scope.entityIds.has(e.id)) : [];
  const m = busMatrix(ix, inScope, snapshot.model.concepts);
  if (!m.facts.length || !m.dimensions.length) return [{ kind: "paragraph", runs: [muted(w.noDims)] }];
  const users = (dimensionId: Uuid) => m.facts.filter((f) => m.cells[f.id]?.[dimensionId]?.length).length;
  return [
    {
      kind: "table",
      style: "matrix",
      columns: [{ key: "fact", label: w.fact }, ...m.dimensions.map((d) => ({ key: d.id, label: d.name, vertical: true }))],
      rows: [
        ...m.facts.map((f): DocRow => ({ cells: [[strong(f.name)], ...m.dimensions.map((d) => (m.cells[f.id]?.[d.id]?.length ? [text("●")] : EMPTY))] })),
        { cells: [EMPTY, ...m.dimensions.map((d) => [muted(String(users(d.id)))])] },
      ],
    },
  ];
}

/** The Bus matrix's kind: available while InfoCube is on; in no preset (the prototype's). */
export const CUBE_BUS_SECTION: DocumentSectionType<CubeSectionTable> = {
  type: CUBE_BUS_SECTION_TYPE,
  available: (workspace) => workspace.infocube,
  presets: [],
  defaults: () => ({}),
  options: z.object({}).strict() as unknown as z.ZodType<Record<string, unknown>>,
  module: "InfoCube",
  label: (language) => CUBE_DOC_WORDS[language].busTitle,
  description: "Facts against dimensions: which fact uses which dimension, and the conformed ones.",
  optionNote: "Derived from relationships between facts and dimensions; nothing to set.",
  tables: CUBE_SECTION_TABLES,
  build: buildBusSection,
};

/**
 * A dimensional entity's role in a document's language (Q6: the dictionary prints it where a logical entity's stereotype
 * stands): `cubeTitle`'s long text in InfoCube's document words; null for an entity without a role.
 */
export function cubeDocumentRoles(snapshot: WorkspaceSnapshot<CubeSectionTable>): (entityId: Uuid, language: DocLanguage) => string | null {
  const ix = cubeIndexOf(snapshot);
  const context: TypeContext = { aggregates: ix.aggregates(), outriggers: ix.outriggers(), nameOf: ix.nameOf };
  return (entityId, language) => {
    const c = ix.cubeOf(entityId);
    return c ? cubeTitle(c, context, CUBE_DOC_WORDS[language].titles).long : null;
  };
}

/** InfoCube's rows as its model checks read them (`cubeChecks`), from a document's snapshot. */
export const cubeCheckRowsOf = (snapshot: WorkspaceSnapshot<CubeSectionTable>): CubeCheckRows => ({
  cubeEntities: snapshot.modules.cube_entity,
  cubeMeasures: snapshot.modules.cube_measure,
  cubeKeys: snapshot.modules.cube_key,
  cubeMappings: snapshot.modules.cube_mapping,
  cubeMappingInputs: snapshot.modules.cube_mapping_input,
  cubeAttributes: snapshot.modules.cube_attribute,
});
