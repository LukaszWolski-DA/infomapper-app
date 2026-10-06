import { describe, expect, it } from "vitest";
import type { AttributeType } from "../types";
import { checkColumnType, checkMappingTypes, formatAttributeType, formatColumnType, logicalTypeOf, physicalClass, type ColumnType } from "./type-check";

const attr = (data_type: AttributeType["data_type"], over: Partial<AttributeType> = {}): AttributeType => ({
  data_type,
  custom_type: null,
  type_length: null,
  type_precision: null,
  type_scale: null,
  ...over,
});
const col = (data_type: string, over: Partial<ColumnType> = {}): ColumnType => ({
  data_type,
  type_length: null,
  type_precision: null,
  type_scale: null,
  ...over,
});
const fits = (a: AttributeType, c: ColumnType) => checkColumnType(a, c).ok;

describe("type labels", () => {
  it("formats column and attribute types with their parameters", () => {
    expect(formatColumnType(col("varchar", { type_length: 255 }))).toBe("varchar(255)");
    expect(formatColumnType(col("decimal", { type_precision: 18, type_scale: 2 }))).toBe("decimal(18,2)");
    expect(formatColumnType(col("int"))).toBe("int");
    expect(formatAttributeType(attr("string", { type_length: 100 }))).toBe("string(100)");
    expect(formatAttributeType(attr("decimal", { type_precision: 18, type_scale: 2 }))).toBe("decimal(18,2)");
    expect(formatAttributeType(attr("custom", { custom_type: "uuid" }))).toBe("uuid");
  });

  it("classifies physical types case-insensitively, ignoring parameters", () => {
    expect(physicalClass("NVARCHAR(50)")).toBe("text");
    expect(physicalClass("datetime2")).toBe("temporal");
    expect(physicalClass("geography")).toBe("other");
  });
});

// The PRD's table, one row per attribute type: which column types fit and which do not.
const TABLE: [AttributeType, string[], string[]][] = [
  [attr("string"), ["varchar", "nvarchar", "char", "text", "uniqueidentifier"], ["int", "decimal", "date", "bit", "json"]],
  [attr("integer"), ["int", "bigint", "smallint", "tinyint"], ["varchar", "decimal", "bit", "date"]],
  [attr("decimal"), ["decimal", "numeric", "float", "money", "int", "bigint"], ["varchar", "date", "bit"]],
  [attr("date"), ["date", "datetime", "datetime2", "timestamp"], ["varchar", "int"]],
  [attr("datetime"), ["datetime", "datetime2", "date", "timestamptz"], ["varchar", "bigint"]],
  [attr("boolean"), ["bit", "boolean"], ["int", "varchar", "char"]],
  [attr("json"), ["json", "jsonb", "nvarchar", "text"], ["int", "date"]],
  [attr("custom", { custom_type: "geography" }), ["geography"], ["varchar", "geometry"]],
];

describe("type check table (D-01, AD-27)", () => {
  for (const [a, ok, bad] of TABLE) {
    it(`${formatAttributeType(a)} accepts ${ok.join(", ")} and refuses ${bad.join(", ")}`, () => {
      for (const t of ok) expect(fits(a, col(t)), t).toBe(true);
      for (const t of bad) expect(fits(a, col(t)), t).toBe(false);
    });
  }

  it("gives a short reason for a different type", () => {
    expect(checkColumnType(attr("integer"), col("varchar", { type_length: 20 }))).toEqual({
      ok: false,
      message: "varchar(20) does not fit integer. Add a transformation rule or change the attribute's data type.",
    });
  });
});

describe("string length", () => {
  it("refuses a longer column: varchar(255) into string(100) (S1A-09)", () => {
    expect(checkColumnType(attr("string", { type_length: 100 }), col("varchar", { type_length: 255 }))).toEqual({
      ok: false,
      message: "varchar(255) does not fit string(100): values can be longer than 100 characters.",
    });
  });

  it("accepts an equal or shorter column", () => {
    expect(checkColumnType(attr("string", { type_length: 100 }), col("varchar", { type_length: 100 }))).toEqual({
      ok: true,
      message: "varchar(100) fits string(100).",
    });
    expect(fits(attr("string", { type_length: 100 }), col("nvarchar", { type_length: 40 }))).toBe(true);
  });

  it("checks the length only when both have one", () => {
    expect(fits(attr("string"), col("varchar", { type_length: 4000 }))).toBe(true);
    expect(fits(attr("string", { type_length: 10 }), col("text"))).toBe(true);
  });
});

