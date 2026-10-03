import { describe, expect, it } from "vitest";
import { parseColumnLines } from "./column-lines";

const parsed = (text: string) => {
  const r = parseColumnLines(text);
  if (!r.ok) throw new Error(r.error.message);
  return r.columns;
};

describe("parseColumnLines (S1A-13)", () => {
  it("reads a name and a type per line, with lengths, precision and scale", () => {
    expect(parsed("cust_id int\nemail varchar(255)\namount DECIMAL(18, 2)\ncreated datetime2(7)\nnotes nvarchar(max)")).toEqual([
      { name: "cust_id", data_type: "int", type_length: null, type_precision: null, type_scale: null },
      { name: "email", data_type: "varchar", type_length: 255, type_precision: null, type_scale: null },
      { name: "amount", data_type: "decimal", type_length: null, type_precision: 18, type_scale: 2 },
      { name: "created", data_type: "datetime2", type_length: null, type_precision: 7, type_scale: null },
      { name: "notes", data_type: "nvarchar", type_length: null, type_precision: null, type_scale: null },
    ]);
  });

  it("skips blank lines, trailing commas and Windows line ends; accepts quoted names and two-word types", () => {
    expect(parsed('\r\n  "First Name" varchar(50),\r\n\r\n[Order Date] date,\nratio double precision\n')).toEqual([
      { name: "First Name", data_type: "varchar", type_length: 50, type_precision: null, type_scale: null },
      { name: "Order Date", data_type: "date", type_length: null, type_precision: null, type_scale: null },
      { name: "ratio", data_type: "double precision", type_length: null, type_precision: null, type_scale: null },
    ]);
  });

  it("names the line that cannot be read", () => {
    expect(parseColumnLines("cust_id int\nemail")).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "Line 2: write the column as a name and a type, e.g. email varchar(255)." },
    });
    expect(parseColumnLines("a varchar(")).toMatchObject({ ok: false });
  });

  it("refuses duplicate names, ignoring case", () => {
    expect(parseColumnLines("email varchar(10)\nEMAIL varchar(20)")).toMatchObject({
      ok: false,
      error: { message: "Line 2: there is already a column called EMAIL." },
    });
  });

  it("refuses impossible parameters", () => {
    expect(parseColumnLines("a varchar(0)")).toMatchObject({ ok: false, error: { message: "Line 1: a length or precision must be at least 1." } });
    expect(parseColumnLines("a decimal(2,5)")).toMatchObject({ ok: false, error: { message: "Line 1: the scale cannot be larger than the precision." } });
  });

  it("needs at least one column", () => {
    expect(parseColumnLines(" \n ")).toMatchObject({ ok: false, error: { message: "Add at least one column, e.g. cust_id int." } });
  });
});
