// Slice 36 (D-88 as proposed): documents from a baseline in InfoDocumenter's domain: the source's rules and refusals,
// the sign-off preset, "New document from it" and "Make a document", the documents' count, which states a changes
// section compares, its scope on either side, its re-ask key, and what the tree, the frame and Markdown say.

import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx } from "@/domain/__fixtures__/domain";
import type { BaselineChange } from "@/domain/baseline/compare";
import type { SectionScope } from "@/domain/document/sections";
import { sectionKinds } from "@/domain/document/sections";
import type { BaselineRef, DocumentState, SectionChanges } from "@/domain/document/state";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Workspace, WorkspaceRole } from "@/domain/types";
import { BASELINE_TEXTS, createChangesDocument, createDocument, documentsFromBaseline, SHORT_TEXT_MAX, updateDocument } from "./commands";
import { buildDocument, localMinute } from "./document";
import { documentMarkdown } from "./markdown";
import { INFODOC_SECTION_TYPES } from "./builders";
import { INFODOC_SECTION_KINDS } from "./sections";
import { buildChanges, changesHeading, changesInScope, changesPlan, changesRequestKey, type ChangesSide } from "./sections-changes";
import type { DocumentDefinition, DocumentScope } from "./types";

const KINDS = sectionKinds(INFODOC_SECTION_KINDS);
const TYPES = sectionKinds(INFODOC_SECTION_TYPES);
const ME = ids.actor;
const as = (role: WorkspaceRole | null = "modeler", ws: Partial<Workspace> = {}): WorkspaceAccess => {
  const a = access(role, { infodoc: true, ...ws });
  return a.member ? { ...a, member: { ...a.member, user_id: ME } } : a;
};
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const refusal = (r: { ok: boolean; error?: { message: string } }) => (r.ok ? null : r.error!.message);

