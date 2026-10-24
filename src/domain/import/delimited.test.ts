import { describe, expect, it } from "vitest";
import { detectDelimiter, parseDelimited, toCsv } from "./delimited";

const cells = (text: string) => parseDelimited(text).rows.map((r) => r.cells);

describe("parseDelimited (S7A-01)", () => {
  it("takes the delimiter from the first line, outside quotes; a comma on a tie", () => {
    expect(detectDelimiter("a,b,c\n1;2;3;4")).toBe(",");
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a;b;c",d')).toBe(",");
    expect(detectDelimiter("a,b;c")).toBe(",");
    expect(detectDelimiter("single")).toBe(",");
  });

  it("reads quoted fields with delimiters, doubled quotes and line breaks inside", () => {
    expect(cells('a,b\n"x, y","say ""hi"""\n"two\nlines",z')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["two\nlines", "z"],
    ]);
  });

  it("accepts \\n, \\r\\n and \\r line ends, drops blank rows and keeps each row's line", () => {
    const { rows } = parseDelimited("h1;h2\r\n\r\n1;2\r3;4\n\n;\n5;6\n");
    expect(rows).toEqual([
      { cells: ["h1", "h2"], line: 1 },
      { cells: ["1", "2"], line: 3 },
      { cells: ["3", "4"], line: 4 },
      { cells: ["5", "6"], line: 7 },
    ]);
  });

  it("counts the lines inside a quoted field for the rows after it", () => {
    expect(parseDelimited('a\n"1\n2\n3"\nb').rows.map((r) => r.line)).toEqual([1, 2, 5]);
  });

  it("keeps empty fields, also at the end of a row", () => {
    expect(cells("a,,c,\n,,,")).toEqual([["a", "", "c", ""]]);
  });
});

describe("toCsv", () => {
  it("quotes only what needs it and reads back the same", () => {
    const rows = [["a", "b,c", 'd"e', "f;g", "h\ni", 3, null]];
    const csv = toCsv(rows);
    expect(csv).toBe('a,"b,c","d""e","f;g","h\ni",3,');
    expect(cells(csv)).toEqual([["a", "b,c", 'd"e', "f;g", "h\ni", "3", ""]]);
  });
});
