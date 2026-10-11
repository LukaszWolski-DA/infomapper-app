import { describe, expect, it } from "vitest";
import {
  access,
  archived,
  attribute,
  entity,
  ids,
  label,
  labelLink,
  makeCtx,
  mapping,
  NOW,
  pin,
  project,
  sourceColumn,
  sourceTable,
} from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import type { WorkspaceRole } from "../types";
import { addLabel, deleteLabel, linksOnItems, removeLabel, renameLabel, setLabelPinned, takenNameMessage } from "./label";
import { isUndoable } from "./undo";

const { customer, email, mapEmail, crmCustomer, colEmail, labelCr23, labelJira, linkCustomer, linkEmail, linkMapping, linkTable, projectA } = ids;

const model = {
  entities: [entity(customer)],
  attributes: [attribute(email)],
  mappings: [mapping()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(colEmail)],
};

describe("addLabel (S3A-01, S3A-02)", () => {
  const state = { ...model, labels: [label(labelCr23), label(labelJira)], links: [labelLink(linkCustomer)] };
  const add = (input: object, s: object = {}, role: WorkspaceRole = "modeler") => addLabel(makeCtx(), access(role), { ...state, ...s }, input);

  it("creates a new label from a typed name and puts it on the item, in one change group", () => {
    const r = add({ target: { kind: "entity", id: customer }, name: "cr 7" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ created: true, name: "cr-7" });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "label", row: { id: r.value.labelId, name: "cr-7", name_key: "cr-7" } },
      { kind: "insert", table: "label_link", row: { id: r.value.labelLinkId, label_id: r.value.labelId, entity_id: customer, attribute_id: null } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(changeLabel(r.writeSet.events)).toBe("Add label");
    expect(isUndoable(r.writeSet.events)).toBe(true);
  });

  it("uses the label that has the name in another case instead of creating a second one", () => {
    const r = add({ target: { kind: "attribute", id: email }, name: "cr-23" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ labelId: labelCr23, created: false, name: "CR-23" });
    expect(r.writeSet.writes).toMatchObject([{ kind: "insert", table: "label_link", row: { label_id: labelCr23, attribute_id: email } }]);
  });

  it("puts a picked label on each kind of item", () => {
    const targets = [
      { kind: "entity", id: customer, column: "entity_id" },
      { kind: "attribute", id: email, column: "attribute_id" },
      { kind: "mapping", id: mapEmail, column: "mapping_id" },
      { kind: "source_table", id: crmCustomer, column: "source_table_id" },
      { kind: "source_column", id: colEmail, column: "source_column_id" },
    ] as const;
    for (const t of targets) {
      const r = add({ target: { kind: t.kind, id: t.id }, labelId: labelJira });
      if (!r.ok) throw new Error(`${t.kind}: ${r.error.message}`);
      expect(r.writeSet.writes).toMatchObject([{ table: "label_link", row: { label_id: labelJira, [t.column]: t.id } }]);
    }
  });

  it("refuses a label the item already has", () => {
    expect(add({ target: { kind: "entity", id: customer }, labelId: labelCr23 })).toMatchObject({ ok: false, error: { code: "conflict", message: "It already has the label CR-23." } });
    expect(add({ target: { kind: "entity", id: customer }, name: "Cr-23" })).toMatchObject({ ok: false, error: { code: "conflict" } });
    // a removed link does not count
    expect(add({ target: { kind: "entity", id: customer }, labelId: labelCr23 }, { links: [labelLink(linkCustomer, { deleted_at: NOW })] }).ok).toBe(true);
  });

  it("refuses an empty name, both or neither of label and name, deleted labels and items", () => {
    expect(add({ target: { kind: "entity", id: customer }, name: " , " })).toMatchObject({ ok: false, error: { code: "invalid", message: "Enter a label name." } });
    expect(add({ target: { kind: "entity", id: customer } })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(add({ target: { kind: "entity", id: customer }, name: "x", labelId: labelCr23 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(add({ target: { kind: "entity", id: customer }, labelId: labelJira }, { labels: [label(labelJira, { deleted_at: NOW })] })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(add({ target: { kind: "entity", id: customer }, name: "x" }, { entities: [entity(customer, { deleted_at: NOW })] })).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "This entity does not exist." },
    });
    expect(add({ target: { kind: "requirement", id: customer }, name: "x" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("is for modelers, admins and owners; refused to reviewers, readers and in an archived workspace (S3A-13)", () => {
    const input = { target: { kind: "entity", id: customer }, name: "new" };
    for (const role of ["owner", "admin", "modeler"] as const) expect(add(input, {}, role).ok).toBe(true);
    expect(add(input, {}, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden", message: "As a reviewer you cannot change labels." } });
    expect(add(input, {}, "reader")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(addLabel(makeCtx(), access("owner", archived), state, input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("removeLabel", () => {
  it("takes the label off one item; the label stays", () => {
    const r = removeLabel(makeCtx(), access("modeler"), { link: labelLink(linkEmail) }, { labelLinkId: linkEmail, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "label_link", row: { id: linkEmail, deleted_at: NOW, version: 2 } }]);
    expect(changeLabel(r.writeSet.events)).toBe("Remove label");
  });

  it("refuses a stale version, a removed link and reviewers", () => {
    const remove = (role: WorkspaceRole, link = labelLink(linkEmail), version = 1) =>
      removeLabel(makeCtx(), access(role), { link }, { labelLinkId: linkEmail, expectedVersion: version });
    expect(remove("modeler", labelLink(linkEmail), 3)).toMatchObject({ ok: false, error: { message: STALE_VERSION_MESSAGE } });
    expect(remove("modeler", labelLink(linkEmail, { deleted_at: NOW }))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(remove("reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("renameLabel (S3A-04)", () => {
  const labels = [label(labelCr23), label(labelJira)];
  const rename = (name: string, s = labels) => renameLabel(makeCtx(), access("admin"), { labels: s }, { labelId: labelCr23, expectedVersion: 1, name });

  it("renames, normalising the name and its key", () => {
    const r = rename(" CR 24 ");
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.label).toMatchObject({ name: "CR-24", name_key: "cr-24", version: 2 });
    expect(changeLabel(r.writeSet.events)).toBe("Rename label");
  });

  it("refuses a name another label has in any case, but allows another case of its own name", () => {
    expect(rename("jira-481")).toMatchObject({ ok: false, error: { code: "conflict", message: takenNameMessage("JIRA-481") } });
    expect(rename("jira-481", [label(labelCr23), label(labelJira, { deleted_at: NOW })]).ok).toBe(true);
    expect(rename("cr-23")).toMatchObject({ ok: true, value: { label: { name: "cr-23" } } });
    expect(rename("CR-23")).toMatchObject({ ok: false, error: { code: "invalid", message: "Nothing to change." } });
    expect(rename(" ")).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("deleteLabel (S3A-04)", () => {
  const state = {
    label: label(labelCr23),
    links: [labelLink(linkCustomer), labelLink(linkEmail), labelLink(linkMapping, { deleted_at: NOW }), labelLink(linkTable)],
    pins: [pin(projectA, labelCr23), pin(ids.projectB, labelJira)],
  };

  it("takes the label off every item and every project home, in one change group", () => {
    const r = deleteLabel(makeCtx(), access("modeler"), state, { labelId: labelCr23, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ name: "CR-23", items: 2 });
    expect(r.writeSet.writes.map((w) => `${w.kind} ${w.table}`)).toEqual([
      "update label_link",
      "update label_link",
      "remove project_pinned_label",
      "update label",
    ]);
    expect(r.writeSet.events.find((e) => e.object_type === "project_pinned_label")).toMatchObject({ operation: "delete", object_id: labelCr23, after_image: null });
    expect(changeLabel(r.writeSet.events)).toBe("Delete label");
    expect(isUndoable(r.writeSet.events)).toBe(true);
  });

  it("is refused to reviewers", () => {
    expect(deleteLabel(makeCtx(), access("reviewer"), state, { labelId: labelCr23, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("setLabelPinned (S3A-05)", () => {
  const state = { project: project(projectA), label: label(labelJira), pins: [pin(projectA, labelCr23)] };
  const set = (pinned: boolean, s: object = {}, role: WorkspaceRole = "modeler") =>
    setLabelPinned(makeCtx(), access(role), { ...state, ...s }, { projectId: projectA, labelId: labelJira, pinned });

  it("pins a label to a project and unpins it; written with a change event, but not an undo step", () => {
    const r = set(true);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([{ kind: "insert", table: "project_pinned_label", row: pin(projectA, labelJira) }]);
    expect(r.writeSet.events).toMatchObject([{ object_type: "project_pinned_label", object_id: labelJira, operation: "create" }]);
    expect(isUndoable(r.writeSet.events)).toBe(false);
    const u = set(false, { pins: [pin(projectA, labelJira)] });
    if (!u.ok) throw new Error(u.error.message);
    expect(u.writeSet.writes).toEqual([{ kind: "remove", table: "project_pinned_label", before: pin(projectA, labelJira) }]);
    expect(isUndoable(u.writeSet.events)).toBe(false);
  });

  it("refuses pinning twice, unpinning what is not pinned, deleted labels and projects, and reviewers", () => {
    expect(set(true, { pins: [pin(projectA, labelJira)] })).toMatchObject({ ok: false, error: { code: "conflict", message: "JIRA-481 is already pinned to Customer 360." } });
    expect(set(false)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(set(true, { label: label(labelJira, { deleted_at: NOW }) })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(set(true, { project: null })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(set(true, {}, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("linksOnItems (D-47 cascade)", () => {
  it("finds the live links on the named items, of any label", () => {
    const links = [labelLink(linkCustomer), labelLink(linkEmail), labelLink(linkMapping, { deleted_at: NOW }), labelLink(linkTable)];
    expect(linksOnItems(links, [{ kind: "attribute", id: email }, { kind: "mapping", id: mapEmail }, { kind: "source_table", id: crmCustomer }]).map((k) => k.id)).toEqual([
      linkEmail,
      linkTable,
    ]);
    expect(linksOnItems(links, [{ kind: "attribute", id: customer }])).toEqual([]);
    expect(linksOnItems(undefined, [{ kind: "entity", id: customer }])).toEqual([]);
  });
});
