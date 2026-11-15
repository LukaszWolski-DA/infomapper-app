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
import type { DocLanguage, ModuleTable, RowFilter, Workspace } from "../types";
import type { DocNode } from "./content";
import type { FigureLines } from "./figure";
import type { FigureEntry } from "./figure-entry";
import type { FigureOrientation, FigureSize } from "./page";
import type { DocumentState } from "./state";

/** A section type's stored name: lower case, digits, `_` and one optional `.` after a module's prefix (`cube.dim`). */
export const SECTION_TYPE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/;

export interface DocumentSectionKind {
  /** The stored name; a module's starts with its own prefix (`cube.dim`). */
  readonly type: string;
  /** Whether it can be drawn in the workspace now (InfoCube's: while InfoCube is on); otherwise it is kept and skipped. */
  readonly available: (workspace: Workspace) => boolean;
  /** Slice 27 (F7): a new entry starts on the same page (the Figure section, the prototype's `page: false`); default: a new page. */
  readonly samePage?: boolean;
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
  /**
   * Slice 26 (F13): the source tables in scope, the prototype's rule: those with a column a shown mapping reads into an
   * entity in scope; with no concept chosen, also those on the scope's canvases (the projects', or every canvas); with
   * neither a project nor a concept chosen, every live table.
   */
  readonly tableIds: ReadonlySet<Uuid>;
  /** Slice 27, step 3: the scope's canvases (the chosen projects', or every live project's). */
  readonly canvasIds: ReadonlySet<Uuid>;
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
  /** Slice 26, step 4: the document's relationship notation (the conventions draw its ends). */
  readonly notation: "ie" | "uml";
  /** Slice 26, step 4: an entity's block with at most this many attributes stays on one page; 0: never. */
  readonly keepRows: number;
  /** Slice 27: the page a figure is laid out on, the style's smallest names and its black and white (F5). */
  readonly page: FigurePage;
  /**
   * Slice 27, step 3: how a section draws figures in the document's words (InfoDocumenter's), so a module's section
   * (InfoCube's star diagram and "Figures from canvases") draws them without naming InfoDocumenter.
   */
  readonly figures: SectionFigures;
}

/** A section's figures as nodes (`figure-node.ts`, `sectionFigures`). */
export interface SectionFigures {
  /**
   * The figures that are on, one after another. `notation` and `warnPt`: Diagrams' own; `canvasHeadings`: the canvas's
   * name as a subsection before its first figure (Diagrams').
   */
  list(entries: readonly FigureEntry[], o?: { readonly notation?: "ie" | "uml"; readonly warnPt?: number; readonly canvasHeadings?: boolean }): DocNode[];
  /** A figure of cards placed in memory, drawn as a canvas of its own (InfoCube's star diagram). */
  placed(figure: PlacedFigure): DocNode[];
}

/** A figure of cards placed by a section (no stored canvas): its cards, what it draws, its size and caption. */
export interface PlacedFigure {
  /** Unique in the section (the star's fact). */
  readonly key: string;
  /** The editor's line under the section's options starts with it ("Fact Sales: 1 figure · …"). */
  readonly label: string;
  /** Its cards as canvas items: entity cards with their place, width and row filter. */
  readonly items: readonly PlacedCard[];
  readonly lines: FigureLines;
  readonly status: boolean;
  readonly size: FigureSize;
  readonly orientation: FigureOrientation;
  readonly caption: string;
}

export interface PlacedCard {
  readonly entityId: Uuid;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly rowFilter: RowFilter;
}

/**
 * Slice 27, step 3: a module's options as the editor draws them (plain data, the app draws the fields): check boxes,
 * segments, selects, a label over a group, a hint, a figure editor (`figures`), the size and orientation of a placed
 * figure (`figureSize`) and the lines of the section's placed figures (`figureLines`). `when`: shown only while each
 * key has its value.
 */
export type SectionOptionField = (
  | { readonly kind: "check"; readonly key: string; readonly label: string }
  | { readonly kind: "seg"; readonly key: string; readonly label: string; readonly items: readonly (readonly [string, string])[] }
  | { readonly kind: "select"; readonly key: string; readonly label: string; readonly items: readonly (readonly [number, string])[]; readonly hint?: string }
  | { readonly kind: "label"; readonly text: string }
  | { readonly kind: "hint"; readonly text: string }
  | { readonly kind: "figures"; readonly key: string; readonly label: string; readonly hint?: string }
  | { readonly kind: "figureSize"; readonly size: string; readonly orientation: string; readonly label: string }
  | { readonly kind: "figureLines" }
) & { readonly when?: readonly { readonly key: string; readonly is: boolean | string | number }[] };

/** What a section's figures read of the document's style (slice 27). */
export interface FigurePage {
  readonly paper: "A4" | "A3";
  readonly orientation: "portrait" | "landscape";
  /** The smallest attribute names in diagrams, in points (D1, D4: the warning and the turn). */
  readonly smallestPt: number;
  readonly mono: boolean;
}

export interface DocumentSectionType<T extends ModuleTable = ModuleTable> extends DocumentSectionKind {
  /** The module's name as people know it ("InfoCube"), for the note on a section skipped while it is off; null: InfoDocumenter's own. */
  readonly module: string | null;
  /** Its default heading in each documentation language. */
  readonly label: (language: DocLanguage) => string;
  /** Its line in the editor's "+ Add section" list and under its options' title (slice 26), in the app's language. */
  readonly description?: string;
  /** Slice 26: a line in place of options, for a type with none to set (the Bus matrix's). */
  readonly optionNote?: string;
  /**
   * A module's options as the form draws them (slice 25, step 4): check boxes of its boolean options, each with its label
   * in the app's language; the form changes these keys only. InfoDocumenter's own sections draw their own fields.
   */
  readonly optionChecks?: readonly { readonly key: string; readonly label: string }[];
  /** Slice 27, step 3: a module's options as the form draws them, in place of `optionChecks` (plain data). */
  readonly optionFields?: readonly SectionOptionField[];
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
