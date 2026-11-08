// InfoCube's description of facts and dimensions (slice 15a, C-2, C-4): its own rows, pointing to InfoMapper's entities
// and attributes, never the other way. InfoMapper's code never imports this module; `src/compose/` wires it in (AD-33).

import type { Uuid } from "@/domain/ids";
import type { StandardColumns, Timestamp } from "@/domain/types";

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

/**
 * A key link (slice 15b, role-playing RP-B): this relationship between a fact and a dimension is carried by this
 * attribute of the fact. One link per relationship and one per attribute among live rows. Picked or added, never
 * matched by name (RP-C). While its attribute is no foreign key the link is inactive: read as absent, kept, back when
 * the flag is (R3).
 */
export interface CubeKey extends StandardColumns {
  relationship_id: Uuid;
  attribute_id: Uuid;
}

/**
 * How a dimensional mapping carries its value (spec, data model; AD-26): a direct copy reads exactly one attribute, and
 * so does a lookup (slice 18): one attribute of a dictionary, read through a logical relationship of that dictionary.
 */
export const CUBE_MAPPING_KINDS = ["direct", "transform", "lookup"] as const;
export type CubeMappingKind = (typeof CUBE_MAPPING_KINDS)[number];

/** A dimensional mapping's status, as InfoMapper's mappings' (spec, B-4; O9: reviewers approve). */
export const CUBE_MAPPING_STATUSES = ["draft", "review", "approved"] as const;
export type CubeMappingStatus = (typeof CUBE_MAPPING_STATUSES)[number];

/**
 * A dimensional mapping (slice 15c, M1, AD-36): logical attribute(s) → this attribute of a fact or dimension. Its inputs
 * are `cube_mapping_input` rows. It goes whole when one of its inputs goes with its logical attribute (Q-5, `goesWhole`).
 * The note is plain text, as the prototype's field. An approval is logged (AD-06): who and when, cleared when it leaves
 * Approved.
 */
export interface CubeMapping extends StandardColumns {
  /** The dimensional target. */
  attribute_id: Uuid;
  kind: CubeMappingKind;
  rule_expression: string | null;
  status: CubeMappingStatus;
  note: string | null;
  approved_by: Uuid | null;
  approved_at: Timestamp | null;
  /**
   * A lookup's relationship (slice 18): a logical relationship of the input's entity, the dictionary. It may point to a
   * deleted relationship (F15: the panel says it is gone). Kept when the kind changes; read only for a lookup.
   */
  lookup_relationship_id: Uuid | null;
  /** A lookup's value when the code is empty or has no match ("Unknown"); null when not given. Kept as the relationship. */
  lookup_default: string | null;
}

/** One input of a dimensional mapping: a logical attribute, in the mapping's order. Unique per mapping among live rows. */
export interface CubeMappingInput extends StandardColumns {
  mapping_id: Uuid;
  /** The logical attribute it reads. */
  attribute_id: Uuid;
  sort_order: number;
}

/** InfoCube's tables with their row types. */
export interface InfoCubeRows {
  cube_entity: CubeEntity;
  cube_measure: CubeMeasure;
  cube_key: CubeKey;
  cube_mapping: CubeMapping;
  cube_mapping_input: CubeMappingInput;
}
export type InfoCubeTable = keyof InfoCubeRows;

// The module's tables join the tables a command may write (AD-33): InfoMapper's code never names them.
declare module "@/domain/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation adds InfoCube's tables
  interface WritableRows extends InfoCubeRows {}
}
