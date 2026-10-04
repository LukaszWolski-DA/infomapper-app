// Type check (D-01, AD-27): does each input column fit the attribute's logical type and parameters?
// The rules are the slice 1a PRD's table, which is stricter than the prototype (Łukasz, 3 October 2026):
//   string ← text types (length check when both have one) · integer ← integer types
//   decimal ← decimal or integer (precision and scale checks) · date, datetime ← date and time types
//   boolean ← bit, boolean · json ← json or text · custom ← a column whose type has the custom type's name.
// Anything else is a type problem with a short reason. A transform with a rule is never a type problem.

import type { AttributeType, Mapping, SourceColumn } from "../types";
import type { Uuid } from "../ids";

export type PhysicalClass = "text" | "integer" | "decimal" | "temporal" | "boolean" | "json" | "other";

const PHYSICAL_CLASSES: Record<Exclude<PhysicalClass, "other">, readonly string[]> = {
  text: ["varchar", "nvarchar", "char", "nchar", "text", "ntext", "string", "character varying", "character", "citext", "clob", "nclob", "uuid", "uniqueidentifier"],
  integer: ["int", "integer", "bigint", "smallint", "tinyint", "int2", "int4", "int8", "serial", "bigserial"],
  decimal: ["decimal", "numeric", "number", "float", "real", "double", "double precision", "float4", "float8", "money", "smallmoney"],
  temporal: ["date", "datetime", "datetime2", "smalldatetime", "datetimeoffset", "timestamp", "timestamptz", "time", "timetz"],
  boolean: ["bit", "boolean", "bool"],
  json: ["json", "jsonb"],
};

const CLASS_OF = new Map<string, PhysicalClass>(
  Object.entries(PHYSICAL_CLASSES).flatMap(([cls, names]) => names.map((n) => [n, cls as PhysicalClass])),
);

/** Digits an integer column can hold, to check it against a decimal's integer part. */
const INTEGER_DIGITS: Record<string, number> = { tinyint: 3, smallint: 5, int2: 5, int: 10, integer: 10, int4: 10, serial: 10, bigint: 19, int8: 19, bigserial: 19 };

/** The base name of a physical type: lower case, without parameters (`VARCHAR(50)` → `varchar`). */
export const baseType = (dataType: string): string => dataType.toLowerCase().split("(")[0]!.trim().replace(/\s+/g, " ");

export const physicalClass = (dataType: string): PhysicalClass => CLASS_OF.get(baseType(dataType)) ?? "other";

export type ColumnType = Pick<SourceColumn, "data_type" | "type_length" | "type_precision" | "type_scale">;

/** `varchar(255)`, `decimal(18,2)`, `int`. */
export function formatColumnType(c: ColumnType): string {
  if (c.type_length !== null) return `${c.data_type}(${c.type_length})`;
  if (c.type_precision !== null) return `${c.data_type}(${c.type_precision}${c.type_scale !== null ? `,${c.type_scale}` : ""})`;
  return c.data_type;
}

/** `string(100)`, `decimal(18,2)`, `integer`; a custom type shows its name. */
export function formatAttributeType(a: AttributeType): string {
  if (a.data_type === "custom") return a.custom_type ?? "custom";
  if (a.data_type === "string" && a.type_length !== null) return `string(${a.type_length})`;
  if (a.data_type === "decimal" && a.type_precision !== null) {
    return `decimal(${a.type_precision}${a.type_scale !== null ? `,${a.type_scale}` : ""})`;
  }
  return a.data_type;
}

export interface TypeVerdict {
  ok: boolean;
  message: string;
}

/** Checks one input column against the attribute's type. */
export function checkColumnType(attribute: AttributeType, column: ColumnType): TypeVerdict {
  const from = formatColumnType(column);
  const to = formatAttributeType(attribute);
  const cls = physicalClass(column.data_type);
  const fits: TypeVerdict = { ok: true, message: `${from} fits ${to}.` };
  const mismatch: TypeVerdict = {
    ok: false,
    message: `${from} does not fit ${to}. Add a transformation rule or change the attribute's data type.`,
  };

  switch (attribute.data_type) {
    case "string":
      if (cls !== "text") return mismatch;
      if (attribute.type_length !== null && column.type_length !== null && column.type_length > attribute.type_length) {
        return { ok: false, message: `${from} does not fit ${to}: values can be longer than ${attribute.type_length} characters.` };
      }
      return fits;
    case "integer":
      return cls === "integer" ? fits : mismatch;
    case "decimal":
      return checkDecimal(attribute, column, cls, from, to, fits, mismatch);
    case "date":
    case "datetime":
      return cls === "temporal" ? fits : mismatch;
    case "boolean":
      return cls === "boolean" ? fits : mismatch;
    case "json":
      return cls === "json" || cls === "text" ? fits : mismatch;
    case "custom":
      return attribute.custom_type !== null && baseType(column.data_type) === baseType(attribute.custom_type) ? fits : mismatch;
  }
}

