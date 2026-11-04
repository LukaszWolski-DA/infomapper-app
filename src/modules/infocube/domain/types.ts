// InfoCube's description of facts and dimensions (slice 15a, C-2, C-4): its own rows, pointing to InfoMapper's entities
// and attributes, never the other way. InfoMapper's code never imports this module; `src/compose/` wires it in (AD-33).

import type { Uuid } from "@/domain/ids";
import type { StandardColumns } from "@/domain/types";

/** A dimensional entity's role (C-5): in place of the stereotype. */
export const CUBE_ROLES = ["fact", "dimension"] as const;
export type CubeRole = (typeof CUBE_ROLES)[number];

/** A dimension's slowly changing dimension type, for the whole dimension (spec, scope): 0 keep, 1 overwrite, 2 history. */
export const SCD_TYPES = [0, 1, 2] as const;
export type ScdType = (typeof SCD_TYPES)[number];
/** A new dimension's type (spec, data model). */
export const DEFAULT_SCD_TYPE: ScdType = 1;

/** A measure's additivity (spec, B-4). */
export const ADDITIVITIES = ["additive", "semi", "non"] as const;
export type Additivity = (typeof ADDITIVITIES)[number];

/**
 * Exactly one row per dimensional entity (spec, data model): its role, a fact's grain (plain text, null until written),
 * a dimension's SCD type. A fact has no SCD type and a dimension no grain.
 */
export interface CubeEntity extends StandardColumns {
  entity_id: Uuid;
  role: CubeRole;
  grain: string | null;
  scd_type: ScdType | null;
}

/** An attribute of a fact that is a measure (spec, data model): one row per such attribute. */
export interface CubeMeasure extends StandardColumns {
  attribute_id: Uuid;
  additivity: Additivity;
  /** "Not additive across …" for a semi-additive measure (e.g. "Date"); null when not written. */
  semi_note: string | null;
}

/** InfoCube's tables with their row types. */
export interface InfoCubeRows {
  cube_entity: CubeEntity;
  cube_measure: CubeMeasure;
}
export type InfoCubeTable = keyof InfoCubeRows;

// The module's tables join the tables a command may write (AD-33): InfoMapper's code never names them.
declare module "@/domain/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation adds InfoCube's tables
  interface WritableRows extends InfoCubeRows {}
}
