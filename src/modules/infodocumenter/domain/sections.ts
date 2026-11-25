// InfoDocumenter's own section kinds (slice 25, PRD section 2): Text, Data dictionary and Source-to-target mapping,
// registered through the same extension point as a module's (`src/domain/document/sections.ts`). Their options as
// stored; the builders come with the content tree (step 3). Slice 26 adds the prototype's other sections without
// figures (overview, readiness, conventions, source tables, classification register, requirements, traceability, data
// quality rules) and the dictionary's layouts; an option added later has a default, so a stored recipe keeps parsing.

import { z } from "zod";
import { LONG_TEXTS } from "@/domain/document/blocks";
import { figureList } from "@/domain/document/figure-entry";
import type { DocumentSectionKind } from "@/domain/document/sections";
import { uuidSchema } from "@/domain/validation";

/** The longest Text body (F18: as plain text elsewhere). */
export const TEXT_BODY_MAX = 20000;
/** The longest heading. */
export const HEADING_MAX = 200;

/** Above each entity's table, in this order (PRD section 2). */
export const DICTIONARY_ENTITY_FIELDS = ["stereotype", "definition", "coverage", "requirements", "relationships"] as const;
export type DictionaryEntityField = (typeof DICTIONARY_ENTITY_FIELDS)[number];
/** The attribute columns, in this order; the definition is drawn under the row (one layout). */
export const DICTIONARY_COLUMNS = ["attribute", "type", "keys", "nullable", "pii", "definition", "mappedFrom", "calculation", "requirements"] as const;
export type DictionaryColumn = (typeof DICTIONARY_COLUMNS)[number];
/** The source-to-target columns, in this order; the rule and the note are drawn under the row (D9). */
export const S2T_COLUMNS = ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck", "note", "requirements"] as const;
export type S2TColumn = (typeof S2T_COLUMNS)[number];
export const S2T_GROUPS = ["entity", "system"] as const;
export type S2TGroup = (typeof S2T_GROUPS)[number];

/** A choice of some values of a list, each once, kept in the list's order. */
const subsetOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .refine((list) => new Set(list).size === list.length, "Each column is chosen once.")
    .transform((list) => values.filter((v): v is T[number] => (list as readonly string[]).includes(v)));

/** A section's own heading (slice 26: the entry's, every type's; Text's moved there from its options). */
export const headingSchema = z
  .string()
  .trim()
  .max(HEADING_MAX, "This heading is too long.")
  .nullable()
  .transform((v) => (v ? v : null));

export const textOptions = z
  .object({
    /** Plain text; a blank line starts a paragraph (D8). */
    body: z.string().max(TEXT_BODY_MAX, "This text is too long."),
  })
  .strict();
export type TextOptions = z.output<typeof textOptions>;

/** The dictionary's three layouts (D1, the prototype's): the definition under each row, as a column, one block per attribute. */
export const DICTIONARY_LAYOUTS = ["below", "column", "cards"] as const;
export const DEFINITION_WIDTHS = [30, 40, 50, 60] as const;
/** Long definitions: always in place, or over 300 or 600 characters to the end of the section. */
export const LONG_DEFINITIONS = [0, 300, 600] as const;
const oneOfNumbers = <T extends readonly number[]>(values: T, message: string) => z.number().refine((n): n is T[number] => (values as readonly number[]).includes(n), message);

export const dictionaryOptions = z
  .object({
    entity: subsetOf(DICTIONARY_ENTITY_FIELDS),
    columns: subsetOf(DICTIONARY_COLUMNS),
    layout: z.enum(DICTIONARY_LAYOUTS).default("below"),
    definitionWidth: oneOfNumbers(DEFINITION_WIDTHS, "Choose one of the widths.").default(40),
    longDefinitions: oneOfNumbers(LONG_DEFINITIONS, "Choose one of the lengths.").default(0),
    byConcept: z.boolean().default(true),
    conceptPage: z.boolean().default(false),
    /** Slice 27 (D5): the concept's frame as a figure at its group's start, from the first canvas of the scope that has one. */
    conceptFigures: z.boolean().default(false),
  })
  .strict();
export type DictionaryOptions = z.output<typeof dictionaryOptions>;

/** Where long texts go (D1): under each row, after the table numbered, as a column. */
const longTexts = z.enum(LONG_TEXTS).default("row");

export const s2tOptions = z.object({ columns: subsetOf(S2T_COLUMNS), group: z.enum(S2T_GROUPS), unmapped: z.boolean(), longTexts }).strict();
export type S2TOptions = z.output<typeof s2tOptions>;

