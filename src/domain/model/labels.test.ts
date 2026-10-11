import { describe, expect, it } from "vitest";
import { ids, NOW, T0 } from "../__fixtures__/domain";
import type { Label, LabelLink } from "../types";
import { labelItemCounts, labelKey, labelNamed, labelSuggestions, normalizeLabelName, targetColumns, targetOf } from "./labels";

const std = { workspace_id: ids.ws, version: 1, created_at: T0, created_by: ids.actor, updated_at: T0, updated_by: ids.actor, deleted_at: null };
let n = 0;
const label = (name: string, over: Partial<Label> = {}): Label => ({ id: `01900000-0000-7000-8000-l${String(++n).padStart(11, "0")}`, ...std, name, name_key: labelKey(name), ...over });
const link = (labelId: string, over: Partial<LabelLink> = {}): LabelLink => ({
  id: `01900000-0000-7000-8000-k${String(++n).padStart(11, "0")}`,
  ...std,
  label_id: labelId,
  ...targetColumns({ kind: "entity", id: ids.customer }),
  ...over,
});

describe("label names (prototype normLabel)", () => {
  it("trims, drops commas, turns spaces into hyphens and keeps 60 characters", () => {
    expect(normalizeLabelName("  cr 23 ")).toBe("cr-23");
    expect(normalizeLabelName("JIRA-481, phase  2")).toBe("JIRA-481-phase-2");
    expect(normalizeLabelName("a\tb\nc")).toBe("a-b-c");
    expect(normalizeLabelName(",,")).toBe("");
    expect(normalizeLabelName("x".repeat(80))).toHaveLength(60);
  });

  it("matches names in any case through the lower-case key", () => {
    expect(labelKey("CR-23")).toBe("cr-23");
    const cr = label("CR-23");
    expect(labelNamed([cr], "cr-23")).toBe(cr);
    expect(labelNamed([label("CR-23", { deleted_at: NOW })], "cr-23")).toBeNull();
  });
});

describe("label targets (AD-15)", () => {
  it("sets exactly one of the five target columns", () => {
    expect(targetColumns({ kind: "source_column", id: ids.colEmail })).toEqual({
      entity_id: null,
      attribute_id: null,
      mapping_id: null,
      source_table_id: null,
      source_column_id: ids.colEmail,
    });
    expect(targetOf(link(ids.ws, targetColumns({ kind: "mapping", id: ids.mapEmail })))).toEqual({ kind: "mapping", id: ids.mapEmail });
    expect(targetOf(link(ids.ws, { attribute_id: ids.email }))).toBeNull();
  });
});

describe("the Labels field's suggestions (prototype showLblSug)", () => {
  const cr23 = label("CR-23");
  const cr2 = label("CR-2");
  const crm = label("CRM-migration");
  const jira = label("JIRA-481");
  const links = [link(cr2.id), link(cr2.id), link(cr2.id), link(crm.id), link(crm.id), link(cr23.id), link(jira.id, { deleted_at: NOW })];
  const labels = [jira, crm, cr23, cr2];

  it("counts the items each label marks (live links only)", () => {
    expect(labelItemCounts(links)).toEqual(new Map([[cr2.id, 3], [crm.id, 2], [cr23.id, 1]]));
  });

  it("offers what was typed first when no label has that name, then existing ones by item count, then name", () => {
    const s = labelSuggestions(labels, links, "cr", new Set());
    expect(s.create).toBe("cr");
    expect(s.labels.map((l) => l.name)).toEqual(["CR-2", "CRM-migration", "CR-23"]);
  });

  it("puts the exact match first and offers no new label for a name that exists in another case (S3A-01, S3A-02)", () => {
    const s = labelSuggestions(labels, links, "cr 23", new Set());
    expect(s.create).toBeNull();
    expect(s.labels.map((l) => l.name)).toEqual(["CR-23"]);
    expect(labelSuggestions(labels, links, "Cr-2", new Set()).labels.map((l) => l.name)).toEqual(["CR-2", "CR-23"]);
  });

  it("normalises the typed name for “Create”", () => {
    expect(labelSuggestions([], [], "  new change, 7 ", new Set()).create).toBe("new-change-7");
  });

  it("leaves out the labels the item already has, and offers all others when nothing is typed", () => {
    const s = labelSuggestions(labels, links, "", new Set([cr2.id]));
    expect(s.create).toBeNull();
    expect(s.labels.map((l) => l.name)).toEqual(["CRM-migration", "CR-23", "JIRA-481"]);
    // the item's own label is not offered, and no second one with its name either
    expect(labelSuggestions(labels, links, "CR-2", new Set([cr2.id]))).toEqual({ create: null, labels: [cr23] });
  });

  it("offers at most 8 labels, and no deleted ones", () => {
    const many = Array.from({ length: 12 }, (_, i) => label(`T-${String(i).padStart(2, "0")}`));
    expect(labelSuggestions(many, [], "t", new Set()).labels).toHaveLength(8);
    expect(labelSuggestions([label("Old", { deleted_at: NOW })], [], "old", new Set())).toEqual({ create: "old", labels: [] });
  });
});
