// The extension point for document sections (slice 25, R2-2b1, step 1's F8; AD-33's addition as proposed): a section
// type is registered by InfoDocumenter for its own sections and by another module for its (InfoCube's Dimensional
// model), and InfoDocumenter stores, checks and draws them without knowing the module. In InfoMapper's domain because
// modules never import each other; `src/compose/documents.ts` joins the registrations.
//
// Two halves: the recipe's (`DocumentSectionKind`: what is stored, its defaults and its options' schema, when it is
// available, which presets end with it), which the commands read; and the drawing's (`DocumentSectionType`: its label,
// the module tables it reads and its pure builder), which the content tree reads (step 3).

import type { z } from "zod";
import type { Uuid } from "../ids";
import { domainError, type DomainError } from "../errors";
import type { DocLanguage, ModuleTable, Workspace } from "../types";
import type { DocNode } from "./content";
import type { DocumentState } from "./state";

/** A section type's stored name: lower case, digits, `_` and one optional `.` after a module's prefix (`cube.dim`). */
export const SECTION_TYPE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/;

export interface DocumentSectionKind {
  /** The stored name; a module's starts with its own prefix (`cube.dim`). */
  readonly type: string;
  /** Whether it can be drawn in the workspace now (InfoCube's: while InfoCube is on); otherwise it is kept and skipped. */
  readonly available: (workspace: Workspace) => boolean;
  /** The presets that end with it, when it is available as the document is made (step 1's D1). */
  readonly presets: readonly string[];
  /** A new section's options. */
  readonly defaults: () => Record<string, unknown>;
  /** Its options as stored: every save is checked against it. */
  readonly options: z.ZodType<Record<string, unknown>>;
}

/**
 * What a section is drawn for: the entities the scope covers (both levels; a section takes its own level), whether
 * each level is in scope, and the mappings shown.
 */
export interface SectionScope {
  /** The entities in scope (the projects' cards and the concepts chosen); every live entity when nothing narrows it. */
  readonly entityIds: ReadonlySet<Uuid>;
  readonly logical: boolean;
  readonly dimensional: boolean;
  readonly mappings: "all" | "notdraft" | "approved";
}

export interface SectionBuildInput<T extends ModuleTable = ModuleTable> {
  /** The snapshot and the app's indexes over it, built once per document (`state.ts`). */
  readonly state: DocumentState<T>;
  readonly scope: SectionScope;
  readonly options: Record<string, unknown>;
  readonly language: DocLanguage;
}

export interface DocumentSectionType<T extends ModuleTable = ModuleTable> extends DocumentSectionKind {
  /** The module's name as people know it ("InfoCube"), for the note on a section skipped while it is off; null: InfoDocumenter's own. */
  readonly module: string | null;
  /** Its default heading in each documentation language. */
  readonly label: (language: DocLanguage) => string;
  /** A heading its options set instead (Text's), or null for the default. */
  readonly heading?: (options: Record<string, unknown>) => string | null;
  /** The module tables its builder reads from the snapshot. */
  readonly tables: readonly T[];
  /** Pure: the section's nodes after its heading, from the model state alone (never a store). */
  build(input: SectionBuildInput<T>): readonly DocNode[];
}

/** The registered kinds by type; a name registered twice or not in the stored shape throws (a mistake in the wiring). */
export function sectionKinds<K extends DocumentSectionKind>(list: readonly K[]): ReadonlyMap<string, K> {
  const out = new Map<string, K>();
  for (const k of list) {
    if (!SECTION_TYPE_RE.test(k.type)) throw new Error(`The section type "${k.type}" is not a valid name.`);
    if (out.has(k.type)) throw new Error(`The section type "${k.type}" is registered twice.`);
    out.set(k.type, k);
  }
  return out;
}

/** The refusal of options that do not fit their section's type: the first message, with the section's id. */
export function sectionOptionsRefusal(kinds: ReadonlyMap<string, DocumentSectionKind>, section: { id: Uuid; type: string; options: unknown }): DomainError | null {
  const kind = kinds.get(section.type);
  // a type no module knows is kept as it is (PRD section 3): its options are not checked
  if (!kind) return null;
  const parsed = kind.options.safeParse(section.options);
  if (parsed.success) return null;
  return domainError("invalid", parsed.error.issues[0]?.message ?? "These options are not valid.", { [`sections.${section.id}`]: "invalid" });
}
