// Slice 21 (R6, D-76): "column left the source" as a requirement gap's reason, logical level only, before a type
// conflict; the counts are unchanged (D-31 already counts no coverage from such a mapping).

import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, sourceColumn, sourceTable } from "../__fixtures__/domain";
import type { Mapping, SourceColumn } from "../types";
import { GAP_REASONS, lookupModel, type ScopeModel } from "./requirements";

const T = "2026-11-09T10:00:00.000Z";
const approved = (over: Partial<Mapping> = {}) => mapping({ status: "approved", approved_at: T, approved_by: ids.someoneElse, ...over });

/** Customer.email mapped from crm.email; `column` changes the input column, `m` the mapping. */
function model(column: Partial<SourceColumn> = {}, m: Partial<Mapping> = {}, emailType?: string): ScopeModel {
  return {
    entities: [entity(ids.customer)],
    attributes: [attribute(ids.email, emailType ? { data_type: emailType as never } : {})],
    mappings: [approved(m)],
    mappingInputs: [mappingInput()],
    sourceTables: [sourceTable()],
    sourceColumns: [sourceColumn(ids.colEmail, column)],
  };
}

describe("column left the source (slice 21, R6)", () => {
  it("names an approved mapping from a missing column", () => {
    const lookup = lookupModel(model({ missing_since: T }));
    expect(lookup.coverageOf(ids.email)).toBe("not_approved");
    expect(lookup.gapReason(ids.email)).toBe("column_left");
    expect(GAP_REASONS.column_left).toBe("column left the source");
  });

  it("names a retired column (a retired column is always missing too, slice 7b)", () => {
    const lookup = lookupModel(model({ missing_since: T, retired_since: T }));
    expect(lookup.coverageOf(ids.email)).toBe("not_approved");
    expect(lookup.gapReason(ids.email)).toBe("column_left");
  });

  it("comes before a type conflict", () => {
    const conflict = model({}, {}, "integer");
    expect(lookupModel(conflict).gapReason(ids.email)).toBe("type_conflict");
    expect(lookupModel(model({ missing_since: T }, {}, "integer")).gapReason(ids.email)).toBe("column_left");
  });

  it("leaves a draft mapping from a missing column 'not approved' and a present column covered", () => {
    expect(lookupModel(model({ missing_since: T }, { status: "draft", approved_at: null, approved_by: null })).gapReason(ids.email)).toBeNull();
    const present = lookupModel(model());
    expect(present.coverageOf(ids.email)).toBe("covered");
    expect(present.gapReason(ids.email)).toBeNull();
  });

  it("is not a dimensional attribute's reason", () => {
    const m = model({ missing_since: T });
    const dim: ScopeModel = { ...m, entities: [entity(ids.customer, { model_level: "dimensional" })] };
    // a dimensional attribute is fed, never mapped from a column (AD-36); its reasons stay the feeds'
    expect(lookupModel(dim).gapReason(ids.email)).not.toBe("column_left");
  });
});