/** The prototype's defaults for a section added without a preset's own choice. */
export const TEXT_DEFAULTS: TextOptions = { body: "" };
export const DICTIONARY_DEFAULTS: DictionaryOptions = {
  entity: ["stereotype", "definition", "coverage", "relationships"],
  columns: ["attribute", "type", "keys", "pii", "definition", "mappedFrom"],
  layout: "below",
  definitionWidth: 40,
  longDefinitions: 0,
  byConcept: true,
  conceptPage: false,
  conceptFigures: false,
};
export const S2T_DEFAULTS: S2TOptions = {
  columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status"],
  group: "entity",
  unmapped: false,
  longTexts: "row",
};

// ---- slice 26: the other sections (the prototype's options without figures) ----

/** Slice 27 (D5): Model overview's figures, "Below the section's content" or "Right after the description". */
export const OVERVIEW_FIGURES_AT = ["end", "start"] as const;
export const overviewOptions = z
  .object({ stats: z.boolean(), concepts: z.boolean(), figures: figureList.default([]), figuresAt: z.enum(OVERVIEW_FIGURES_AT).default("end") })
  .strict();
export type OverviewOptions = z.output<typeof overviewOptions>;
export const OVERVIEW_DEFAULTS: OverviewOptions = { stats: true, concepts: true, figures: [], figuresAt: "end" };

/** Readiness's checks, in the prototype's order; `modelChecks`: the model's own checks (D-75). */
export const READINESS_CHECKS = ["entityDefinitions", "attributeDefinitions", "weakDefinitions", "notFed", "typeProblems", "notApproved", "requirements", "modelChecks"] as const;
export type ReadinessCheck = (typeof READINESS_CHECKS)[number];
export const READINESS_MAX = [5, 10, 25, 100] as const;
export const readinessOptions = z
  .object({ checks: subsetOf(READINESS_CHECKS), list: z.boolean(), max: oneOfNumbers(READINESS_MAX, "Choose one of the counts.") })
  .strict();
export type ReadinessOptions = z.output<typeof readinessOptions>;
export const READINESS_DEFAULTS: ReadinessOptions = { checks: [...READINESS_CHECKS], list: true, max: 10 };

/** The longest of the document's own naming conventions. */
export const NAMING_MAX = 5000;
export const conventionsOptions = z
  .object({
    notation: z.boolean(),
    statuses: z.boolean(),
    marks: z.boolean(),
    stereotypes: z.boolean(),
    classifications: z.boolean(),
    types: z.boolean(),
    naming: z.string().max(NAMING_MAX, "This text is too long."),
  })
  .strict();
export type ConventionsOptions = z.output<typeof conventionsOptions>;
export const CONVENTIONS_DEFAULTS: ConventionsOptions = { notation: true, statuses: true, marks: true, stereotypes: true, classifications: true, types: true, naming: "" };

export const SOURCE_COLUMNS = ["column", "type", "keys", "classifications", "usedBy", "note"] as const;
export type SourceColumnField = (typeof SOURCE_COLUMNS)[number];
export const sourcesOptions = z
  .object({ columns: subsetOf(SOURCE_COLUMNS), tableClassifications: z.boolean(), tableNote: z.boolean(), dataVault: z.boolean(), longTexts })
  .strict();
export type SourcesOptions = z.output<typeof sourcesOptions>;
export const SOURCES_DEFAULTS: SourcesOptions = { columns: [...SOURCE_COLUMNS], tableClassifications: true, tableNote: true, dataVault: true, longTexts: "row" };

/**
 * The register's classifications: a built-in one by its code ("PII"), an own one by its id (an own one may have no code,
 * D-78); one that is gone since is kept and ignored.
 */
export const registerOptions = z
  .object({
    classifications: z.array(z.string().min(1).max(64)).max(200, "Too many are chosen.").refine((l) => new Set(l).size === l.length, "Each is chosen once."),
    attributes: z.boolean(),
    longTexts,
  })
  .strict();
export type RegisterOptions = z.output<typeof registerOptions>;
export const REGISTER_DEFAULTS: RegisterOptions = { classifications: ["PII"], attributes: true, longTexts: "row" };

export const REQUIREMENT_COLUMNS = ["key", "name", "kind", "status", "priority", "coverage", "scope", "description"] as const;
export type RequirementColumn = (typeof REQUIREMENT_COLUMNS)[number];
export const requirementsOptions = z
  .object({ layout: z.enum(["list", "table"]), columns: subsetOf(REQUIREMENT_COLUMNS), onlyScope: z.boolean(), longTexts })
  .strict();
export type RequirementsOptions = z.output<typeof requirementsOptions>;
export const REQUIREMENTS_DEFAULTS: RequirementsOptions = {
  layout: "list",
  columns: ["key", "name", "kind", "status", "priority", "coverage", "description"],
  onlyScope: true,
  longTexts: "row",
};

export const TRACE_COLUMNS = ["mappedFrom", "feeds", "covered"] as const;
export type TraceColumn = (typeof TRACE_COLUMNS)[number];
export const traceOptions = z
  .object({ columns: subsetOf(TRACE_COLUMNS), descriptions: z.boolean(), layout: z.enum(["byRequirement", "matrix"]), onlyScope: z.boolean() })
  .strict();