const B1: BaselineRef = { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3501", name: "Stage 1", created_at: "2026-09-15T08:12:00.000Z" };
const B2: BaselineRef = { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3502", name: "Stage 2", created_at: "2026-10-15T08:12:00.000Z" };
const B3: BaselineRef = { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3503", name: "Stage 3", created_at: "2026-11-15T08:12:00.000Z" };
/** The workspace's live baselines, newest first (the list's order). */
const LIST = [B3, B2, B1];

const live = (preset: "dictionary" | "blank" = "dictionary") => ok(createDocument(makeCtx(ME), as(), { workspaceId: ids.ws, preset }, KINDS)).document;
const save = (doc: DocumentDefinition, input: Record<string, unknown>, list: readonly BaselineRef[] = LIST, who = as()) =>
  updateDocument(makeCtx(ME), who, doc, { workspaceId: ids.ws, documentId: doc.id, expectedVersion: doc.version, ...input }, KINDS, undefined, list);

describe("a document's source (S36-01, B3.2, Q7)", () => {
  it("switches from the live model to a baseline, to another and back, each a save with its version", () => {
    const d = live();
    const a = ok(save(d, { source: { kind: "baseline", baselineId: B1.id } })).document;
    expect(a).toMatchObject({ source_kind: "baseline", baseline_id: B1.id, version: d.version + 1 });
    const b = ok(save(a, { source: { kind: "baseline", baselineId: B2.id } })).document;
    expect(b).toMatchObject({ source_kind: "baseline", baseline_id: B2.id });
    expect(ok(save(b, { source: { kind: "live" } })).document).toMatchObject({ source_kind: "live", baseline_id: null });
  });

  it("refuses a baseline that is not live in the workspace (deleted, another workspace's, none) and leaves the style alone", () => {
    const d = live();
    expect(refusal(save(d, { source: { kind: "baseline", baselineId: B1.id } }, []))).toBe(BASELINE_TEXTS.gone);
    expect(refusal(save(d, { source: { kind: "baseline", baselineId: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599" } }))).toBe(BASELINE_TEXTS.gone);
    // Łukasz's answer 2: a switch never turns the draft mark on or off
    expect(ok(save(d, { source: { kind: "baseline", baselineId: B1.id } })).document.style.watermark).toBe(d.style.watermark);
    expect(refusal(save(d, { source: { kind: "live" } }))).toBe("Nothing to change.");
  });

  it("is refused in an archived workspace and to a reader of a shared document, as every save", () => {
    const d = live();
    expect(save(d, { source: { kind: "live" } }, LIST, as("modeler", archived)).ok).toBe(false);
    expect(save({ ...d, shared: true, author_id: ids.someoneElse }, { source: { kind: "baseline", baselineId: B1.id } }, LIST, as("reader")).ok).toBe(false);
  });

  it("checks a changes section's chosen baseline when it is chosen, and keeps one that is gone since", () => {
    const d0 = live("blank");
    const added = { ...d0, sections: [...d0.sections, { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3600", type: "changes", on: true, heading: null, newPage: true, options: { against: null } }] };
    const section = (against: string | null) => ({ section: { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3600", options: { against } } });
    const chose = ok(save(added, section(B2.id))).document;
    expect(chose.sections[1]!.options).toEqual({ against: B2.id });
    expect(refusal(save(added, section("01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599")))).toBe(BASELINE_TEXTS.gone);
    // B2 deleted since: another option's save of the same section keeps it
    expect(ok(save(chose, { section: { id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3600", on: false } }, [B1])).document.sections[1]!.options).toEqual({ against: B2.id });
  });
});

describe("the sign-off preset and documents from a baseline (S36-03, S36-01, S36-04)", () => {
  it("makes the sign-off package from the newest baseline, no draft mark, the PRD's sections in order", () => {
    const d = ok(createDocument(makeCtx(ME), as("reader"), { workspaceId: ids.ws, preset: "signoff" }, KINDS, ["01a0f9e9-2035-7b1a-8c35-5e1f0a7e3700"], LIST)).document;
    expect(d).toMatchObject({ name: "Sign-off package for the client", preset: "signoff", audience: "Client", source_kind: "baseline", baseline_id: B3.id, shared: false });
    expect(d.scope.mappings).toBe("all");
    expect(d.style.watermark).toBe(false);
    expect(d.sections.map((s) => s.type)).toEqual(["text", "conv", "overview", "ready", "diagrams", "dict", "s2t", "reqs", "trace", "dq", "sources", "classreg", "changes"]);
    expect(d.sections[0]!.options.body).toBe("Scope of this stage: …\n\nAssumptions: …\n\nOpen points: …");
    // the overview's figure: the first canvas, captioned in the document's language
    expect(d.sections[2]!.options.figures).toMatchObject([{ canvasId: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3700", caption: "Logical data model" }]);
    expect(d.sections.at(-1)!.options).toEqual({ against: null });
  });

  it("refuses the sign-off preset while the workspace has no baseline", () => {
    expect(refusal(createDocument(makeCtx(ME), as(), { workspaceId: ids.ws, preset: "signoff" }, KINDS, [], []))).toBe("Create a baseline first.");
  });

  it("names a document made from a baseline's row after it (answer 6) and refuses a baseline gone meanwhile", () => {
    const d = ok(createDocument(makeCtx(ME), as(), { workspaceId: ids.ws, preset: "signoff", baselineId: B1.id }, KINDS, [], LIST)).document;
    expect(d).toMatchObject({ name: "Documentation of “Stage 1”", source_kind: "baseline", baseline_id: B1.id });
    expect(refusal(createDocument(makeCtx(ME), as(), { workspaceId: ids.ws, preset: "signoff", baselineId: B1.id }, KINDS, [], [B2]))).toBe(BASELINE_TEXTS.gone);
  });

  it("makes a document from a comparison: the newer state as source, one changes section against the older (B4.6)", () => {
    const vsNow = ok(createChangesDocument(makeCtx(ME), as(), { workspaceId: ids.ws, olderId: B1.id, newerId: null }, KINDS, LIST)).document;
    expect(vsNow).toMatchObject({ name: "Changes since “Stage 1”", preset: "blank", source_kind: "live", baseline_id: null, audience: null });
    expect(vsNow.style.watermark).toBe(false);
    expect(vsNow.sections.map((s) => [s.type, s.options])).toEqual([["changes", { against: B1.id }]]);
    // either order in: the older is the start
    const between = ok(createChangesDocument(makeCtx(ME), as(), { workspaceId: ids.ws, olderId: B3.id, newerId: B1.id }, KINDS, LIST)).document;
    expect(between).toMatchObject({ name: "Changes since “Stage 1” to “Stage 3”", source_kind: "baseline", baseline_id: B3.id });
    expect(between.sections[0]!.options).toEqual({ against: B1.id });
    expect(refusal(createChangesDocument(makeCtx(ME), as(), { workspaceId: ids.ws, olderId: B1.id, newerId: B2.id }, KINDS, [B1]))).toBe(BASELINE_TEXTS.gone);
  });

  it("cuts a long comparison's name to a document's longest (F10)", () => {
    const long = (n: string, id: string): BaselineRef => ({ id, name: n.repeat(120), created_at: id === B1.id ? B1.created_at : B2.created_at });
    const d = ok(createChangesDocument(makeCtx(ME), as(), { workspaceId: ids.ws, olderId: B1.id, newerId: B2.id }, KINDS, [long("a", B2.id), long("b", B1.id)])).document;
    expect(d.name.length).toBeLessThanOrEqual(SHORT_TEXT_MAX);
    expect(d.name.startsWith("Changes since “bbb")).toBe(true);
  });

  it("counts a baseline's live documents, every author's (Q8)", () => {
    const rows = [
      { source_kind: "baseline", baseline_id: B1.id, deleted_at: null },
      { source_kind: "baseline", baseline_id: B1.id, deleted_at: null },
      { source_kind: "baseline", baseline_id: B1.id, deleted_at: "2026-11-20T10:00:00.000Z" },
      { source_kind: "baseline", baseline_id: B2.id, deleted_at: null },
      { source_kind: "live", baseline_id: null, deleted_at: null },
    ] as const;
    expect(documentsFromBaseline(rows, B1.id)).toBe(2);
    expect(documentsFromBaseline(rows, B3.id)).toBe(0);
  });
});

describe("which states a changes section compares (B4.1, B4.2, Q3)", () => {
  it("takes the previous baseline: for a live document the newest, for a baseline the next older in the list's order", () => {
    expect(changesPlan(null, null, LIST)).toEqual({ kind: "compare", older: B3, newer: null });
    expect(changesPlan(B2, null, LIST)).toEqual({ kind: "compare", older: B1, newer: B2 });
    expect(changesPlan(B1, null, LIST)).toEqual({ kind: "none" });
    expect(changesPlan(null, null, [])).toEqual({ kind: "none" });
  });

  it("orders two baselines of the same moment by the list (the id), never by a minute", () => {
    const same = { ...B2, id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3504", name: "Same moment", created_at: B2.created_at };
    // newest first: the time taken, then the id (newestBaselineFirst)
    const list = [B3, same, B2, B1];
    expect(changesPlan(same, null, list)).toEqual({ kind: "compare", older: B2, newer: same });
    expect(changesPlan(B2, null, list)).toEqual({ kind: "compare", older: B1, newer: B2 });
  });

  it("compares a chosen baseline with the document's state, the older first, and says when the chosen one is gone", () => {
    expect(changesPlan(null, B1.id, LIST)).toEqual({ kind: "compare", older: B1, newer: null });
    expect(changesPlan(B3, B1.id, LIST)).toEqual({ kind: "compare", older: B1, newer: B3 });
    // a chosen baseline newer than the source: the source is the start (answer 4: the heading names it)
    expect(changesPlan(B1, B3.id, LIST)).toEqual({ kind: "compare", older: B1, newer: B3 });
    expect(changesPlan(null, "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599", LIST)).toEqual({ kind: "gone" });
  });

  it("asks the server again only when the source, the scope or a Compared with changes (the re-ask key)", () => {
    const base = { ...live("blank"), sections: [{ id: "s1", type: "changes", on: true, heading: null, newPage: true, options: { against: null } }] } as DocumentDefinition;
    const key = changesRequestKey(base);
    expect(key).not.toBe("");
    expect(changesRequestKey({ ...base, name: "Another name" } as DocumentDefinition)).toBe(key);
    expect(changesRequestKey({ ...base, scope: { ...base.scope, mappings: "approved" } })).toBe(key);
    expect(changesRequestKey({ ...base, scope: { ...base.scope, projects: [ids.projectA] } })).not.toBe(key);
    expect(changesRequestKey({ ...base, source_kind: "baseline", baseline_id: B1.id })).not.toBe(key);
    expect(changesRequestKey({ ...base, sections: [{ ...base.sections[0]!, options: { against: B1.id } }] })).not.toBe(key);
    expect(changesRequestKey({ ...base, sections: [{ ...base.sections[0]!, on: false }] })).toBe("");
  });
});

/** A side of a comparison with only what the scope rule reads. */
function side(o: { entities: [string, "logical" | "dimensional"][]; inScope: string[]; attributes?: [string, string][]; mappings?: [string, string][]; tables?: string[]; columns?: [string, string][]; projects?: string[]; dimensionalOn?: boolean; dimensional?: boolean }): ChangesSide {
  const entities = o.entities.map(([id, model_level]) => ({ id, model_level }));
  const state = {
    snapshot: {
      projects: (o.projects ?? []).map((id) => ({ id })),
      requirements: [],
      model: {
        concepts: [],
        attributes: (o.attributes ?? []).map(([id, entity_id]) => ({ id, entity_id })),
        mappings: (o.mappings ?? []).map(([id, attribute_id]) => ({ id, attribute_id })),
        relationships: [{ id: "r1", from_entity_id: "e1", to_entity_id: "e2" }],
        sourceColumns: (o.columns ?? []).map(([id, source_table_id]) => ({ id, source_table_id })),
      },
    },
    entity: new Map(entities.map((e) => [e.id, e])),
    modules: { dimensionalOn: o.dimensionalOn ?? true },
  } as unknown as DocumentState;
  const scope: SectionScope = { entityIds: new Set(o.inScope), tableIds: new Set(o.tables ?? []), canvasIds: new Set(), logical: true, dimensional: o.dimensional ?? true, mappings: "all" };
  return { state, scope };
}
const change = (kind: BaselineChange["kind"], id: string, what: BaselineChange["change"] = "changed"): BaselineChange => ({ kind, change: what, id, label: id, fields: [] });

describe("the changes in the document's scope, on either side (B4.3, Q4)", () => {
  const scope: DocumentScope = { projects: ["p1"], concepts: [], logical: true, dimensional: true, mappings: "approved" };

  it("keeps an entity in scope on either side: one removed from a scoped project still shows", () => {
    const older = side({ entities: [["e1", "logical"], ["e2", "logical"]], inScope: ["e1", "e2"], projects: ["p1"] });
    const newer = side({ entities: [["e2", "logical"], ["e3", "logical"]], inScope: ["e2"], projects: ["p1"] });
    const kept = changesInScope([change("entity", "e1", "removed"), change("entity", "e2"), change("entity", "e3", "added")], scope, [older, newer]);
    expect(kept.map((c) => c.id)).toEqual(["e1", "e2"]);
  });

  it("reads attributes and mappings by their entity, a relationship by either end, columns by their table", () => {
    const s = side({ entities: [["e1", "logical"], ["e2", "logical"], ["e9", "logical"]], inScope: ["e1"], attributes: [["a1", "e1"], ["a9", "e9"]], mappings: [["m1", "a1"], ["m9", "a9"]], tables: ["t1"], columns: [["c1", "t1"], ["c9", "t9"]], projects: ["p1"] });
    const kept = changesInScope(
      [change("attribute", "a1"), change("attribute", "a9"), change("mapping", "m1"), change("mapping", "m9"), change("relationship", "r1"), change("source_table", "t1"), change("source_table", "t9"), change("source_column", "c1"), change("source_column", "c9")],
      scope,
      [s, s],
    );
    expect(kept.map((c) => c.id)).toEqual(["a1", "m1", "r1", "t1", "c1"]);
  });

  it("leaves a level out of scope, the dimensional one also while its module is off", () => {
    const s = side({ entities: [["e1", "dimensional"]], inScope: ["e1"], projects: ["p1"], dimensionalOn: false });
    expect(changesInScope([change("entity", "e1")], scope, [s, s])).toEqual([]);
    const on = side({ entities: [["e1", "dimensional"]], inScope: ["e1"], projects: ["p1"] });
    const off = side({ entities: [["e1", "dimensional"]], inScope: ["e1"], projects: ["p1"], dimensional: false });
    expect(changesInScope([change("entity", "e1")], scope, [off, off])).toEqual([]);
    expect(changesInScope([change("entity", "e1")], scope, [on, on])).toHaveLength(1);
  });
});

const tinyState = (source: DocumentState["source"], changes: (a: string | null) => SectionChanges): DocumentState =>
  ({
    snapshot: { workspace: { name: "W", client_name: null, doc_language: "en" }, organization: { name: "Org" }, people: [], model: { concepts: [], entities: [], attributes: [], sourceTables: [], sourceColumns: [], mappings: [], mappingInputs: [] }, projects: [], projectCanvases: [], canvases: [], canvasItems: [] },
    source,
    changes,
  }) as unknown as DocumentState;
const CHANGES: BaselineChange[] = [
  { kind: "entity", change: "added", id: "e1", label: "Customer", fields: [] },
  { kind: "attribute", change: "changed", id: "a1", label: "Customer.number", fields: [{ field: "type", before: "string(10)", after: "string(20)" }, { field: "definition", long: true }] },
];

describe("the changes section's heading and body (S36-02, S36-05)", () => {
  const input = (r: SectionChanges, language: "en" | "pl" | "de" = "en") => ({ state: tinyState({ kind: "live" }, () => r), options: { against: null }, language }) as never;
  const list: SectionChanges = { kind: "list", older: B1, newer: null, changes: CHANGES };

  it("names the older state in the heading in the document's language, '…' while there is none", () => {
    expect(changesHeading(input(list))).toBe("Changes since “Stage 1”");
    expect(changesHeading(input(list, "pl"))).toBe("Zmiany od “Stage 1”");
    expect(changesHeading(input({ kind: "none" }))).toBe("Changes since …");
  });

  it("draws Added, Changed and Removed as tables of Kind, Item, What changed, empty groups left out, in the document's words", () => {
    const nodes = buildChanges(input(list, "pl"));
    expect(nodes.filter((n) => n.kind === "heading").map((n) => (n as { text: string }).text)).toEqual(["Dodane (1)", "Zmienione (1)"]);
    const table = nodes[3] as unknown as { columns: { label: string }[]; rows: { cells: { text: string }[][] }[] };
    expect(table.columns.map((c) => c.label)).toEqual(["Rodzaj", "Element", "Co się zmieniło"]);
    expect(table.rows[0]!.cells.map((c) => c.map((r) => r.text).join(""))).toEqual(["Atrybut", "Customer.number", "typ: string(10) → string(20), definicja (zmieniono)"]);
  });

  it("says why there is no table: nothing differs, nothing older, the chosen baseline gone", () => {
    const line = (r: SectionChanges) => (buildChanges(input(r))[0] as unknown as { runs: { text: string }[] }).runs[0]!.text;
    expect(line({ ...list, changes: [] } as SectionChanges)).toBe("No changes.");
    expect(line({ kind: "none" })).toBe("Nothing to compare with yet.");
    expect(line({ kind: "gone" })).toBe("The baseline this section compared with no longer exists.");
    expect(line({ kind: "pending" })).toBe("…");
  });
});

describe("a document from a baseline: the frame, the cover, the gone baseline and Markdown (S36-01, S36-04, S36-05)", () => {
  const definition = (watermark: boolean, language: "en" | "pl" | "de" = "en") => ({
    name: "Doc",
    author_id: ME,
    scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" as const },
    cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null },
    style: { ...live().style, watermark, language },
    sections: [{ id: "s1", type: "changes", on: true, heading: null, newPage: true, options: { against: null } }],
  });
  const time = (iso: string) => iso.slice(0, 16).replace("T", " ");
  const fromB1 = tinyState({ kind: "baseline", ...B1 }, () => ({ kind: "list", older: B1, newer: null, changes: CHANGES }));

  it("names the baseline in the footer and on the cover, in the document's language and the reader's time", () => {
    const tree = buildDocument({ definition: definition(false), state: fromB1, types: TYPES, date: "2026-11-25", time });
    expect(tree.frame.footerLeft).toBe("W · Baseline “Stage 1” of 2026-09-15 08:12");
    expect(tree.cover.rows.find((r) => r.key === "state")!.value).toBe("Baseline “Stage 1” of 2026-09-15 08:12");
    expect(buildDocument({ definition: definition(false, "pl"), state: fromB1, types: TYPES, date: "2026-11-25", time }).frame.footerLeft).toBe("W · Baseline „Stage 1” z dnia 2026-09-15 08:12");
    // the default is this runtime's time zone
    expect(buildDocument({ definition: definition(false), state: fromB1, types: TYPES, date: "2026-11-25" }).frame.footerLeft).toContain(localMinute(B1.created_at));
  });

  it("writes the draft mark as the baseline's when it is on, nothing when it is off", () => {
    expect(buildDocument({ definition: definition(true), state: fromB1, types: TYPES, date: "2026-11-25", time }).frame.watermark).toBe("DRAFT · baseline Stage 1");
    expect(buildDocument({ definition: definition(true, "de"), state: fromB1, types: TYPES, date: "2026-11-25", time }).frame.watermark).toBe("ENTWURF · Baseline Stage 1");
    expect(buildDocument({ definition: definition(false), state: fromB1, types: TYPES, date: "2026-11-25", time }).frame.watermark).toBe("");
  });

  it("builds nothing from a baseline that is gone and says so (never the live model)", () => {
    const tree = buildDocument({ definition: definition(true), state: tinyState({ kind: "gone" }, () => ({ kind: "pending" })), types: TYPES, date: "2026-11-25", time });
    expect(tree.missing).toBe("This document points to a baseline that no longer exists.");
    expect(tree.sections).toEqual([]);
    expect(tree.contents.entries).toEqual([]);
  });

  it("titles a changes section by its older state and writes Markdown's front matter for a baseline", () => {
    const tree = buildDocument({ definition: definition(false), state: fromB1, types: TYPES, date: "2026-11-25", time });
    expect(tree.sections[0]!.heading).toBe("Changes since “Stage 1”");
    const md = documentMarkdown({ tree, name: "Doc", generated: "2026-11-25T10:00+01:00" });
    expect(md).toMatch(/\nsource: "baseline"\nbaseline: "Stage 1"\nbaseline_taken: "2026-09-15T\d\d:12[+-]\d\d:\d\d"\ngenerated: /);
    expect(md).not.toContain("live model");
    const liveTree = buildDocument({ definition: definition(false), state: tinyState({ kind: "live" }, () => ({ kind: "none" })), types: TYPES, date: "2026-11-25" });
    expect(documentMarkdown({ tree: liveTree, name: "Doc", generated: "2026-11-25T10:00+01:00" })).toContain('\nsource: "live model"\ngenerated: ');
  });
});
