// The review's counts and filters (slice 7a; slice 7c, answers to step 5: "The file says …" rows are shown, not counted).
import { describe, expect, it } from "vitest";
import { emptyModel, importInto, systemNamed } from "@/domain/__fixtures__/import";
import { readStandard } from "@/domain/import/standard";
import { nothingText, reviewCounts, shownUnder } from "./wizard-model";

const HEAD = "database,schema,table,column,ordinal,data_type,nullable,primary_key,fk_name,fk_ref_schema,fk_ref_table,fk_ref_column,classifications";
const file = (b: string) => readStandard(`${HEAD}\nd,s,t,a,1,int,no,yes,,,,,BK\nd,s,t,b,2,int,yes,no,,,,,${b}`, "t.csv");

describe("a re-import that differs only in classifications", () => {
  it("shows the column under all changes, and counts nothing on any filter", () => {
    const { model } = importInto(emptyModel(), file("PII"), { newName: "S" });
    const { plan } = importInto(model, file("TECH"), { systemId: systemNamed(model, "S").id });
    const b = plan.tables[0]!.columns.find((c) => c.existing?.name === "b")!;
    expect(b.fileClassifications).toEqual(["Technical / audit"]);
    expect(reviewCounts(plan)).toEqual({ tablesNew: 0, new: 0, changed: 0, rename: 0, missing: 0, rel: 0, all: 0 });
    expect(shownUnder("all", b)).toBe(true);
    expect((["new", "changed", "rename", "missing", "rel"] as const).filter((f) => shownUnder(f, b))).toEqual([]);
  });
});

describe("the callout when nothing changes (answers to step 6)", () => {
  it("names the classifications only when the file says other ones", () => {
    expect(nothingText("CRM", false)).toBe("The file matches what CRM has. Importing only records the import and updates row counts.");
    expect(nothingText("CRM", true)).toBe("The file matches what CRM has, apart from classifications, which stay yours. Importing only records the import and updates row counts.");
  });
});
