// InfoCube's description of facts and dimensions (slice 15a, C-2, C-4): its own rows, pointing to InfoMapper's entities
// and attributes, never the other way. InfoMapper's code never imports this module; `src/compose/` wires it in (AD-33).

import type { Uuid } from "@/domain/ids";
import type { StandardColumns, Timestamp } from "@/domain/types";

/** A dimensional entity's role (C-5): in place of the stereotype. */
export const CUBE_ROLES = ["fact", "dimension"] as const;
export type CubeRole = (typeof CUBE_ROLES)[number];

/**
 * A dimension's history (slice 19, D-74; was the SCD type 0, 1, 2): keep (SCD 0), overwrite (SCD 1), history (SCD 2), or
 * a snapshot, the whole dimension kept per snapshot date with its period.
 */
export const HISTORIES = ["keep", "overwrite", "history", "snapshot"] as const;
export type History = (typeof HISTORIES)[number];
/** A new dimension's history (spec, data model: SCD 1). */
export const DEFAULT_HISTORY: History = "overwrite";
/** The SCD number of each history but the snapshot (labels "SCD n", the older rows' `scd_type`). */
export const SCD_NUMBER: Record<Exclude<History, "snapshot">, 0 | 1 | 2> = { keep: 0, overwrite: 1, history: 2 };

/** A fact's type (slice 19): every fact, existing or new, starts as a transaction fact. */
export const FACT_TYPES = ["transaction", "periodic", "accumulating"] as const;
export type FactType = (typeof FACT_TYPES)[number];
export const DEFAULT_FACT_TYPE: FactType = "transaction";

/** A dimension's kind (slice 19): an outrigger is derived from relationships, never stored. */
export const DIM_KINDS = ["standard", "junk"] as const;
export type DimKind = (typeof DIM_KINDS)[number];
export const DEFAULT_DIM_KIND: DimKind = "standard";

/** A measure's additivity (spec, B-4). */
export const ADDITIVITIES = ["additive", "semi", "non"] as const;
export type Additivity = (typeof ADDITIVITIES)[number];

/**
 * Exactly one row per dimensional entity (spec, data model): its role, a fact's grain (plain text, null until written),
 * type, factless flag and base (slice 19), a dimension's kind, history and snapshot period (slice 19) and whether it has
 * an unknown member (slice 22). A fact has none of a dimension's fields and a dimension none of a fact's
 * (`cube_entity_shape_ck`).
 */
export interface CubeEntity extends StandardColumns {
  entity_id: Uuid;
  role: CubeRole;
  grain: string | null;
  /** A fact's type; null for a dimension. */
  fact_type: FactType | null;
  /** A fact deliberately without measures; null for a dimension. */
  is_factless: boolean | null;
  /**
   * The fact this one aggregates (an entity id): never itself, never a cycle (the domain), a live fact when read (a base
   * that is not one reads as none). Cleared in the same change group when the base's entity is deleted (`follows`).
   */
  base_fact_entity_id: Uuid | null;
  /** A dimension's kind; null for a fact. */
  dim_kind: DimKind | null;
  /** A dimension's history; null for a fact. */
  history: History | null;
  /** A dimension's snapshot period ("Month-end"), plain text, kept whatever the history; null for a fact. */
  snapshot_period: string | null;
  /**
   * A dimension's unknown member (slice 22, D-77): the row a fact row gets when its key is empty or has no match. True
   * for every dimension, existing and new, until turned off; null for a fact.
   */
  has_unknown_member: boolean | null;
}

/**
 * Per-attribute settings of a dimensional attribute (slice 22): the unknown member's value of a dimension's attribute,
 * as typed. A row exists only while it holds a value (a cleared value soft-deletes it), one live row per attribute; it
 * goes with its attribute in the same change group.
 */
export interface CubeAttribute extends StandardColumns {
  attribute_id: Uuid;
  /** The unknown member's value as typed: trimmed, never empty; null when not set (no live row has it null yet). */
  unknown_value: string | null;
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
  cube_attribute: CubeAttribute;
}
export type InfoCubeTable = keyof InfoCubeRows;

// The module's tables join the tables a command may write (AD-33): InfoMapper's code never names them.
declare module "@/domain/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation adds InfoCube's tables
  interface WritableRows extends InfoCubeRows {}
}

/**
 * A new row's slice-19 and slice-22 columns for its role (`createCubeEntity`, the demo, tests): a fact a transaction,
 * not factless, without a base; a dimension standard with `history` (overwrite unless given) and its unknown member on.
 */
export function typeColumns(
  role: CubeRole,
  history: History = DEFAULT_HISTORY,
): Pick<CubeEntity, "fact_type" | "is_factless" | "base_fact_entity_id" | "dim_kind" | "history" | "snapshot_period" | "has_unknown_member"> {
  const fact = role === "fact";
  return {
    fact_type: fact ? DEFAULT_FACT_TYPE : null,
    is_factless: fact ? false : null,
    base_fact_entity_id: null,
    dim_kind: fact ? null : DEFAULT_DIM_KIND,
    history: fact ? null : history,
    snapshot_period: null,
    has_unknown_member: fact ? null : true,
  };
}
