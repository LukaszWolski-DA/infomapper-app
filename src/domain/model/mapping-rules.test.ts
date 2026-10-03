import { describe, expect, it } from "vitest";
import { attribute, changeEvent, ids, mapping, mappingInput, sourceColumn, workspace } from "../__fixtures__/domain";
import { checkFourEyes, checkMappingShape, FOUR_EYES_MESSAGE, lastContentEditor, suggestsBusinessKey } from "./mapping-rules";

const NOW_LATER = "2026-10-02T09:00:00.000Z";

describe("mapping inputs (AD-26, D-49)", () => {
  it("accepts a direct mapping with exactly one input", () => {
    expect(checkMappingShape("direct", null, 1)).toBeNull();
  });

  it("refuses a direct mapping with more than one input", () => {
    expect(checkMappingShape("direct", null, 2)?.message).toBe(
      "A direct copy reads exactly one column. With more inputs it is a transformation.",
    );
  });

  it("refuses a mapping without inputs", () => {
    expect(checkMappingShape("transform", "x", 0)?.code).toBe("invalid");
    expect(checkMappingShape("direct", null, 0)?.code).toBe("invalid");
  });

  it("needs a rule for a transform, with a message for several inputs", () => {
    expect(checkMappingShape("transform", " ", 1)?.message).toBe("A transformation needs a rule.");
    expect(checkMappingShape("transform", null, 2)?.message).toBe("A mapping with more than one input needs a transformation rule.");
    expect(checkMappingShape("transform", "CONCAT(a, b)", 2)).toBeNull();
    expect(checkMappingShape("transform", "CAST(x AS date)", 1)).toBeNull();
  });
});

describe("lastContentEditor (AD-06)", () => {
  const m = mapping({ created_by: ids.someoneElse });

  it("is the creator when the log has nothing about the mapping", () => {
    expect(lastContentEditor(m, [])).toBe(ids.someoneElse);
  });

  it("is the last person who changed the rule or kind", () => {
    const events = [
      changeEvent({ operation: "create", user_id: ids.someoneElse, occurred_at: "2026-10-01T09:00:00.000Z" }),
      changeEvent({ user_id: ids.actor, occurred_at: "2026-10-01T10:00:00.000Z", before_image: { rule_expression: null }, after_image: { rule_expression: "TRIM(email)" } }),
    ];
    expect(lastContentEditor(m, events)).toBe(ids.actor);
  });

  it("counts input changes of this mapping only", () => {
    const events = [
      changeEvent({ object_type: "mapping_input", object_id: ids.inEmail, operation: "create", user_id: ids.actor, after_image: { ...mappingInput() } }),
      changeEvent({ object_type: "mapping_input", operation: "delete", user_id: ids.org, occurred_at: "2026-10-01T11:00:00.000Z", before_image: { mapping_id: ids.org }, after_image: { mapping_id: ids.org } }),
    ];
    expect(lastContentEditor(m, events)).toBe(ids.actor);
  });

  it("ignores status and note changes", () => {
    const events = [
      changeEvent({ operation: "create", user_id: ids.actor }),
      changeEvent({ user_id: ids.someoneElse, occurred_at: NOW_LATER, before_image: { status: "draft", note_text: null, kind: "direct" }, after_image: { status: "review", note_text: "ok", kind: "direct" } }),
    ];
    expect(lastContentEditor(m, events)).toBe(ids.actor);
  });

  it("ignores other mappings", () => {
    expect(lastContentEditor(m, [changeEvent({ object_id: ids.org, operation: "create", user_id: ids.actor })])).toBe(ids.someoneElse);
  });
});

describe("checkFourEyes (AD-06)", () => {
  it("refuses the content author when four-eyes is on", () => {
    expect(checkFourEyes(workspace({ four_eyes: true }), ids.actor, ids.actor)).toEqual({ code: "forbidden", message: FOUR_EYES_MESSAGE });
  });

  it("lets someone else approve", () => {
    expect(checkFourEyes(workspace({ four_eyes: true }), ids.actor, ids.someoneElse)).toBeNull();
  });

  it("lets the author approve when four-eyes is off", () => {
    expect(checkFourEyes(workspace({ four_eyes: false }), ids.actor, ids.actor)).toBeNull();
  });
});

describe("suggestsBusinessKey (AD-28)", () => {
  it("suggests the flag when an input column is marked BK", () => {
    expect(suggestsBusinessKey(attribute(ids.customerId), [sourceColumn(ids.colCustId)])).toBe(true);
  });

  it("does not suggest it when no input is BK or the attribute already is one", () => {
    expect(suggestsBusinessKey(attribute(ids.email), [sourceColumn(ids.colEmail)])).toBe(false);
    expect(suggestsBusinessKey(attribute(ids.customerId, { is_business_key: true }), [sourceColumn(ids.colCustId)])).toBe(false);
  });
});
