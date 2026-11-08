// Slice 18 (item 2, D-73; acceptance F2, F11): requirement coverage and scope through calculations, at both levels.

import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, requirement, requirementLink, sourceColumn, sourceTable } from "../__fixtures__/domain";
import type { AttributeInput } from "../types";
import { buildRequirementIndex } from "./requirement-index";
import { GAP_REASONS, lookupModel, requirementCoverage, requirementScope, type AttributeFeeds, type ScopeModel } from "./requirements";
import { coverageDelta } from "../source-changes/coverage";

const first = "01900000-0000-7000-8000-0000000052a1";
const full = "01900000-0000-7000-8000-0000000052a2";
const label = "01900000-0000-7000-8000-0000000052a3";
const mapFirst = "01900000-0000-7000-8000-0000000052b1";
const inFirst = "01900000-0000-7000-8000-0000000052c1";
const T = "2026-11-08T10:00:00.000Z";

const input = (attribute_id: string, input_attribute_id: string, sort_order: number, id: string): AttributeInput => ({
  id,
  workspace_id: ids.ws,
  attribute_id,
  input_attribute_id,
  sort_order,
  version: 1,
  created_at: T,
  created_by: ids.actor,
  updated_at: T,
  updated_by: ids.actor,
  deleted_at: null,
});

/** Customer: email (approved from crm.email), first_name (approved from crm.first_name), full_name = email + first_name; label = full_name. */
function model(over: { firstStatus?: "approved" | "draft"; noInputs?: boolean } = {}): ScopeModel {
  return {
    entities: [entity(ids.customer)],
    attributes: [
      attribute(ids.email),
      attribute(first, { name: "first_name", data_type: "string", type_length: 50, is_primary_key: false, is_nullable: true }),
      attribute(full, { name: "full_name", is_primary_key: false, is_calculated: true, calc_rule: "first_name || email" }),
      attribute(label, { name: "label", is_primary_key: false, is_calculated: true, calc_rule: "upper(full_name)" }),
    ],
    mappings: [
      mapping({ status: "approved", approved_at: T, approved_by: ids.someoneElse }),
      mapping({ id: mapFirst, attribute_id: first, status: over.firstStatus ?? "approved", approved_at: over.firstStatus === "draft" ? null : T, approved_by: ids.someoneElse }),
    ],
    mappingInputs: [mappingInput(), mappingInput(inFirst, { mapping_id: mapFirst, source_column_id: ids.colFirstName })],
    attributeInputs: over.noInputs
      ? []
      : [
          input(full, first, 0, "01900000-0000-7000-8000-0000000052d1"),
          input(full, ids.email, 1, "01900000-0000-7000-8000-0000000052d2"),
          input(label, full, 0, "01900000-0000-7000-8000-0000000052d3"),
        ],
    sourceTables: [sourceTable()],
    sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  };
}
const linkTo = (attributeId: string) => [requirementLink(ids.reqLink1, { attribute_id: attributeId })];

describe("coverage through a calculation (slice 18, D-73)", () => {
  it("covers a calculated attribute when every input is covered, at any depth", () => {
    expect(lookupModel(model()).coverageOf(full)).toBe("covered");
    expect(lookupModel(model()).coverageOf(label)).toBe("covered");
    expect(requirementCoverage(ids.req101, linkTo(label), model()).done).toBe(true);
  });

  it("does not when an input is not covered, with the reason", () => {
    const m = model({ firstStatus: "draft" });
    const lookup = lookupModel(m);
    expect(lookup.coverageOf(full)).toBe("not_approved");
    expect(lookup.gapReason(full)).toBe("calculation");
    expect(GAP_REASONS.calculation).toBe("an input of its calculation is not covered");
    expect(requirementCoverage(ids.req101, linkTo(full), m)).toMatchObject({ done: false, notApproved: [full] });
  });

  it("a calculated attribute without inputs is not mapped; without attributeInputs nothing is calculated", () => {
    expect(lookupModel(model({ noInputs: true })).coverageOf(full)).toBe("not_mapped");
    const { attributeInputs, ...without } = model();
    expect(attributeInputs?.length).toBe(3);
    expect(lookupModel(without).coverageOf(full)).toBe("not_mapped");
  });

  it("a cycle counts as not covered and does not loop", () => {
    const m = model();
    const cyc: ScopeModel = { ...m, attributeInputs: [...m.attributeInputs!, input(full, label, 2, "01900000-0000-7000-8000-0000000052d4")] };
    expect(lookupModel(cyc).coverageOf(label)).not.toBe("covered");
  });

  it("brings a calculation's inputs into the scope, at any depth, as inputs and not items", () => {
    const scope = requirementScope(ids.req101, linkTo(label), model());
    expect([...scope.attributeItems]).toEqual([label]);
    expect([...(scope.inputs ?? [])].sort()).toEqual([ids.email, first, full].sort());
    expect(scope.attributes.has(first)).toBe(true);
    // a requirement without a calculation has no `inputs`
    expect(requirementScope(ids.req101, linkTo(ids.email), model()).inputs).toBeUndefined();
  });

  it("at the dimensional level: a fact's attribute calculated from fed attributes is covered", () => {
    const fact = "01900000-0000-7000-8000-0000000052e1";
    const amount = "01900000-0000-7000-8000-0000000052e2";
    const net = "01900000-0000-7000-8000-0000000052e3";
    const m = model();
    const dim: ScopeModel = {
      ...m,
      entities: [...m.entities, entity(fact, { name: "Fact Sales", model_level: "dimensional" })],
      attributes: [...m.attributes, attribute(amount, { entity_id: fact, name: "amount", is_primary_key: false }), attribute(net, { entity_id: fact, name: "net", is_primary_key: false, is_calculated: true })],
      attributeInputs: [...m.attributeInputs!, input(net, amount, 0, "01900000-0000-7000-8000-0000000052d5")],
    };
    const feeds: AttributeFeeds = { [amount]: [{ id: "01900000-0000-7000-8000-0000000052f1", approved: true, typeConflict: false, inputs: [ids.email] }] };
    expect(lookupModel(dim, feeds).coverageOf(net)).toBe("covered");
    // a feed whose logical input is calculated counts through that calculation (P2)
    const viaCalc: AttributeFeeds = { [amount]: [{ id: "01900000-0000-7000-8000-0000000052f1", approved: true, typeConflict: false, inputs: [full] }] };
    expect(lookupModel(dim, viaCalc).coverageOf(net)).toBe("covered");
    const index = buildRequirementIndex([], [], dim, viaCalc);
    expect(index.attributeCoverage(amount)).toBe("covered");
  });

  it("names an input's mapping when a calculated attribute loses its coverage (coverageDelta)", () => {
    const req = requirement(ids.req101);
    const before = model();
    const after: ScopeModel = { ...before, mappings: before.mappings.map((x) => (x.id === mapFirst ? { ...x, status: "review" as const, approved_at: null } : x)) };
    const [delta] = coverageDelta([req], linkTo(full), before, after);
    expect(delta).toMatchObject({ before: { covered: 1 }, after: { covered: 0 }, why: ["first_name: mapping back to review"] });
  });
});
