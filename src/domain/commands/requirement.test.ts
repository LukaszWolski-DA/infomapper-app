// Requirements (slice 4a, step 1): the commands, their undo, the cascade from deleted model elements and the working
// context.
import { describe, expect, it } from "vitest";
import type { CommandResult, WriteSet } from "../changes";
import {
  access,
  archived,
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  ids,
  label,
  makeCtx,
  mapping,
  mappingInput,
  requirement,
  requirementLink,
  sourceColumn,
  sourceSystem,
  sourceTable,
  T0,
} from "../__fixtures__/domain";
import { REVIEWER_REQUIREMENT_MESSAGE } from "../permissions";
import type { Requirement, RequirementLink, WorkspaceRole } from "../types";
import { deleteAttribute } from "./attribute";
import { deleteEntity } from "./entity";
import { completeLiveWrites, type LiveWriteState } from "./live";
import { deleteMapping, mergeMappings, splitMapping } from "./mapping";
import {
  ALREADY_LINKED_MESSAGE,
  ALREADY_UNLINKED_MESSAGE,
  createRequirement,
  deleteRequirement,
  ELEMENT_GONE_MESSAGE,
  linkRequirement,
  REQUIREMENT_GONE_MESSAGE,
  setRequirementStatus,
  unlinkRequirement,
  updateRequirement,
} from "./requirement";
import { deleteSourceTable } from "./source";
import { isUndoable, revertChangeGroup, UNDOABLE_TABLES, type UndoableTable, type WorkspaceRows } from "./undo";

const owner = access("owner");
const targets = {
  entities: [entity(), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  mappings: [mapping()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
};
const reqs = [
  requirement(ids.req101, { kind: "need" }),
  requirement(ids.req102, { parent_id: ids.req101 }),
  requirement(ids.req103, { kind: "dq_rule", parent_id: ids.req102, expression: "COUNT(*) = 1", severity: "warn" }),
];
const ok = <T>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(`refused: ${r.error.message}`);
  return r;
};
const refusal = (r: { ok: true } | { ok: false; error: { message: string } }) => (r.ok ? null : r.error.message);
const update = (input: object, state = reqs, who = owner) => updateRequirement(makeCtx(), who, { requirements: state }, { requirementId: ids.req103, expectedVersion: 1, ...input });

describe("create (PRD items 2, 3)", () => {
  it("makes REQ-{counter}: Data requirement, Draft, Should, “New requirement”, and raises the counter in the same write", () => {
    const r = ok(createRequirement(makeCtx(), access("owner", { requirement_key_next: 106 }), { requirements: reqs }, {}));
    expect(r.value.requirement).toMatchObject({ key: "REQ-106", kind: "data", status: "draft", priority: "should", name: "New requirement", parent_id: null });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "update", table: "workspace", row: { requirement_key_next: 107 } },
      { kind: "insert", table: "requirement" },
    ]);
  });

  it("skips a generated key someone typed already, in any case", () => {
    const typed = [...reqs, requirement(ids.req104, { key: "req-106" })];
    const r = ok(createRequirement(makeCtx(), access("owner", { requirement_key_next: 106 }), { requirements: typed }, {}));
    expect(r.value.requirement.key).toBe("REQ-107");
    expect(r.writeSet.writes[0]).toMatchObject({ row: { requirement_key_next: 108 } });
  });

  it("links it to an element in the same change group (“+ New requirement…”); a deleted element is refused", () => {
    const r = ok(createRequirement(makeCtx(), owner, { requirements: reqs, ...targets }, { link: { kind: "attribute", id: ids.email } }));
    expect(r.value.link).toMatchObject({ requirement_id: r.value.requirement.id, attribute_id: ids.email, entity_id: null });
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const gone = { ...targets, attributes: [attribute(ids.email, { deleted_at: T0 })] };
    expect(refusal(createRequirement(makeCtx(), owner, { requirements: reqs, ...gone }, { link: { kind: "attribute", id: ids.email } }))).toBe(ELEMENT_GONE_MESSAGE);
  });
});