function checkDecimal(
  attribute: AttributeType,
  column: ColumnType,
  cls: PhysicalClass,
  from: string,
  to: string,
  fits: TypeVerdict,
  mismatch: TypeVerdict,
): TypeVerdict {
  const precision = attribute.type_precision;
  const scale = attribute.type_scale ?? 0;
  if (cls === "integer") {
    const digits = INTEGER_DIGITS[baseType(column.data_type)];
    if (precision !== null && digits !== undefined && digits > precision - scale) {
      return { ok: false, message: `${from} does not fit ${to}: it can hold larger numbers.` };
    }
    return { ok: true, message: `${from} widens to ${to} without loss.` };
  }
  if (cls !== "decimal") return mismatch;
  if (precision === null || column.type_precision === null) return fits;
  const columnScale = column.type_scale ?? 0;
  if (columnScale > scale) {
    return { ok: false, message: `${from} does not fit ${to}: it has more decimal places (${columnScale}) than ${scale}.` };
  }
  if (column.type_precision - columnScale > precision - scale) {
    return { ok: false, message: `${from} does not fit ${to}: it can hold larger numbers.` };
  }
  return fits;
}

export interface MappingTypeCheck {
  ok: boolean;
  /** One sentence for the mapping panel. */
  message: string;
  /** The inputs that do not fit, with their reasons. */
  problems: { source_column_id: Uuid; message: string }[];
}

/** Checks every input of a mapping. A transform with a rule is never a type problem. */
export function checkMappingTypes(
  mapping: Pick<Mapping, "kind" | "rule_expression">,
  attribute: AttributeType,
  inputColumns: readonly (ColumnType & { id: Uuid })[],
): MappingTypeCheck {
  if (mapping.kind === "transform" && mapping.rule_expression?.trim()) {
    return { ok: true, message: "The transformation rule handles the conversion.", problems: [] };
  }
  const verdicts = inputColumns.map((c) => ({ source_column_id: c.id, ...checkColumnType(attribute, c) }));
  const problems = verdicts.filter((v) => !v.ok).map(({ source_column_id, message }) => ({ source_column_id, message }));
  if (problems.length) return { ok: false, message: problems.map((p) => p.message).join(" "), problems };
  const message = verdicts.length === 1 ? verdicts[0]!.message : `All inputs fit ${formatAttributeType(attribute)}.`;
  return { ok: true, message, problems: [] };
}

/**
 * The logical type for a new attribute made from a column (slice 1b, “New attribute from a column”): the type table
 * above in reverse, with the column's parameters. `varchar(100)` → string(100), `decimal(18,2)` → decimal(18,2),
 * `datetime2` → datetime, `date` → date. A time of day has no logical type of its own, so it and anything unknown
 * become custom with the physical name. The result always passes `checkColumnType` for that column.
 */
export function logicalTypeOf(column: ColumnType): AttributeType {
  const type: AttributeType = { data_type: "custom", custom_type: null, type_length: null, type_precision: null, type_scale: null };
  const base = baseType(column.data_type);
  switch (physicalClass(column.data_type)) {
    case "text":
      return { ...type, data_type: "string", type_length: column.type_length };
    case "integer":
      return { ...type, data_type: "integer" };
    case "decimal":
      return {
        ...type,
        data_type: "decimal",
        type_precision: column.type_precision,
        type_scale: column.type_precision !== null ? column.type_scale : null,
      };
    case "temporal":
      if (base === "date") return { ...type, data_type: "date" };
      if (base === "time" || base === "timetz") return { ...type, custom_type: column.data_type.trim() };
      return { ...type, data_type: "datetime" };
    case "boolean":
      return { ...type, data_type: "boolean" };
    case "json":
      return { ...type, data_type: "json" };
    case "other":
      return { ...type, custom_type: column.data_type.trim() };
  }
}