describe("decimal precision and scale", () => {
  const d18_2 = attr("decimal", { type_precision: 18, type_scale: 2 });

  it("accepts a column that fits in digits and decimal places", () => {
    expect(fits(d18_2, col("decimal", { type_precision: 18, type_scale: 2 }))).toBe(true);
    expect(fits(d18_2, col("numeric", { type_precision: 10, type_scale: 0 }))).toBe(true);
  });

  it("refuses more decimal places", () => {
    expect(checkColumnType(d18_2, col("decimal", { type_precision: 18, type_scale: 4 })).message).toBe(
      "decimal(18,4) does not fit decimal(18,2): it has more decimal places (4) than 2.",
    );
  });

  it("refuses more integer digits", () => {
    expect(checkColumnType(d18_2, col("decimal", { type_precision: 20, type_scale: 2 })).message).toBe(
      "decimal(20,2) does not fit decimal(18,2): it can hold larger numbers.",
    );
  });

  it("widens integers when the integer part is large enough", () => {
    expect(checkColumnType(d18_2, col("int"))).toEqual({ ok: true, message: "int widens to decimal(18,2) without loss." });
    expect(fits(attr("decimal", { type_precision: 5, type_scale: 2 }), col("int"))).toBe(false);
    expect(fits(attr("decimal", { type_precision: 12, type_scale: 2 }), col("int"))).toBe(true);
    expect(fits(attr("decimal", { type_precision: 12, type_scale: 2 }), col("bigint"))).toBe(false);
  });

  it("skips the checks when one side has no precision", () => {
    expect(fits(attr("decimal"), col("decimal", { type_precision: 38, type_scale: 10 }))).toBe(true);
    expect(fits(d18_2, col("float"))).toBe(true);
  });
});

describe("checkMappingTypes", () => {
  const s100 = attr("string", { type_length: 100 });
  const wide = { id: "c1", ...col("varchar", { type_length: 255 }) };
  const narrow = { id: "c2", ...col("varchar", { type_length: 50 }) };

  it("reports each input that does not fit", () => {
    expect(checkMappingTypes({ kind: "direct", rule_expression: null }, s100, [wide])).toEqual({
      ok: false,
      message: "varchar(255) does not fit string(100): values can be longer than 100 characters.",
      problems: [{ source_column_id: "c1", message: "varchar(255) does not fit string(100): values can be longer than 100 characters." }],
    });
  });

  it("never reports a transform with a rule (S1A-09)", () => {
    expect(checkMappingTypes({ kind: "transform", rule_expression: "LEFT(email, 100)" }, s100, [wide])).toEqual({
      ok: true,
      message: "The transformation rule handles the conversion.",
      problems: [],
    });
  });

  it("checks a transform without a rule like a direct mapping", () => {
    expect(checkMappingTypes({ kind: "transform", rule_expression: "  " }, s100, [wide]).ok).toBe(false);
  });

  it("summarises several inputs that all fit", () => {
    expect(checkMappingTypes({ kind: "direct", rule_expression: null }, s100, [narrow, { ...narrow, id: "c3" }]).message).toBe(
      "All inputs fit string(100).",
    );
  });
});

describe("logicalTypeOf: the type table in reverse (slice 1b, new attribute from a column)", () => {
  it("keeps the column's parameters", () => {
    expect(logicalTypeOf(col("varchar", { type_length: 100 }))).toEqual(attr("string", { type_length: 100 }));
    expect(logicalTypeOf(col("nvarchar"))).toEqual(attr("string"));
    expect(logicalTypeOf(col("decimal", { type_precision: 18, type_scale: 2 }))).toEqual(attr("decimal", { type_precision: 18, type_scale: 2 }));
    expect(logicalTypeOf(col("money"))).toEqual(attr("decimal"));
  });

  it("maps each class of the table", () => {
    expect(logicalTypeOf(col("bigint")).data_type).toBe("integer");
    expect(logicalTypeOf(col("date")).data_type).toBe("date");
    expect(logicalTypeOf(col("datetime2")).data_type).toBe("datetime");
    expect(logicalTypeOf(col("TIMESTAMP")).data_type).toBe("datetime");
    expect(logicalTypeOf(col("bit")).data_type).toBe("boolean");
    expect(logicalTypeOf(col("jsonb")).data_type).toBe("json");
    expect(logicalTypeOf(col("uniqueidentifier")).data_type).toBe("string");
  });

  it("makes anything unknown, and a time of day, a custom type with the physical name", () => {
    expect(logicalTypeOf(col("geography"))).toEqual(attr("custom", { custom_type: "geography" }));
    expect(logicalTypeOf(col("time"))).toEqual(attr("custom", { custom_type: "time" }));
  });

  it("always gives a type the column fits", () => {
    const columns = [
      col("varchar", { type_length: 255 }), col("char", { type_length: 2 }), col("int"), col("tinyint"),
      col("numeric", { type_precision: 10 }), col("decimal", { type_precision: 18, type_scale: 4 }), col("float"),
      col("date"), col("datetimeoffset"), col("time"), col("boolean"), col("json"), col("xml"), col("varbinary", { type_length: 16 }),
    ];
    for (const c of columns) expect(fits(logicalTypeOf(c), c), formatColumnType(c)).toBe(true);
  });
});
