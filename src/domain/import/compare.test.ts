import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allOf, columnNamed, editColumn, emptyModel, importInto, systemNamed, withEntity, withMapping } from "../__fixtures__/import";
import { keptChoices, planDigest, samePlan, STALE_REVIEW } from "./compare";
import { buildPlan } from "./plan";
import { readStandard } from "./standard";

const sample = (name: string) => readFileSync(new URL(`./samples/${name}`, import.meta.url), "utf8");
const crm = readStandard(sample("crm_sqlserver_catalog.tsv"), "crm.tsv");
const changed = readStandard(sample("crm_snapshot_2026-10-20.csv"), "crm_snapshot.csv");

function setUp() {
  const { model } = importInto(emptyModel(), crm, { newName: "CRM" });
  const other = importInto(model, readStandard(sample("hr_snapshot_2026-10-20.csv"), "hr.csv"), { newName: "HR" }).model;
  const target = { systemId: systemNamed(other, "CRM").id };
  return { model: other, target, shown: planDigest(buildPlan(other, changed, target, allOf(changed))) };
}

describe("P8: the plan rebuilt on the server against the one the review showed (step 1, answer 12)", () => {
  it("the same model, file and choices give the same plan", () => {
    const { model, target, shown } = setUp();
    expect(samePlan(shown, buildPlan(model, changed, target, allOf(changed)))).toBe(true);
  });

  it("an edit elsewhere (another system's column) does not make it stale", () => {
    const { model, target, shown } = setUp();
    const hrColumn = model.columns.find((c) => c.name === "emp_no")!;
    expect(samePlan(shown, buildPlan(editColumn(model, hrColumn.id, { comment: "Typed elsewhere" }), changed, target, allOf(changed)))).toBe(true);
  });

  it("an edit to a column the import reads makes it stale", () => {
    const { model, target, shown } = setUp();
    const custNo = columnNamed(model, "customers", "cust_no");
    expect(samePlan(shown, buildPlan(editColumn(model, custNo.id, { comment: "Typed meanwhile" }), changed, target, allOf(changed)))).toBe(false);
  });

  it("a mapping made meanwhile on a column the import changes makes it stale", () => {
    const { model, target, shown } = setUp();
    let m = withEntity(model, "Customer", [{ name: "email", type_length: 120 }]);
    m = withMapping(m, m.attributes.at(-1)!.id, [columnNamed(m, "customers", "email_addr").id]).model;
    expect(samePlan(shown, buildPlan(m, changed, target, allOf(changed)))).toBe(false);
  });

  it("another import of the system meanwhile makes it stale", () => {
    const { model, target, shown } = setUp();
    const after = importInto(model, changed, target).model;
    expect(samePlan(shown, buildPlan(after, changed, target, allOf(changed)))).toBe(false);
  });

  it("says so in P8's words", () => {
    expect(STALE_REVIEW("CRM")).toBe("CRM changed since you opened this review. The review now shows the current state; check it and import again.");
  });
});

describe("what a refreshed review keeps (P8)", () => {
  it("keeps the scope, the compare choice and the rename choices that still apply", () => {
    const { model, target } = setUp();
    const choices = allOf(changed, {
      compare: "tables",
      scope: new Set(["crmprod|dbo|customers"]),
      renames: new Map([
        ["crmprod|dbo|customers|created_ts", "created_on"],
        ["crmprod|dbo|customers|dob", ""],
        ["crmprod|dbo|customers|gone_meanwhile", "consent_flag"],
      ]),
    });
    const kept = keptChoices(choices, buildPlan(model, changed, target, choices));
    expect(kept.scope).toBe(choices.scope);
    expect(kept.compare).toBe("tables");
    expect([...kept.renames]).toEqual([
      ["crmprod|dbo|customers|created_ts", "created_on"],
      ["crmprod|dbo|customers|dob", ""],
    ]);
  });

  it("drops a rename whose new column is no longer offered", () => {
    const { model, target } = setUp();
    const choices = allOf(changed, { renames: new Map([["crmprod|dbo|customers|created_ts", "no_such_column"]]) });
    expect([...keptChoices(choices, buildPlan(model, changed, target, choices)).renames]).toEqual([]);
  });
});
