// A dimension's unknown member (slice 22, D-77; prototype `unkOn`, `unkDefault`, `unkValue`, `unkFit`): the row a fact
// row gets when its key is empty or has no match (Kimball's −1 row). A dimension has one unless turned off
// (`cube_entity.has_unknown_member`); its values are one per attribute, stored only when typed (`cube_attribute`), and
// an attribute without a stored value takes its default. Pure: one rule for the panel, the fact's Dimensions, a lookup's
// placeholder and the model checks.

import type { Uuid } from "@/domain/ids";
import type { Attribute } from "@/domain/types";
import type { CubeIndex } from "./keys";

type Typed = Pick<Attribute, "data_type" | "type_length" | "is_primary_key">;

/**
 * The value an attribute's field shows while nothing is typed (decision 2): an Integer primary key "-1", a String
 * "Unknown", every other type empty (NULL), Datetime and Custom included (acceptance, answer 1). Not checked against the
 * type (F8): a String shorter than "Unknown" keeps this default.
 */
export function unknownDefault(a: Typed): string {
  if (a.data_type === "integer" && a.is_primary_key) return "-1";
  return a.data_type === "string" ? "Unknown" : "";
}

/** The unknown member's value of an attribute: the stored one, else its default; empty when both are (NULL). */
export const unknownValueOf = (cube: Pick<CubeIndex, "unknownOf">, a: Typed & { id: Uuid }): string => cube.unknownOf(a.id)?.unknown_value ?? unknownDefault(a);

const DATE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;
/** The shape a typed value must have, by type; a date is checked by its shape only (F16). */
const SHAPES = {
  integer: /^-?\d+$/,
  decimal: /^-?\d+(\.\d+)?$/,
  boolean: /^(true|false)$/i,
  date: DATE,
  datetime: DATE,
} as const;

export const UNKNOWN_TEXTS = {
  notA: {
    integer: (v: string) => `“${v}” is not an Integer`,
    decimal: (v: string) => `“${v}” is not a Decimal`,
    boolean: (v: string) => `“${v}” is not a Boolean`,
    date: (v: string) => `“${v}” is not a Date (YYYY-MM-DD)`,
    datetime: (v: string) => `“${v}” is not a Datetime (YYYY-MM-DD HH:MM)`,
    json: (v: string) => `“${v}” is not JSON`,
  },
  tooLong: (v: string, length: number) => `“${v}” is longer than String(${length})`,
  /** The fact's Dimensions row's part and its title. */
  noMatch: (value: string) => `no match → ${value || "NULL"}`,
  noMatchTitle: (key: string, dimension: string) => `A fact row whose ${key} is empty or has no match gets ${dimension}'s unknown member`,
  /** A lookup's "When no match" placeholder while its target's dimension has an unknown member with a value. */
  lookupPlaceholder: (value: string) => `${value} (the unknown member's value)`,
  emptyDefault: "empty (NULL)",
} as const;

/**
 * The value-fit rule (PRD item 7; acceptance, answer 1): why a typed value does not fit its attribute's type, or null
 * when it fits. Integer `-?digits`; Decimal with an optional point and digits; Boolean true or false, any case; Date and
 * Datetime `YYYY-MM-DD`, optionally with a time; JSON parses; String within its length when it has one; Custom fits any
 * value.
 */
export function unknownFit(value: string, a: Pick<Attribute, "data_type" | "type_length">): string | null {
  const type = a.data_type;
  if (type === "custom") return null;
  if (type === "string") return a.type_length != null && value.length > a.type_length ? UNKNOWN_TEXTS.tooLong(value, a.type_length) : null;
  if (type === "json") {
    try {
      JSON.parse(value);
      return null;
    } catch {
      return UNKNOWN_TEXTS.notA.json(value);
    }
  }
  return SHAPES[type].test(value) ? null : UNKNOWN_TEXTS.notA[type](value);
}
