// InfoCube's section of a generated document (slice 25, R2-2b1): the Dimensional model, registered through InfoMapper's
// extension point (`src/domain/document/sections.ts`), so InfoDocumenter stores and draws it without knowing InfoCube.
// Its options as stored; its builder and its words in the three documentation languages come with the content tree
// (step 3).

import { z } from "zod";
import type { DocumentSectionKind } from "@/domain/document/sections";

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