describe("change one field (PRD items 2, 4, 5, 11)", () => {
  it("refuses a key another live requirement has, in any case, and an empty key or name", () => {
    expect(update({ field: "key", value: "req-101" })).toMatchObject({ ok: false, error: { code: "conflict", message: "req-101 is already used by another requirement." } });
    expect(refusal(update({ field: "key", value: "  " }))).toBe("Enter a key.");
    expect(refusal(update({ field: "name", value: "" }))).toBe("Enter a name.");
    expect(ok(update({ field: "key", value: " REQ-108 " })).value.requirement.key).toBe("REQ-108");
    // its own key in another case is fine; a deleted requirement's key is free
    expect(ok(update({ field: "key", value: "req-103" })).value.requirement.key).toBe("req-103");
    const freed = reqs.map((r) => (r.id === ids.req101 ? { ...r, deleted_at: T0 } : r));
    expect(ok(update({ field: "key", value: "REQ-101" }, freed)).value.requirement.key).toBe("REQ-101");
  });

  it("keeps expression and severity when the kind changes; becoming a data quality rule without a severity sets warn", () => {
    const rule = ok(update({ field: "kind", value: "business_rule" })).value.requirement;
    expect(rule).toMatchObject({ kind: "business_rule", expression: "COUNT(*) = 1", severity: "warn" });
    const plain = [requirement(ids.req103, { kind: "data" })];
    expect(ok(update({ field: "kind", value: "dq_rule" }, plain)).value.requirement).toMatchObject({ kind: "dq_rule", severity: "warn" });
    const blocking = [requirement(ids.req103, { kind: "need", severity: "block" })];
    expect(ok(update({ field: "kind", value: "dq_rule" }, blocking)).value.requirement.severity).toBe("block");
  });

  it("sanitizes a description on the server and derives its plain text; empty stores null in both", () => {
    const r = ok(update({ field: "description", value: '<h4>Rule</h4><p onclick="x()">Sum <strong>all</strong><script>bad()</script> <a href="javascript:x">lines</a></p>' }));
    expect(r.value.requirement).toMatchObject({ description_html: "<h4>Rule</h4><p>Sum <strong>all</strong> lines</p>", description_text: "Rule\n\nSum all lines" });
    const withText = [requirement(ids.req103, { description_html: "<p>x</p>", description_text: "x" })];
    expect(ok(update({ field: "description", value: "<p> </p>" }, withText)).value.requirement).toMatchObject({ description_html: null, description_text: null });
  });

  it("“Part of” never makes a cycle, at any depth", () => {
    const chain = [...reqs, requirement(ids.req104, { parent_id: ids.req103 })];
    const r = updateRequirement(makeCtx(), owner, { requirements: chain }, { requirementId: ids.req101, expectedVersion: 1, field: "parent_id", value: ids.req104 });
    expect(r).toMatchObject({ ok: false, error: { code: "conflict", message: "REQ-104 is already part of REQ-101, so REQ-101 cannot be part of it." } });
    expect(refusal(updateRequirement(makeCtx(), owner, { requirements: chain }, { requirementId: ids.req101, expectedVersion: 1, field: "parent_id", value: ids.req101 }))).toBe(
      "A requirement cannot be part of itself.",
    );
    expect(ok(update({ field: "parent_id", value: null }, chain)).value.requirement.parent_id).toBeNull();
    expect(ok(updateRequirement(makeCtx(), owner, { requirements: chain }, { requirementId: ids.req104, expectedVersion: 1, field: "parent_id", value: ids.req101 })).value.requirement.parent_id).toBe(ids.req101);
  });

  it("saves owner, reference, priority, expression and severity; the same value is “Nothing to change.”", () => {
    expect(ok(update({ field: "owner_name", value: " Data steward " })).value.requirement.owner_name).toBe("Data steward");
    expect(ok(update({ field: "external_ref", value: "" }, [requirement(ids.req103, { external_ref: "JIRA-1" })])).value.requirement.external_ref).toBeNull();
    expect(ok(update({ field: "priority", value: "must" })).value.requirement.priority).toBe("must");
    expect(ok(update({ field: "severity", value: "block" })).value.requirement.severity).toBe("block");
    expect(refusal(update({ field: "expression", value: "COUNT(*) = 1" }))).toBe("Nothing to change.");
  });
});

