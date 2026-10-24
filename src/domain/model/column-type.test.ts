import { describe, expect, it } from "vitest";
import { readColumnType, readTypeParameter, sameColumnType } from "./column-type";
import { formatColumnType, MAX_LENGTH } from "./type-check";

const read = (text: string) => {
  const r = readColumnType(text);
  if (!r.ok) throw new Error(`${text}: ${r.reason}`);
  return r.type;
};
const t = (data_type: string, type_length: number | null = null, type_precision: number | null = null, type_scale: number | null = null) => ({
  data_type,
  type_length,
  type_precision,
  type_scale,
});

describe("readColumnType (slice 7a: one reader for New source table and the import)", () => {
  it("reads lengths for text types and precision for the others", () => {
    expect(read("varchar(255)")).toEqual(t("varchar", 255));
    expect(read("CHAR (3)")).toEqual(t("char", 3));
    expect(read("decimal( 18 , 2 )")).toEqual(t("decimal", null, 18, 2));
    expect(read("float(53)")).toEqual(t("float", null, 53));
    expect(read("int")).toEqual(t("int"));
    expect(read("double   precision")).toEqual(t("double precision"));
  });

  it("keeps fractional seconds as precision (step 1, answer 4)", () => {
    expect(read("datetime2(7)")).toEqual(t("datetime2", null, 7));
    expect(read("datetime2(3)")).not.toEqual(read("datetime2(7)"));
    expect(read("timestamp(3) without time zone")).toEqual(t("timestamp without time zone", null, 3));
    expect(read("TIMESTAMP (6) WITH TIME ZONE")).toEqual(t("timestamp with time zone", null, 6));
  });

  it("gives a type without parameters its default precision where the name tells the vendor (step 6)", () => {
    // SQL Server only: 7
    expect(read("datetime2")).toEqual(t("datetime2", null, 7));
    expect(read("DATETIMEOFFSET")).toEqual(t("datetimeoffset", null, 7));
    // PostgreSQL and Oracle agree: 6
    expect(read("timestamp")).toEqual(t("timestamp", null, 6));
    expect(read("timestamptz")).toEqual(t("timestamptz", null, 6));
    expect(read("timestamp without time zone")).toEqual(t("timestamp without time zone", null, 6));
    expect(read("timestamp with time zone")).toEqual(t("timestamp with time zone", null, 6));
    expect(read("timestamp with local time zone")).toEqual(t("timestamp with local time zone", null, 6));
    // a written precision stays as written
    expect(read("datetime2(3)")).toEqual(t("datetime2", null, 3));
    // fractional seconds may be 0, unlike a length or a number's precision
    expect(read("datetime2(0)")).toEqual(t("datetime2", null, 0));
    expect(read("timestamp(0)")).toEqual(t("timestamp", null, 0));
    expect(read("time(0)")).toEqual(t("time", null, 0));
  });

  it("leaves time without a default: SQL Server's is 7, PostgreSQL's 6, so time and time(7) differ (step 6)", () => {
    expect(read("time")).toEqual(t("time"));
    expect(read("time without time zone")).toEqual(t("time without time zone"));
    expect(sameColumnType(read("time"), read("time(7)"))).toBe(false);
    expect(sameColumnType(read("time"), read("time(6)"))).toBe(false);
  });

  it("compares a type stored without its default precision as the same type (step 6)", () => {
    const stored = t("datetime2"); // typed by hand or seeded before step 6
    expect(sameColumnType(stored, read("datetime2(7)"))).toBe(true);
    expect(sameColumnType(stored, read("datetime2(3)"))).toBe(false);
    expect(sameColumnType(t("timestamp with time zone"), read("timestamptz(6)"))).toBe(true);
    expect(formatColumnType(read("datetime2"))).toBe("datetime2(7)");
  });

  it("stores max and -1 as MAX_LENGTH and shows max, never -1 (answer 3)", () => {
    expect(read("nvarchar(max)")).toEqual(t("nvarchar", MAX_LENGTH));
    expect(read("varbinary(-1)")).toEqual(t("varbinary", MAX_LENGTH));
    expect(formatColumnType(read("nvarchar(MAX)"))).toBe("nvarchar(max)");
    expect(formatColumnType(read("varbinary(-1)"))).toBe("varbinary(max)");
  });

  it("reads Oracle's length units and number", () => {
    expect(read("VARCHAR2(100 CHAR)")).toEqual(t("varchar2", 100));
    expect(read("varchar2(50 byte)")).toEqual(t("varchar2", 50));
    expect(read("NUMBER(10,0)")).toEqual(t("number", null, 10, 0));
    expect(read("number")).toEqual(t("number"));
  });

  it("gives the same result for the same type written differently, so nothing false shows as a change", () => {
    for (const [a, b] of [["VARCHAR(20)", "varchar (20)"], ["Decimal(12, 2)", "decimal(12,2)"], ["NVARCHAR(MAX)", "nvarchar(-1)"]] as const) {
      expect(read(a)).toEqual(read(b));
    }
  });

  it("formats back to what it read", () => {
    for (const text of ["varchar(255)", "decimal(18,2)", "datetime2(7)", "nvarchar(max)", "timestamp(6) with time zone", "number(10,0)", "int"]) {
      expect(formatColumnType(read(text))).toBe(text);
    }
  });

  it("refuses what is not a type, a zero length or precision, and a scale above the precision", () => {
    expect(readColumnType("this is not (")).toEqual({ ok: false, reason: "unreadable" });
    expect(readColumnType("varchar(max, 2)")).toEqual({ ok: false, reason: "unreadable" });
    expect(readColumnType("decimal(1,2,3)")).toEqual({ ok: false, reason: "unreadable" });
    expect(readColumnType("integer[]")).toEqual({ ok: false, reason: "unreadable" });
    expect(readColumnType("varchar(0)")).toEqual({ ok: false, reason: "zero" });
    expect(readColumnType("decimal(0)")).toEqual({ ok: false, reason: "zero" });
    expect(readColumnType("decimal(2,5)")).toEqual({ ok: false, reason: "scale" });
  });
});

describe("readTypeParameter (the standard's length, precision and scale columns)", () => {
  it("reads numbers, max and -1 for a length, and nothing when empty", () => {
    expect(readTypeParameter("20", "length")).toBe(20);
    expect(readTypeParameter("MAX", "length")).toBe(MAX_LENGTH);
    expect(readTypeParameter("-1", "length")).toBe(MAX_LENGTH);
    expect(readTypeParameter(" ", "precision")).toBeNull();
    expect(readTypeParameter("0", "scale")).toBe(0);
    expect(readTypeParameter("0", "fractional seconds")).toBe(0);
  });

  it("refuses what is not one", () => {
    expect(readTypeParameter("max", "precision")).toBeUndefined();
    expect(readTypeParameter("0", "length")).toBeUndefined();
    expect(readTypeParameter("0", "precision")).toBeUndefined();
    expect(readTypeParameter("abc", "scale")).toBeUndefined();
  });
});
