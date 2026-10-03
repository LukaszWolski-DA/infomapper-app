import { describe, expect, it } from "vitest";
import { access, archived, attribute, ids, makeCtx, mapping, mappingInput, NOW, sourceColumn } from "../__fixtures__/domain";
import { FOUR_EYES_MESSAGE } from "../model/mapping-rules";
import type { WorkspaceRole } from "../types";
import {
  addMappingInput,
  createMapping,
  deleteMapping,
  removeMappingInput,
  reorderMappingInputs,
  setMappingStatus,
  updateMapping,
} from "./mapping";

const { email, colEmail, colFirstName, colCustId, mapEmail, inEmail } = ids;
const in2 = "01900000-0000-7000-8000-00000000b002";
const ref = { mappingId: mapEmail, expectedVersion: 1 };

describe("createMapping (attribute panel, “Add a source column”)", () => {
  const state = { attribute: attribute(email), column: sourceColumn(colFirstName), mappings: [mapping()], mappingInputs: [mappingInput()] };

  it("creates a direct draft mapping with one input, in one change group", () => {
    const r = createMapping(makeCtx(), access("modeler"), state, { attributeId: email, sourceColumnId: colFirstName });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "mapping", row: { id: r.value.mappingId, attribute_id: email, kind: "direct", status: "draft", rule_expression: null, approved_at: null } },
      { kind: "insert", table: "mapping_input", row: { mapping_id: r.value.mappingId, source_column_id: colFirstName, sort_order: 0 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("refuses the same column into the same attribute twice", () => {
    expect(createMapping(makeCtx(), access("owner"), { ...state, column: sourceColumn(colEmail) }, { attributeId: email, sourceColumnId: colEmail })).toMatchObject({
      ok: false,
      error: { code: "conflict", message: "That mapping already exists." },
    });
  });

  it("allows it again after the first mapping was deleted", () => {
    const s = { ...state, column: sourceColumn(colEmail), mappings: [mapping({ deleted_at: NOW })], mappingInputs: [mappingInput(inEmail, { deleted_at: NOW })] };
    expect(createMapping(makeCtx(), access("owner"), s, { attributeId: email, sourceColumnId: colEmail }).ok).toBe(true);
  });

  it("refuses an unknown attribute or column, reviewers and an archived workspace", () => {
    expect(createMapping(makeCtx(), access("owner"), { ...state, attribute: null }, { attributeId: email, sourceColumnId: colFirstName })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createMapping(makeCtx(), access("owner"), { ...state, column: null }, { attributeId: email, sourceColumnId: colFirstName })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createMapping(makeCtx(), access("reviewer"), state, { attributeId: email, sourceColumnId: colFirstName })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createMapping(makeCtx(), access("owner", archived), state, { attributeId: email, sourceColumnId: colFirstName })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("updateMapping: kind, rule, note", () => {
  const one = { mapping: mapping(), inputs: [mappingInput()] };
  const two = { mapping: mapping({ kind: "transform", rule_expression: "CONCAT(a, b)" }), inputs: [mappingInput(), mappingInput(in2, { source_column_id: colFirstName, sort_order: 1 })] };

  it("turns a direct copy into a transform with a rule", () => {
    const r = updateMapping(makeCtx(), access("modeler"), one, { ...ref, kind: "transform", ruleExpression: "  LOWER(email)  " });
    expect(r).toMatchObject({ ok: true, value: { mapping: { kind: "transform", rule_expression: "LOWER(email)", version: 2 } } });
  });

  it("refuses a transform without a rule", () => {
    expect(updateMapping(makeCtx(), access("owner"), one, { ...ref, kind: "transform" })).toMatchObject({ ok: false, error: { message: "A transformation needs a rule." } });
    expect(updateMapping(makeCtx(), access("owner"), two, { ...ref, ruleExpression: " " })).toMatchObject({
      ok: false,
      error: { message: "A mapping with more than one input needs a transformation rule." },
    });
  });

  it("refuses switching a mapping with several inputs back to direct (D-49)", () => {
    expect(updateMapping(makeCtx(), access("owner"), two, { ...ref, kind: "direct" })).toMatchObject({
      ok: false,
      error: { message: "A direct copy reads exactly one column. With more inputs it is a transformation." },
    });
  });

  it("switches a one-input transform back to direct, keeping the rule text", () => {
    const s = { mapping: mapping({ kind: "transform", rule_expression: "TRIM(email)" }), inputs: [mappingInput()] };
    expect(updateMapping(makeCtx(), access("owner"), s, { ...ref, kind: "direct" })).toMatchObject({ ok: true, value: { mapping: { kind: "direct", rule_expression: "TRIM(email)" } } });
  });

  it("stores the note as plain text (AD-30)", () => {
    const r = updateMapping(makeCtx(), access("owner"), one, { ...ref, note: "Ask CRM <team>" });
    expect(r).toMatchObject({ ok: true, value: { mapping: { note_text: "Ask CRM <team>", note_html: "<p>Ask CRM &lt;team&gt;</p>" } } });
  });

  it("refuses reviewers: they may change the status only (AD-05)", () => {
    expect(updateMapping(makeCtx(), access("reviewer"), one, { ...ref, note: "x" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("refuses a stale version and an empty change", () => {
    expect(updateMapping(makeCtx(), access("owner"), one, { mappingId: mapEmail, expectedVersion: 7, note: "x" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(updateMapping(makeCtx(), access("owner"), one, { ...ref, kind: "direct" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("mapping inputs (D-49, S1A-08)", () => {
  const one = { mapping: mapping(), inputs: [mappingInput()], column: sourceColumn(colFirstName) };

  it("does not save a second input without a rule", () => {
    expect(addMappingInput(makeCtx(), access("modeler"), one, { ...ref, sourceColumnId: colFirstName })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "A mapping with more than one input needs a transformation rule." },
    });
  });

  it("with a rule, the second input turns the mapping into a transform", () => {
    const r = addMappingInput(makeCtx(), access("modeler"), one, { ...ref, sourceColumnId: colFirstName, ruleExpression: "CONCAT(first_name, ' ', email)" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.mapping).toMatchObject({ kind: "transform", rule_expression: "CONCAT(first_name, ' ', email)", version: 2 });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "update", table: "mapping" },
      { kind: "insert", table: "mapping_input", row: { id: r.value.mappingInputId, source_column_id: colFirstName, sort_order: 1 } },
    ]);
  });

  it("uses the rule the mapping already has", () => {
    const s = { ...one, mapping: mapping({ kind: "transform", rule_expression: "x" }) };
    expect(addMappingInput(makeCtx(), access("owner"), s, { ...ref, sourceColumnId: colFirstName })).toMatchObject({ ok: true, value: { mapping: { kind: "transform", rule_expression: "x" } } });
  });

  it("refuses a column that is already an input, and an unknown column", () => {
    expect(addMappingInput(makeCtx(), access("owner"), { ...one, column: sourceColumn(colEmail) }, { ...ref, sourceColumnId: colEmail, ruleExpression: "x" })).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(addMappingInput(makeCtx(), access("owner"), { ...one, column: null }, { ...ref, sourceColumnId: colFirstName, ruleExpression: "x" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  const two = {
    mapping: mapping({ kind: "transform", rule_expression: "CONCAT(a, b)" }),
    inputs: [mappingInput(), mappingInput(in2, { source_column_id: colFirstName, sort_order: 1 })],
  };

  it("removing down to one input keeps a transform until the user switches it back", () => {
    const r = removeMappingInput(makeCtx(), access("modeler"), two, { ...ref, mappingInputId: in2 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.mapping).toMatchObject({ kind: "transform", rule_expression: "CONCAT(a, b)", version: 2 });
    expect(r.writeSet.writes[1]).toMatchObject({ table: "mapping_input", row: { id: in2, deleted_at: NOW } });
  });

  it("does not remove the last input", () => {
    expect(removeMappingInput(makeCtx(), access("owner"), { mapping: mapping(), inputs: [mappingInput()] }, { ...ref, mappingInputId: inEmail })).toMatchObject({
      ok: false,
      error: { message: "A mapping reads at least one column. Delete the mapping instead." },
    });
  });

  it("refuses an input of another mapping", () => {
    const foreign = mappingInput(in2, { mapping_id: ids.org });
    expect(removeMappingInput(makeCtx(), access("owner"), { ...two, inputs: [mappingInput(), foreign] }, { ...ref, mappingInputId: in2 })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("reorders the inputs", () => {
    const r = reorderMappingInputs(makeCtx(), access("modeler"), two, { ...ref, mappingInputIds: [in2, inEmail] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { table: "mapping", row: { version: 2 } },
      { table: "mapping_input", row: { id: in2, sort_order: 0 } },
      { table: "mapping_input", row: { id: inEmail, sort_order: 1 } },
    ]);
  });

  it("refuses an order that does not list every input once", () => {
    for (const order of [[in2], [in2, in2], [in2, colCustId]]) {
      expect(reorderMappingInputs(makeCtx(), access("owner"), two, { ...ref, mappingInputIds: order })).toMatchObject({ ok: false, error: { code: "invalid" } });
    }
    expect(reorderMappingInputs(makeCtx(), access("owner"), two, { ...ref, mappingInputIds: [inEmail, in2] })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("setMappingStatus (AD-05, AD-06)", () => {
  const state = { mapping: mapping({ status: "review" }), contentAuthorId: ids.someoneElse };

  it("approves and records who and when", () => {
    const r = setMappingStatus(makeCtx(), access("reviewer"), state, { ...ref, status: "approved" });
    expect(r).toMatchObject({ ok: true, value: { mapping: { status: "approved", approved_by: ids.actor, approved_at: NOW, version: 2 } } });
    expect(r.ok && r.writeSet.events).toMatchObject([{ object_type: "mapping", before_image: { status: "review" }, after_image: { status: "approved" } }]);
  });

  it("clears the approval when the status goes back", () => {
    const s = { ...state, mapping: mapping({ status: "approved", approved_by: ids.someoneElse, approved_at: NOW }) };
    expect(setMappingStatus(makeCtx(), access("modeler"), s, { ...ref, status: "review" })).toMatchObject({
      ok: true,
      value: { mapping: { status: "review", approved_by: null, approved_at: null } },
    });
  });

  it("may be done by every role but readers (S1A-11)", () => {
    const allowed: WorkspaceRole[] = ["owner", "admin", "modeler", "reviewer"];
    for (const role of allowed) expect(setMappingStatus(makeCtx(), access(role), state, { ...ref, status: "draft" }).ok, role).toBe(true);
    expect(setMappingStatus(makeCtx(), access("reader"), state, { ...ref, status: "draft" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(setMappingStatus(makeCtx(), access("reviewer", archived), state, { ...ref, status: "draft" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("four-eyes on: the content author cannot approve; another person can (S1A-12)", () => {
    const fourEyes = { four_eyes: true };
    const mine = { ...state, contentAuthorId: ids.actor };
    expect(setMappingStatus(makeCtx(), access("modeler", fourEyes), mine, { ...ref, status: "approved" })).toEqual({
      ok: false,
      error: { code: "forbidden", message: FOUR_EYES_MESSAGE },
    });
    expect(setMappingStatus(makeCtx(ids.someoneElse), access("modeler", fourEyes), mine, { ...ref, status: "approved" }).ok).toBe(true);
    // The author may still move it between draft and review.
    expect(setMappingStatus(makeCtx(), access("modeler", fourEyes), mine, { ...ref, status: "draft" }).ok).toBe(true);
  });

  it("four-eyes off: the author may approve", () => {
    expect(setMappingStatus(makeCtx(), access("modeler"), { ...state, contentAuthorId: ids.actor }, { ...ref, status: "approved" }).ok).toBe(true);
  });

  it("refuses an unknown status, the same status and a stale version", () => {
    expect(setMappingStatus(makeCtx(), access("owner"), state, { ...ref, status: "done" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(setMappingStatus(makeCtx(), access("owner"), state, { ...ref, status: "review" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(setMappingStatus(makeCtx(), access("owner"), state, { mappingId: mapEmail, expectedVersion: 2, status: "approved" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});

describe("deleteMapping", () => {
  it("soft-deletes the mapping and its inputs", () => {
    const r = deleteMapping(makeCtx(), access("modeler"), { mapping: mapping(), inputs: [mappingInput(), mappingInput(in2, { deleted_at: NOW })] }, ref);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { table: "mapping_input", row: { id: inEmail, deleted_at: NOW } },
      { table: "mapping", row: { id: mapEmail, deleted_at: NOW } },
    ]);
  });

  it("is refused to reviewers", () => {
    expect(deleteMapping(makeCtx(), access("reviewer"), { mapping: mapping(), inputs: [] }, ref)).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});