describe("status and four-eyes (PRD item 13, AD-06)", () => {
  const status = (who: ReturnType<typeof access>, value: string, author: string = ids.actor, r: Requirement = reqs[2]!) =>
    setRequirementStatus(makeCtx(), who, { requirement: r, contentAuthorId: author }, { requirementId: r.id, expectedVersion: 1, status: value });

  it("lets a reviewer set the status: that is the approval", () => {
    expect(ok(status(access("reviewer"), "agreed", ids.someoneElse)).value.requirement.status).toBe("agreed");
  });

  it("with four-eyes on, the last content author cannot set Agreed; others can, and other statuses have no rule", () => {
    const fourEyes = access("modeler", { four_eyes: true });
    expect(status(fourEyes, "agreed")).toMatchObject({ ok: false, error: { code: "forbidden", message: "You changed REQ-103 last, so someone else has to agree it." } });
    expect(status(fourEyes, "implemented").ok).toBe(true);
    expect(status(access("reviewer", { four_eyes: true }), "agreed", ids.actor).ok).toBe(false);
    expect(status(access("reviewer", { four_eyes: true }), "agreed", ids.someoneElse).ok).toBe(true);
    expect(status(access("modeler"), "agreed").ok).toBe(true);
  });
});

describe("roles (PRD item 12, AD-05, AD-09)", () => {
  const all = (who: ReturnType<typeof access>) => [
    createRequirement(makeCtx(), who, { requirements: reqs }, {}),
    update({ field: "name", value: "x" }, reqs, who),
    deleteRequirement(makeCtx(), who, { requirements: reqs, links: [] }, { requirementId: ids.req103, expectedVersion: 1 }),
    linkRequirement(makeCtx(), who, { requirement: reqs[2]!, links: [], ...targets }, { requirementId: ids.req103, target: { kind: "entity", id: ids.customer } }),
    unlinkRequirement(makeCtx(), who, { link: requirementLink() }, { requirementLinkId: ids.reqLink1, expectedVersion: 1 }),
  ];
  const status = (who: ReturnType<typeof access>) =>
    setRequirementStatus(makeCtx(), who, { requirement: reqs[2]!, contentAuthorId: ids.someoneElse }, { requirementId: ids.req103, expectedVersion: 1, status: "agreed" });

  it("reviewer: only the status", () => {
    expect(all(access("reviewer")).map(refusal)).toEqual(Array(5).fill(REVIEWER_REQUIREMENT_MESSAGE));
    expect(status(access("reviewer")).ok).toBe(true);
  });

  it("reader: nothing", () => {
    expect([...all(access("reader")), status(access("reader"))].map(refusal)).toEqual(Array(6).fill("As a reader you cannot change requirements."));
  });

  it("archived workspace: nothing, for any role", () => {
    for (const role of ["owner", "modeler", "reviewer"] as WorkspaceRole[]) {
      expect([...all(access(role, archived)), status(access(role, archived))].map(refusal)).toEqual(Array(6).fill("This workspace is archived, so it is read-only."));
    }
  });
});

