// Slice 3a, step 2: working labels on the canvas (marks on rows, entity and table headers and mapping lines) and the label rules
// the panels and the project home use.

import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  ids,
  label,
  labelLink,
  mapping,
  mappingInput,
  NOW,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import { labelNamesByItem, projectLabels, type ProjectLabelContext } from "@/domain/model/labels";
import type { WorkspaceModel } from "@/domain/types";
import { buildCards } from "./card-data";
import { buildLines } from "./line-data";
import { lineNeedsClip, rowNeedsClip } from "./text-fit";

const { customer, email, customerId, mapEmail, crmCustomer, colEmail, colCustId, labelCr23, labelJira, linkCustomer, linkEmail, linkMapping, linkTable } = ids;

const model: WorkspaceModel = {
  concepts: [concept()],
  entities: [entity(customer)],
  attributes: [attribute(customerId), attribute(email)],
  relationships: [],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(colCustId), sourceColumn(colEmail)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
};
const labels = [label(labelCr23), label(labelJira), label("01900000-0000-7000-8000-00000000a103", { name: "Gone", deleted_at: NOW })];
const columnLink = labelLink("01900000-0000-7000-8000-00000000a205", { label_id: labelJira, entity_id: null, source_column_id: colEmail });
const jiraOnEmail = labelLink("01900000-0000-7000-8000-00000000a206", { label_id: labelJira, entity_id: null, attribute_id: email });
const links = [labelLink(linkCustomer), labelLink(linkEmail), labelLink(linkMapping), labelLink(linkTable), columnLink, jiraOnEmail];

describe("label names per item", () => {
  it("lists each item's labels by name, without deleted labels or links", () => {
    const names = labelNamesByItem(labels, [...links, labelLink("01900000-0000-7000-8000-00000000a207", { label_id: "01900000-0000-7000-8000-00000000a103" })]);
    expect(names.get(`attribute:${email}`)).toEqual(["CR-23", "JIRA-481"]);
    expect(names.get(`entity:${customer}`)).toEqual(["CR-23"]);
    expect(names.get(`source_table:${crmCustomer}`)).toEqual(["JIRA-481"]);
    expect(labelNamesByItem(labels, [labelLink(linkCustomer, { deleted_at: NOW })]).size).toBe(0);
  });
});

describe("marks on the canvas (S3A-03)", () => {
  const names = labelNamesByItem(labels, links);
  const cards = buildCards(model, [canvasItem(ids.itemCustomer), canvasItem(ids.itemCrmCustomer, { x: 0 })], names);
  const ent = cards.find((c) => c.kind === "ent")!;
  const src = cards.find((c) => c.kind === "src")!;

  it("puts the label names on labeled attribute and column rows and on labeled entity and table headers", () => {
    expect(ent.rows.map((r) => r.labels)).toEqual([null, "CR-23, JIRA-481"]);
    expect(src.rows.map((r) => r.labels)).toEqual([null, "JIRA-481"]);
    expect(src.labels).toBe("JIRA-481");
    expect(ent.labels).toBe("CR-23");
    const plain = buildCards(model, [canvasItem(ids.itemCustomer)]).find((c) => c.kind === "ent")!;
    expect(plain.labels).toBeNull();
    expect(plain.rows.every((r) => r.labels === null)).toBe(true);
  });

  it("puts them on a labeled mapping line", () => {
    expect(buildLines(model, cards, names).mappings.map((l) => [l.id, l.labels])).toEqual([[mapEmail, "CR-23"]]);
    expect(buildLines(model, cards).mappings[0]!.labels).toBeNull();
  });

  it("gives the mark room when deciding whether a name fits", () => {
    // the longest name that just fits without a mark does not fit with one
    const row = (name: string) => ({ name, type: "String", pk: false, fk: false, pii: false, bk: false, mappings: 1 });
    let name = "a";
    while (!rowNeedsClip(row(name + "a"), "ent", false)) name += "a";
    expect(rowNeedsClip(row(name), "ent", false)).toBe(false);
    expect(rowNeedsClip({ ...row(name), labels: "CR-23" }, "ent", false)).toBe(true);
    let path = "CRM / a";
    while (!lineNeedsClip([path + "a"], "src")) path += "a";
    expect(lineNeedsClip([path], "src", undefined, true)).toBe(true);
  });
});

describe("labels on the project home (S3A-05, prototype projLabels)", () => {
  const second = "01900000-0000-7000-8000-00000000a002";
  const context = (over: Partial<ProjectLabelContext> = {}): ProjectLabelContext => ({
    entitiesHere: new Set(),
    tablesHere: new Set(),
    entityOfAttribute: new Map([[email, customer], [customerId, customer]]),
    tableOfColumn: new Map([[colEmail, crmCustomer], [colCustId, crmCustomer]]),
    mappingEnds: new Map([[mapEmail, { attributeId: email, columnIds: [colEmail] }], [second, { attributeId: customerId, columnIds: [colCustId] }]]),
    ...over,
  });
  const names = (rows: ReturnType<typeof projectLabels>) => rows.map((r) => `${r.label.name}:${r.items}${r.pinned ? ":pinned" : ""}`);

  it("lists the labels marking something on the project's canvases, by how many items they mark", () => {
    expect(names(projectLabels(labels, links, new Set(), context({ entitiesHere: new Set([customer]) })))).toEqual(["CR-23:3", "JIRA-481:3"]);
    // only the table is here: JIRA-481 marks it, CR-23 reaches it through the mapping that reads its column
    expect(names(projectLabels(labels, links, new Set(), context({ tablesHere: new Set([crmCustomer]) })))).toEqual(["CR-23:3", "JIRA-481:3"]);
    expect(names(projectLabels(labels, links, new Set(), context()))).toEqual([]);
  });

  it("puts pinned labels first and keeps them when no canvas uses them", () => {
    expect(names(projectLabels(labels, links, new Set([labelJira]), context({ entitiesHere: new Set([customer]) })))).toEqual(["JIRA-481:3:pinned", "CR-23:3"]);
    expect(names(projectLabels(labels, links, new Set([labelJira]), context()))).toEqual(["JIRA-481:3:pinned"]);
  });

  it("orders labels with the same count by name, and leaves out deleted labels", () => {
    const fewer = [labelLink(linkCustomer), labelLink(linkTable)];
    expect(names(projectLabels(labels, fewer, new Set(["01900000-0000-7000-8000-00000000a103"]), context({ entitiesHere: new Set([customer]), tablesHere: new Set([crmCustomer]) })))).toEqual([
      "CR-23:1",
      "JIRA-481:1",
    ]);
  });
});
