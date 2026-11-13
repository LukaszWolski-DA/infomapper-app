// The presets a new document is made from (slice 25, step 1's D1 as Łukasz answered): the prototype's labels, each with
// this slice's sections only. A module's section ends a preset when its kind names the preset and it is available as
// the document is made (InfoCube's Dimensional model ends the source-to-target one while InfoCube is on).

import type { DocumentSectionKind } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import type { Workspace } from "@/domain/types";
import type { DocumentPreset, DocumentSection, MappingFilter } from "./types";

/** A preset's section: an own type with its options over the type's defaults, or where the modules' sections go. */
export type PresetSection = { readonly type: string; readonly options?: Readonly<Record<string, unknown>> } | { readonly modules: true };

export interface Preset {
  readonly code: DocumentPreset;
  /** The new document's name, and the preset's label in the New document dialog. */
  readonly label: string;
  readonly description: string;
  readonly audience: string | null;
  readonly mappings: MappingFilter;
  /** The draft mark (the ETL preset has none, the prototype's). */
  readonly watermark: boolean;
  readonly sections: readonly PresetSection[];
}

const INTRODUCTION =
  "This document describes the data the warehouse will hold, in business terms. Definitions come from the model; ask the data owner listed for each requirement about anything unclear.";

/**
 * Slice 26 (D2 as Łukasz answered): the prototype's presets without Diagrams, Figure and Changes since a baseline; the
 * sign-off preset comes with baselines. The descriptions are the prototype's without the diagrams.
 */
export const PRESETS: readonly Preset[] = [
  {
    code: "dictionary",
    label: "Data dictionary for the business",
    description: "Definitions, personal data and requirements. No technical mapping detail.",
    audience: "Business",
    mappings: "approved",
    watermark: true,
    sections: [
      { type: "text", options: { body: INTRODUCTION } },
      { type: "overview" },
      { type: "conv", options: { statuses: false, types: false, marks: true } },
      { type: "dict", options: { columns: ["attribute", "type", "pii", "definition"], entity: ["definition"] } },
      { type: "reqs", options: { columns: ["key", "name", "kind", "coverage"] } },
      { type: "dq", options: { columns: ["key", "name", "appliesTo", "description"] } },
      { type: "classreg" },
    ],
  },
  {
    code: "s2t",
    label: "Source-to-target specification for ETL",
    description: "Every mapping with rules, types and status; source tables.",
    audience: "ETL developers",
    mappings: "notdraft",
    watermark: false,
    sections: [
      { type: "conv", options: { stereotypes: false } },
      { type: "s2t", options: { columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck"], unmapped: true } },
      { type: "sources" },
      { modules: true },
      { type: "dq" },
    ],
  },
  {
    code: "blank",
    label: "Blank document",
    description: "A cover and an empty introduction. Add the sections you need.",
    audience: null,
    mappings: "all",
    watermark: true,
    sections: [{ type: "text", options: { body: "" } }],
  },
];

/** A new section entry: on, the type's default heading, on a new page (slice 26, F10). */
export const newSection = (id: Uuid, type: string, options: Record<string, unknown>): DocumentSection => ({ id, type, on: true, heading: null, newPage: true, options });

export const presetOf = (code: DocumentPreset): Preset => PRESETS.find((p) => p.code === code)!;

/**
 * A new document's sections from its preset: each own section with its kind's defaults and the preset's options over
 * them; where the preset says, every registered kind that names the preset and is available in the workspace now, with
 * its defaults; all on.
 */
export function presetSections(preset: Preset, kinds: Iterable<DocumentSectionKind>, workspace: Workspace, newId: () => Uuid): DocumentSection[] {
  const all = [...kinds];
  const byType = new Map(all.map((k) => [k.type, k]));
  return preset.sections.flatMap((s) => {
    if ("modules" in s) return all.filter((k) => k.presets.includes(preset.code) && k.available(workspace)).map((k) => newSection(newId(), k.type, k.defaults()));
    const kind = byType.get(s.type);
    return [newSection(newId(), s.type, { ...(kind?.defaults() ?? {}), ...structuredClone(s.options ?? {}) })];
  });
}