describe("delete, link and unlink (PRD items 6, 9)", () => {
  const links = [requirementLink(ids.reqLink1, { requirement_id: ids.req102 }), requirementLink(ids.reqLink2, { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer })];

  it("deletes the requirement and its links and makes its children top level; the model is untouched", () => {
    const r = ok(deleteRequirement(makeCtx(), owner, { requirements: reqs, links }, { requirementId: ids.req102, expectedVersion: 1 }));
    expect(r.value.message).toBe("Deleted REQ-102. The model elements it traced to are untouched.");
    expect(r.writeSet.writes.map((w) => [w.table, w.kind === "update" ? (w.row as { id: string }).id : null])).toEqual([
      ["requirement_link", ids.reqLink1],
      ["requirement", ids.req103],
      ["requirement", ids.req102],
    ]);
    expect(r.writeSet.writes[1]).toMatchObject({ row: { parent_id: null } });
    expect(r.writeSet.writes[2]).toMatchObject({ row: { deleted_at: expect.any(String) } });
  });

  it("links once: a second link to the same element is “Already linked.” and writes nothing", () => {
    const link = (state: RequirementLink[], target: object) => linkRequirement(makeCtx(), owner, { requirement: reqs[1]!, links: state, ...targets }, { requirementId: ids.req102, target });
    const r = ok(link([], { kind: "mapping", id: ids.mapEmail }));
    expect(r.value.message).toBe("Linked REQ-102 to the mapping.");
    expect(r.value.link).toMatchObject({ mapping_id: ids.mapEmail, attribute_id: null });
    for (const [kind, id, noun] of [["entity", ids.customer, "the entity"], ["attribute", ids.email, "the attribute"], ["source_table", ids.crmCustomer, "the table"], ["source_column", ids.colEmail, "the column"]] as const) {
      expect(ok(link([], { kind, id })).value.message).toBe(`Linked REQ-102 to ${noun}.`);
    }
    expect(link(links, { kind: "attribute", id: ids.email })).toMatchObject({ ok: false, error: { code: "conflict", message: ALREADY_LINKED_MESSAGE } });
    expect(refusal(link([], { kind: "attribute", id: ids.orderId.replace("5003", "5999") }))).toBe(ELEMENT_GONE_MESSAGE);
    expect(refusal(linkRequirement(makeCtx(), owner, { requirement: { ...reqs[1]!, deleted_at: T0 }, links: [], ...targets }, { requirementId: ids.req102, target: { kind: "entity", id: ids.customer } }))).toBe(
      REQUIREMENT_GONE_MESSAGE,
    );
  });

  it("unlinks; a link that is gone already is “Already unlinked.”", () => {
    expect(ok(unlinkRequirement(makeCtx(), owner, { link: links[0]! }, { requirementLinkId: ids.reqLink1, expectedVersion: 1 })).writeSet.writes).toMatchObject([
      { table: "requirement_link", row: { deleted_at: expect.any(String) } },
    ]);
    expect(refusal(unlinkRequirement(makeCtx(), owner, { link: { ...links[0]!, deleted_at: T0 } }, { requirementLinkId: ids.reqLink1, expectedVersion: 1 }))).toBe(ALREADY_UNLINKED_MESSAGE);
    expect(refusal(unlinkRequirement(makeCtx(), owner, { link: null }, { requirementLinkId: ids.reqLink1, expectedVersion: 1 }))).toBe(ALREADY_UNLINKED_MESSAGE);
  });
});

// ---- undo (AD-13) ----

type Rows = { -readonly [T in UndoableTable]: WorkspaceRows[T][number][] };

function baseRows(over: Partial<Rows> = {}): Rows {
  const rows = Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []])) as unknown as Rows;
  return {
    ...rows,
    canvas: [canvas()],
    concept: [concept(), concept(ids.conceptSales)],
    entity: targets.entities,
    attribute: targets.attributes,
    source_system: [sourceSystem()],
    source_table: targets.sourceTables,
    source_column: targets.sourceColumns,
    mapping: [mapping()],
    mapping_input: [mappingInput()],
    requirement: [...reqs],
    ...over,
  };
}

/** The rows after a write set, as the adapter would store them. */
function applied(rows: Rows, ws: WriteSet): Rows {
  const next = Object.fromEntries(Object.entries(rows).map(([t, r]) => [t, [...(r as object[])]])) as unknown as Rows;
  for (const w of ws.writes) {
    if (!(w.table in next)) continue;
    const list = next[w.table as UndoableTable] as { id: string }[];
    if (w.kind === "insert") list.push(w.row as unknown as { id: string });
    else if (w.kind === "update") list[list.findIndex((r) => r.id === (w.before as { id: string }).id)] = w.row as unknown as { id: string };
  }
  return next;
}

const undo = (rows: Rows, ws: WriteSet, who = owner) => revertChangeGroup(makeCtx(), who, { events: ws.events, rows }, "undo");
const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);