export type TraceOptions = z.output<typeof traceOptions>;
export const TRACE_DEFAULTS: TraceOptions = { columns: [...TRACE_COLUMNS], descriptions: true, layout: "byRequirement", onlyScope: true };

export const QUALITY_COLUMNS = ["key", "name", "rule", "onFailure", "status", "owner", "appliesTo", "description"] as const;
export type QualityColumn = (typeof QUALITY_COLUMNS)[number];
export const qualityOptions = z.object({ columns: subsetOf(QUALITY_COLUMNS), onlyScope: z.boolean(), longTexts }).strict();
export type QualityOptions = z.output<typeof qualityOptions>;
export const QUALITY_DEFAULTS: QualityOptions = { columns: ["key", "name", "rule", "onFailure", "owner", "appliesTo", "description"], onlyScope: true, longTexts: "row" };

// ---- slice 27: figures (the prototype's `FIG0` and `figEditor`; the entry is InfoMapper's, `figure-entry.ts`) ----

export { FIGURES_MAX, FIGURES_REFUSAL, figureEntry, newFigure, type FigureEntry } from "@/domain/document/figure-entry";

export const figureOptions = z.object({ figures: figureList }).strict();
export type FigureOptions = z.output<typeof figureOptions>;
export const FIGURE_DEFAULTS: FigureOptions = { figures: [] };

/** Diagrams' notation (D5): the document's, or its own for its figures. */
export const DIAGRAM_NOTATIONS = ["doc", "ie", "uml"] as const;
/** "Warn when names are smaller than" (D5): the document's smallest names (0), or a size of its own. */
export const DIAGRAM_WARN_PT = [0, 5, 6, 7, 8] as const;
/**
 * Diagrams (the prototype's `diagrams`): its figures, made when the section is made (D9: one whole canvas each per
 * canvas of the scope's projects, in tab order) and its own since; the legend under them, its notation and the size
 * its figures' lines warn under.
 */
export const diagramsOptions = z
  .object({
    figures: figureList.default([]),
    legend: z.boolean().default(true),
    notation: z.enum(DIAGRAM_NOTATIONS).default("doc"),
    warnPt: oneOfNumbers(DIAGRAM_WARN_PT, "Choose one of the sizes.").default(0),
  })
  .strict();
export type DiagramsOptions = z.output<typeof diagramsOptions>;
export const DIAGRAMS_DEFAULTS: DiagramsOptions = { figures: [], legend: true, notation: "doc", warnPt: 0 };

// ---- slice 36: "Changes since …" ----

/** "Compared with": a baseline by its id, or null for the previous baseline (B4.1). */
export const changesOptions = z.object({ against: uuidSchema.nullable().default(null) }).strict();
export type ChangesOptions = z.output<typeof changesOptions>;
export const CHANGES_DEFAULTS: ChangesOptions = { against: null };

const always = () => true;
const copy = <T extends object>(value: T) => () => structuredClone(value) as unknown as Record<string, unknown>;
const asRecord = (schema: z.ZodType) => schema as unknown as z.ZodType<Record<string, unknown>>;

const own = (type: string, defaults: object, options: z.ZodType): DocumentSectionKind => ({ type, available: always, presets: [], defaults: copy(defaults), options: asRecord(options) });

/** InfoDocumenter's kinds, in the prototype's "+ Add section" order; the presets name them themselves. */
export const INFODOC_SECTION_KINDS: readonly DocumentSectionKind[] = [
  own("text", TEXT_DEFAULTS, textOptions),
  own("overview", OVERVIEW_DEFAULTS, overviewOptions),
  // slice 27: figures of whole canvases or single frames (D9: made with the section)
  own("diagrams", DIAGRAMS_DEFAULTS, diagramsOptions),
  // slice 27: one or more figures wherever the section stands; it starts on the same page (F7, the prototype's `page: false`)
  { ...own("figure", FIGURE_DEFAULTS, figureOptions), samePage: true },
  own("dict", DICTIONARY_DEFAULTS, dictionaryOptions),
  own("s2t", S2T_DEFAULTS, s2tOptions),
  own("sources", SOURCES_DEFAULTS, sourcesOptions),
  own("classreg", REGISTER_DEFAULTS, registerOptions),
  own("reqs", REQUIREMENTS_DEFAULTS, requirementsOptions),
  own("ready", READINESS_DEFAULTS, readinessOptions),
  own("conv", CONVENTIONS_DEFAULTS, conventionsOptions),
  own("trace", TRACE_DEFAULTS, traceOptions),
  own("dq", QUALITY_DEFAULTS, qualityOptions),
  // slice 36: the changes since a baseline (the prototype's last own section)
  own("changes", CHANGES_DEFAULTS, changesOptions),
];
