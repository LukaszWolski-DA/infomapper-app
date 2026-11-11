// InfoDocumenter's own section kinds (slice 25, PRD section 2): Text, Data dictionary and Source-to-target mapping,
// registered through the same extension point as a module's (`src/domain/document/sections.ts`). Their options as
// stored; the builders come with the content tree (step 3).

import { z } from "zod";
import type { DocumentSectionKind } from "@/domain/document/sections";

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
    .transform((list) => values.filter((v) => list.includes(v)));

const headingSchema = z
  .string()
  .trim()
  .max(HEADING_MAX, "This heading is too long.")
  .nullable()
  .transform((v) => (v ? v : null));

export const textOptions = z
  .object({
    /** Null: the language's "Introduction". */
    heading: headingSchema,
    /** Plain text; a blank line starts a paragraph (D8). */
    body: z.string().max(TEXT_BODY_MAX, "This text is too long."),
  })
  .strict();
export type TextOptions = z.output<typeof textOptions>;

export const dictionaryOptions = z.object({ entity: subsetOf(DICTIONARY_ENTITY_FIELDS), columns: subsetOf(DICTIONARY_COLUMNS) }).strict();
export type DictionaryOptions = z.output<typeof dictionaryOptions>;

export const s2tOptions = z.object({ columns: subsetOf(S2T_COLUMNS), group: z.enum(S2T_GROUPS), unmapped: z.boolean() }).strict();
export type S2TOptions = z.output<typeof s2tOptions>;

/** The prototype's defaults for a section added without a preset's own choice. */
export const TEXT_DEFAULTS: TextOptions = { heading: null, body: "" };
export const DICTIONARY_DEFAULTS: DictionaryOptions = {
  entity: ["stereotype", "definition", "coverage", "relationships"],
  columns: ["attribute", "type", "keys", "pii", "definition", "mappedFrom"],
};
export const S2T_DEFAULTS: S2TOptions = {
  columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status"],
  group: "entity",
  unmapped: false,
};

const always = () => true;
const copy = <T extends object>(value: T) => () => structuredClone(value) as unknown as Record<string, unknown>;
const asRecord = (schema: z.ZodType) => schema as unknown as z.ZodType<Record<string, unknown>>;

/** InfoDocumenter's three kinds; the presets name them themselves, so none ends a preset by registration. */
export const INFODOC_SECTION_KINDS: readonly DocumentSectionKind[] = [
  { type: "text", available: always, presets: [], defaults: copy(TEXT_DEFAULTS), options: asRecord(textOptions) },
  { type: "dict", available: always, presets: [], defaults: copy(DICTIONARY_DEFAULTS), options: asRecord(dictionaryOptions) },
  { type: "s2t", available: always, presets: [], defaults: copy(S2T_DEFAULTS), options: asRecord(s2tOptions) },
];