describe("undo of requirement steps", () => {
  it("a new requirement is one undo step; the key counter is written with it but never wound back", () => {
    const created = ok(createRequirement(makeCtx(), access("owner", { requirement_key_next: 106 }), { requirements: reqs, ...targets }, { link: { kind: "attribute", id: ids.email } }));
    expect(isUndoable(created.writeSet.events)).toBe(true);
    const after = applied(baseRows(), created.writeSet);
    const back = ok(undo(after, created.writeSet));
    expect(back.writeSet.writes.map((w) => w.table).sort()).toEqual(["requirement", "requirement_link"]);
    const restored = applied(after, back.writeSet);
    expect(live(restored.requirement).map((r) => r.key)).toEqual(["REQ-101", "REQ-102", "REQ-103"]);
    expect(live(restored.requirement_link)).toEqual([]);
  });

  it("one undo brings back a deleted requirement, its links and its children's parent", () => {
    const links = [requirementLink(ids.reqLink1, { requirement_id: ids.req102 })];
    const rows = baseRows({ requirement_link: links });
    const deleted = ok(deleteRequirement(makeCtx(), owner, { requirements: reqs, links }, { requirementId: ids.req102, expectedVersion: 1 }));
    const after = applied(rows, deleted.writeSet);
    const restored = applied(after, ok(undo(after, deleted.writeSet)).writeSet);
    expect(live(restored.requirement).map((r) => [r.key, r.parent_id])).toEqual([
      ["REQ-101", null],
      ["REQ-102", ids.req101],
      ["REQ-103", ids.req102],
    ]);
    expect(live(restored.requirement_link).map((k) => k.id)).toEqual([ids.reqLink1]);
  });

  it("refuses to bring back a deleted requirement whose key another requirement uses now, in any case", () => {
    const deleted = ok(deleteRequirement(makeCtx(), owner, { requirements: reqs, links: [] }, { requirementId: ids.req103, expectedVersion: 1 }));
    const after = applied(baseRows(), deleted.writeSet);
    after.requirement.push(requirement(ids.req104, { key: "req-103" }));
    expect(undo(after, deleted.writeSet)).toMatchObject({ ok: false, error: { code: "conflict", message: "REQ-103 is used by another requirement now, so the deleted one cannot come back." } });
  });

  it("a reviewer undoes their own status change, and nothing else", () => {
    const set = ok(setRequirementStatus(makeCtx(), access("reviewer"), { requirement: reqs[2]!, contentAuthorId: ids.someoneElse }, { requirementId: ids.req103, expectedVersion: 1, status: "agreed" }));
    const after = applied(baseRows(), set.writeSet);
    expect(ok(undo(after, set.writeSet, access("reviewer"))).writeSet.writes).toMatchObject([{ row: { status: "draft" } }]);
    const renamed = ok(update({ field: "name", value: "Unique e-mail" }));
    expect(refusal(undo(applied(baseRows(), renamed.writeSet), renamed.writeSet, access("reviewer")))).toBe(REVIEWER_REQUIREMENT_MESSAGE);
  });
});

// ---- deleting model elements deletes their links (PRD item 10) ----

