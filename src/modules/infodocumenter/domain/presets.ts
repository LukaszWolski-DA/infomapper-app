// The presets a new document is made from (slice 25, step 1's D1 as Łukasz answered): the prototype's labels, each with
// this slice's sections only. A module's section ends a preset when its kind names the preset and it is available as
// the document is made (InfoCube's Dimensional model ends the source-to-target one while InfoCube is on).

import type { DocumentSectionKind } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import type { Workspace } from "@/domain/types";
import type { DictionaryOptions, S2TOptions, TextOptions } from "./sections";
import type { DocumentPreset, DocumentSection, MappingFilter } from "./types";

export interface Preset {
  readonly code: DocumentPreset;
  /** The new document's name, and the preset's label in the New document dialog. */
  readonly label: string;
  readonly description: string;
  readonly audience: string | null;
  readonly mappings: MappingFilter;
  /** InfoDocumenter's own sections, in order, with their options. */
  readonly sections: readonly { type: "text" | "dict" | "s2t"; options: TextOptions | DictionaryOptions | S2TOptions }[];
}

const INTRODUCTION =
  "This document describes the data the warehouse will hold, in business terms. Definitions come from the model; ask the data owner listed for each requirement about anything unclear.";

export const PRESETS: readonly Preset[] = [
  {
    code: "dictionary",
    label: "Data dictionary for the business",
    description: "Definitions and personal data of the logical model's entities, for the business.",
    audience: "Business",
    mappings: "approved",
    sections: [
      { type: "text", options: { body: INTRODUCTION } },
      { type: "dict", options: { entity: ["definition"], columns: ["attribute", "type", "pii", "definition"] } },
    ],
  },
  {
    code: "s2t",
    label: "Source-to-target specification for ETL",
    description: "Every mapping with its rule, types and status, and the dimensional model when InfoCube is on.",
    audience: "ETL developers",
    mappings: "notdraft",
    sections: [
      {
        type: "s2t",
        options: { columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck"], group: "entity", unmapped: true },
      },
    ],
  },
  {
    code: "blank",
    label: "Blank document",
    description: "A title page and an empty introduction.",
    audience: null,
    mappings: "all",
    sections: [{ type: "text", options: { body: "" } }],
  },
];

/** A new section entry: on, the type's default heading, on a new page (slice 26, F10). */
export const newSection = (id: Uuid, type: string, options: Record<string, unknown>): DocumentSection => ({ id, type, on: true, heading: null, newPage: true, options });

export const presetOf = (code: DocumentPreset): Preset => PRESETS.find((p) => p.code === code)!;

/**
 * A new document's sections from its preset: the preset's own, then every registered kind that names the preset and is
 * available in the workspace now, with its defaults; all on.
 */
export function presetSections(preset: Preset, kinds: Iterable<DocumentSectionKind>, workspace: Workspace, newId: () => Uuid): DocumentSection[] {
  const own = preset.sections.map((s) => newSection(newId(), s.type, structuredClone(s.options) as Record<string, unknown>));
  const modules = [...kinds].filter((k) => k.presets.includes(preset.code) && k.available(workspace)).map((k) => newSection(newId(), k.type, k.defaults()));
  return [...own, ...modules];
}
