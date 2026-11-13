// InfoDocumenter's document definitions (slice 25, D-80 as proposed): a document is a stored recipe, outside the model
// and outside undo, read and written whole. InfoMapper's code never imports this module; `src/compose/` wires it in
// (AD-33).

import type { Uuid } from "@/domain/ids";
import type { DocLanguage, StandardColumns } from "@/domain/types";

/** The presets a document is made from (PRD section 3, D1). */
export const DOCUMENT_PRESETS = ["dictionary", "s2t", "blank"] as const;
export type DocumentPreset = (typeof DOCUMENT_PRESETS)[number];

/** Where a document's content comes from: the live model now, a baseline from its own slice (R2-1a, F6). */
export const SOURCE_KINDS = ["live", "baseline"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
/** The source kinds this slice accepts. */
export const ACCEPTED_SOURCE_KINDS: readonly SourceKind[] = ["live"];

/** Which mappings a document shows: all (drafts marked), all but drafts, approved only. */
export const MAPPING_FILTERS = ["all", "notdraft", "approved"] as const;
export type MappingFilter = (typeof MAPPING_FILTERS)[number];

/**
 * What a document covers. No project chosen means the whole model, a project the entities on its canvases; no concept
 * chosen means every concept. Ids of projects or concepts deleted since are kept and ignored (F7).
 */
export interface DocumentScope {
  projects: Uuid[];
  concepts: Uuid[];
  logical: boolean;
  dimensional: boolean;
  mappings: MappingFilter;
}

/** The title page's own fields; the organization, the client and the workspace come from the workspace. */
export interface DocumentCover {
  /** Null: the document's name. */
  title: string | null;
  subtitle: string | null;
  /** The version label ("1.0"). */
  version: string | null;
  /** The status text ("Draft for review"). */
  status: string | null;
  /** Null: the author's name (D11). */
  preparedBy: string | null;
}

/**
 * One section of a document: its type (InfoDocumenter's own, or a module's by its registered name, `cube.dim`), on or
 * off, and its options as its type's schema reads them. A type whose module is off or unknown is kept and skipped when
 * the document is drawn (PRD section 3).
 */
export interface DocumentSection {
  id: Uuid;
  type: string;
  on: boolean;
  /** Slice 26 (F10): null, the type's default heading in the document's language. */
  heading: string | null;
  /** Slice 26: starts on a new page (the Compact template runs sections on, step 4). */
  newPage: boolean;
  options: Record<string, unknown>;
}

/** A header's or a footer's two parts; null: the grey example (slice 26, F9). */
export interface DocumentFrameFields {
  left: string | null;
  right: string | null;
}

/**
 * How a document looks (slice 26, F9; the prototype's style without figures, logos and baselines). `language` null: the
 * workspace's documentation language (Q8). The style panel comes with step 4; step 2 stores and reads the shape.
 */
export interface DocumentStyle {
  language: DocLanguage | null;
  template: "standard" | "formal" | "compact";
  accent: "indigo" | "teal" | "graphite" | "burgundy";
  colours: "colour" | "mono";
  paper: "A4" | "A3";
  orientation: "portrait" | "landscape";
  notation: "ie" | "uml";
  keepRows: 0 | 10 | 15 | 25 | 40;
  cover: boolean;
  contents: boolean;
  numbers: boolean;
  banded: boolean;
  runningHeader: boolean;
  watermark: boolean;
  header: DocumentFrameFields;
  footer: DocumentFrameFields;
}

/** A stored document definition (`document_definition`). */
export interface DocumentDefinition extends StandardColumns {
  /** Trimmed, not empty; not unique. */
  name: string;
  /** The author (F15): private documents are theirs alone; Duplicate makes the person who duplicates it the author. */
  author_id: Uuid;
  shared: boolean;
  audience: string | null;
  preset: DocumentPreset;
  source_kind: SourceKind;
  /** Null while baselines do not exist (F6). */
  baseline_id: Uuid | null;
  scope: DocumentScope;
  cover: DocumentCover;
  /** Slice 26: a recipe stored before it reads with the defaults and the workspace's language (`upgradeDocument`). */
  style: DocumentStyle;
  /** In the document's order; at most `SECTIONS_MAX`. */
  sections: DocumentSection[];
}

/** InfoDocumenter's tables with their row types. */
export interface InfoDocRows {
  document_definition: DocumentDefinition;
}
export type InfoDocTable = keyof InfoDocRows;

// The module's tables join the tables a command may write (AD-33): InfoMapper's code never names them.
declare module "@/domain/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation adds InfoDocumenter's tables
  interface WritableRows extends InfoDocRows {}
}