describe("links of deleted model elements", () => {
  const MAP_2 = "01900000-0000-7000-8000-00000000a012";
  const links = [
    requirementLink(ids.reqLink1, { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer }),
    requirementLink(ids.reqLink2, { requirement_id: ids.req102, attribute_id: ids.email }),
    requirementLink(ids.reqLink3, { requirement_id: ids.req103, attribute_id: null, mapping_id: ids.mapEmail }),
    requirementLink("01900000-0000-7000-8000-00000000e204", { requirement_id: ids.req101, attribute_id: null, source_table_id: ids.crmCustomer }),
    requirementLink("01900000-0000-7000-8000-00000000e205", { requirement_id: ids.req102, attribute_id: null, source_column_id: ids.colFirstName }),
    requirementLink("01900000-0000-7000-8000-00000000e206", { requirement_id: ids.req104, attribute_id: ids.orderId }),
  ];
  const rows = () => baseRows({ requirement: [...reqs, requirement(ids.req104)], requirement_link: links, canvas_item: [canvasItem()] });
  const linkIds = (r: Rows) => live(r.requirement_link).map((k) => k.id);

  /** The links the command deleted, and that one undo brings all of them back. */
  function check(ws: WriteSet, gone: string[]) {
    const before = rows();
    const after = applied(before, ws);
    expect(links.map((k) => k.id).filter((id) => !linkIds(after).includes(id))).toEqual(gone);
    const restored = applied(after, ok(undo(after, ws)).writeSet);
    expect(linkIds(restored)).toEqual(links.map((k) => k.id));
  }

  it("an entity takes the links on itself, its attributes and their mappings", () => {
    const r = ok(
      deleteEntity(makeCtx(), owner, { ...targets, entity: entity(), relationships: [], mappingInputs: [mappingInput()], canvasItems: [canvasItem()], requirementLinks: links }, { entityId: ids.customer, expectedVersion: 1 }),
    );
    check(r.writeSet, [ids.reqLink1, ids.reqLink2, ids.reqLink3]);
  });

  it("an attribute takes the links on itself and its mappings", () => {
    const r = ok(deleteAttribute(makeCtx(), owner, { attribute: attribute(ids.email), mappings: [mapping()], mappingInputs: [mappingInput()], requirementLinks: links }, { attributeId: ids.email, expectedVersion: 1 }));
    check(r.writeSet, [ids.reqLink2, ids.reqLink3]);
  });

  it("a mapping takes the links on itself", () => {
    const r = ok(deleteMapping(makeCtx(), owner, { mapping: mapping(), inputs: [mappingInput()], requirementLinks: links }, { mappingId: ids.mapEmail, expectedVersion: 1 }));
    check(r.writeSet, [ids.reqLink3]);
  });

  it("a source table takes the links on itself and its columns", () => {
    const r = ok(
      deleteSourceTable(
        makeCtx(),
        owner,
        { table: sourceTable(), columns: targets.sourceColumns, canvasItems: [], mappings: [], mappingInputs: [], attributes: [], entities: [], requirementLinks: links },
        { sourceTableId: ids.crmCustomer, expectedVersion: 1 },
      ),
    );
    check(r.writeSet, ["01900000-0000-7000-8000-00000000e204", "01900000-0000-7000-8000-00000000e205"]);
  });

  it("splitting a mapping writes no requirement link: its links stay on the mapping that keeps its id", () => {
    const combined = mapping({ kind: "transform", rule_expression: "a || b" });
    const inputs = [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b002", { source_column_id: ids.colFirstName, sort_order: 1 })];
    const r = ok(splitMapping(makeCtx(), owner, { mapping: combined, inputs, requirementLinks: links }, { mappingId: ids.mapEmail, expectedVersion: 1 }));
    expect(r.value.mapping.id).toBe(ids.mapEmail);
    expect(r.writeSet.writes.some((w) => w.table === "requirement_link")).toBe(false);
    const after = applied(rows(), r.writeSet);
    expect(live(after.requirement_link).find((k) => k.id === ids.reqLink3)).toMatchObject({ mapping_id: ids.mapEmail });
  });

  it("merging mappings moves the deleted mappings' links to the mapping that stays, without a second link", () => {
    const second = mapping({ id: MAP_2 });
    const both = [...links, requirementLink("01900000-0000-7000-8000-00000000e207", { requirement_id: ids.req103, attribute_id: null, mapping_id: MAP_2 }), requirementLink("01900000-0000-7000-8000-00000000e208", { requirement_id: ids.req104, attribute_id: null, mapping_id: MAP_2 })];
    const r = ok(
      mergeMappings(
        makeCtx(),
        owner,
        { mappings: [mapping(), second], inputs: [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: MAP_2, source_column_id: ids.colFirstName })], requirementLinks: both },
        { mappings: [{ mappingId: ids.mapEmail, expectedVersion: 1 }, { mappingId: MAP_2, expectedVersion: 1 }], ruleExpression: "COALESCE(a, b)" },
      ),
    );
    const moved = r.writeSet.writes.filter((w) => w.table === "requirement_link");
    expect(moved).toMatchObject([
      { row: { id: "01900000-0000-7000-8000-00000000e207", deleted_at: expect.any(String) } },
      { row: { id: "01900000-0000-7000-8000-00000000e208", mapping_id: ids.mapEmail, deleted_at: null } },
    ]);
  });
});

// ---- the working context (PRD item 14) ----

describe("with the working context on", () => {
  const liveState = (): LiveWriteState => ({
    ...targets,
    mappingInputs: [mappingInput()],
    concepts: [concept()],
    sourceSystems: [sourceSystem()],
    labels: [label()],
    labelLinks: [],
    canvases: [canvas()],
    canvasItems: [],
    frames: [],
    notes: [],
  });

  it("records the context on every event of a requirement write and a link write, and adds no label", () => {
    const created = ok(createRequirement(makeCtx(), access("owner", { requirement_key_next: 106 }), { requirements: reqs, ...targets }, { link: { kind: "attribute", id: ids.email } }));
    const linked = ok(linkRequirement(makeCtx(), owner, { requirement: reqs[1]!, links: [], ...targets }, { requirementId: ids.req102, target: { kind: "entity", id: ids.customer } }));
    for (const ws of [created.writeSet, linked.writeSet]) {
      const r = completeLiveWrites(makeCtx(), owner, liveState(), ws, { contextLabelId: ids.labelCr23 });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.value.labeled).toBe(0);
      expect(r.writeSet.writes.filter((w) => w.table === "label_link")).toEqual([]);
      expect(r.writeSet.events.length).toBeGreaterThan(0);
      expect(r.writeSet.events.every((e) => e.context_label_id === ids.labelCr23)).toBe(true);
    }
  });
});
