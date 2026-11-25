// Slice 36 (S36-01 to S36-06, step 1's Q1 to Q4): documents from the demo's "Stage 1 sign-off" through the composition
// root and the local adapter, on a fresh demo seed in a temporary file (never a JSON file of someone's): the model read
// from the content alone, the sign-off preset built from it, the comparison with Now made on the server and narrowed to
// a scope, a label canvas not drawn, the canvases a baseline's figures are made from, and the words in three languages.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { documentCanvases, documentModel } from "@/compose/document-model";
import { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addSeedDemoData, DEMO_BASELINE } from "@/compose/seed";
import { STORE_SCHEMA } from "@/compose/tables";
import type { DataStore } from "@/data";
import { writeDb } from "@/data/local/file";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { snapshotOfContent } from "@/domain/baseline/content";
import { COMPARE_WORDS } from "@/domain/baseline/words";
import type { DocumentSource, SectionChanges } from "@/domain/document/state";
import { newFigure } from "@/domain/document/figure-entry";
import type { Workspace } from "@/domain/types";
import { createDocument } from "@/modules/infodocumenter/domain/commands";
import { buildDocument } from "@/modules/infodocumenter/domain/document";
import { LABELS } from "@/modules/infodocumenter/domain/labels";
import { documentMarkdown } from "@/modules/infodocumenter/domain/markdown";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";
import { makeCtx } from "@/domain/__fixtures__/domain";

let dir: string;
let store: DataStore;
let workspace: Workspace;
const WS = SEED_IDS.wsRetailDwh;

beforeAll(async () => {
  const db = buildSeed();
  addSeedDemoData(db);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-s36-"));
  const file = path.join(dir, "db.json");
  await writeDb(file, db);
  store = createLocalDataStore(file, STORE_SCHEMA);
  workspace = (await store.workspaces.get(WS))!;
}, 60_000);
afterAll(() => dir && fs.rmSync(dir, { recursive: true, force: true }));

const changesSection = (against: string | null = null) => ({ id: "01a0f9e9-2036-7b1a-8c35-5e1f0a7e3601", type: "changes", on: true, heading: null, newPage: true, options: { against } });
async function demoDocument(over: Partial<DocumentDefinition> = {}): Promise<DocumentDefinition> {
  const d = (await store.modules.list(WS, "document_definition")).find((x) => x.shared)!;
  return { ...d, ...over };
}
const lookup = (changes: Readonly<Record<string, SectionChanges>>) => (a: string | null): SectionChanges => changes[a ?? ""] ?? { kind: "pending" };
const time = (iso: string) => iso.slice(0, 16).replace("T", " ");

describe("a document's model from its source (Q1, S36-06)", () => {
  it("reads a baseline's content alone: what came later in the live model is not in it", async () => {
    const live = (await documentModel(store, workspace, await demoDocument()))!;
    const from = (await documentModel(store, workspace, await demoDocument({ source_kind: "baseline", baseline_id: DEMO_BASELINE.id })))!;
    expect(live.source).toEqual({ kind: "live" });
    expect(from.source).toEqual({ kind: "baseline", id: DEMO_BASELINE.id, name: DEMO_BASELINE.name, created_at: DEMO_BASELINE.at });
    const has = (m: typeof live, name: string) => {
      const customer = m.snapshot.model.entities.find((e) => e.name === "Customer" && e.model_level === "logical")!;
      return m.snapshot.model.attributes.some((a) => a.entity_id === customer.id && a.name === name);
    };
    expect(has(live, "segment_code")).toBe(true);
    expect(has(from, "segment_code")).toBe(false);
    expect(from.snapshot.requirements.some((r) => r.key === "REQ-105")).toBe(false);
    // the workspace's name and people are today's; labels are not in a content
    expect(from.snapshot.workspace.name).toBe(workspace.name);
    expect(from.snapshot.people.length).toBeGreaterThan(0);
    expect(from.snapshot.labels).toEqual([]);
    expect(from.baselines.map((b) => b.id)).toEqual([DEMO_BASELINE.id]);
  });

  it("answers gone for a baseline that is not live, with an empty model (never the live one)", async () => {
    const gone = (await documentModel(store, workspace, await demoDocument({ source_kind: "baseline", baseline_id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599" })))!;
    expect(gone.source).toEqual({ kind: "gone" });
    expect(gone.snapshot.model.entities).toEqual([]);
    expect(gone.changes).toEqual({});
  });
});

describe("the comparison on the server (Q3, S36-02)", () => {
  it("compares a live document with the previous baseline: S35-04's four changes", async () => {
    const d = await demoDocument({ sections: [changesSection()] });
    const m = (await documentModel(store, workspace, d))!;
    const r = m.changes[""]!;
    expect(r.kind).toBe("list");
    if (r.kind !== "list") return;
    expect(r.older.name).toBe(DEMO_BASELINE.name);
    expect(r.newer).toBeNull();
    expect(r.changes.map((c) => `${c.change} ${c.kind}`).sort()).toEqual(["added attribute", "added requirement", "changed mapping", "changed source_column"]);
    expect(r.changes.find((c) => c.kind === "attribute")!.label).toBe("Customer.segment_code");
    // built in the document's language
    const tree = buildDocument({ definition: d, state: documentStateFor(m.snapshot, { source: m.source, changes: lookup(m.changes) }), types: DOCUMENT_SECTION_TYPES, date: "2026-11-25" });
    expect(tree.sections[0]!.heading).toBe(`Changes since “${DEMO_BASELINE.name}”`);
  });

  it("has nothing older for a document from the oldest baseline, and says when a chosen one is gone", async () => {
    const from = (await documentModel(store, workspace, await demoDocument({ source_kind: "baseline", baseline_id: DEMO_BASELINE.id, sections: [changesSection()] })))!;
    expect(from.changes[""]).toEqual({ kind: "none" });
    const chosen = (await documentModel(store, workspace, await demoDocument({ sections: [changesSection("01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599")] })))!;
    expect(chosen.changes["01a0f9e9-2035-7b1a-8c35-5e1f0a7e3599"]).toEqual({ kind: "gone" });
    // the source itself chosen: nothing differs
    const same = (await documentModel(store, workspace, await demoDocument({ source_kind: "baseline", baseline_id: DEMO_BASELINE.id, sections: [changesSection(DEMO_BASELINE.id)] })))!;
    expect(same.changes[DEMO_BASELINE.id]).toMatchObject({ kind: "list", changes: [] });
  });

  it("narrows the changes to the document's scope: a subset, every one in scope with no project chosen", async () => {
    const whole = (await documentModel(store, workspace, await demoDocument({ sections: [changesSection()] })))!.changes[""] as Extract<SectionChanges, { kind: "list" }>;
    const project = (await documentModel(store, workspace, await demoDocument({ sections: [changesSection()], scope: { projects: [SEED_IDS.projOrderManagement], concepts: [], logical: true, dimensional: true, mappings: "all" } })))!.changes[""] as Extract<SectionChanges, { kind: "list" }>;
    expect(project.changes.every((c) => whole.changes.some((w) => w.id === c.id))).toBe(true);
    const neither = (await documentModel(store, workspace, await demoDocument({ sections: [changesSection()], scope: { projects: [], concepts: [], logical: false, dimensional: false, mappings: "all" } })))!.changes[""] as Extract<SectionChanges, { kind: "list" }>;
    // no level in scope: only the requirements (every one where nothing narrows) and the source rows stay
    expect(neither.changes.some((c) => c.kind === "attribute" || c.kind === "mapping")).toBe(false);
  });
});

describe("the sign-off package from Stage 1 sign-off (S36-01, S36-03, S36-04)", () => {
  it("is made from the newest baseline with the baseline's canvases, and built from its content alone", async () => {
    const refs = (await store.baselines.list(WS)).map((b) => ({ id: b.id, name: b.name, created_at: b.created_at }));
    const canvases = await documentCanvases(store, WS, { baselineId: DEMO_BASELINE.id }, []);
    const access = { workspace, member: (await store.workspaces.getMember(WS, SEED_IDS.userLukasz))! };
    const made = createDocument(makeCtx(SEED_IDS.userLukasz), access, { workspaceId: WS, preset: "signoff" }, DOCUMENT_SECTION_KINDS, canvases.order, refs);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const d = made.value.document;
    expect(d).toMatchObject({ source_kind: "baseline", baseline_id: DEMO_BASELINE.id });
    const diagrams = d.sections.find((s) => s.type === "diagrams")!;
    expect((diagrams.options.figures as { canvasId: string }[]).map((f) => f.canvasId)).toEqual(canvases.order);
    const m = (await documentModel(store, workspace, d))!;
    const tree = buildDocument({ definition: d, state: documentStateFor(m.snapshot, { source: m.source, changes: lookup(m.changes) }), types: DOCUMENT_SECTION_TYPES, date: "2026-11-25", time });
    expect(tree.frame.footerLeft).toBe(`${workspace.name} · Baseline “${DEMO_BASELINE.name}” of ${time(DEMO_BASELINE.at)}`);
    expect(tree.frame.watermark).toBe("");
    expect(tree.sections.map((s) => s.type)).toEqual(["text", "conv", "overview", "ready", "diagrams", "dict", "s2t", "reqs", "trace", "dq", "sources", "classreg", "changes"]);
    expect(tree.figures.length).toBeGreaterThan(0);
    const md = documentMarkdown({ tree, name: d.name, generated: "2026-11-25T10:00+01:00" });
    expect(md).toContain(`baseline: "${DEMO_BASELINE.name}"`);
    expect(md).not.toContain("REQ-105");
    expect(md).toContain("Nothing to compare with yet.");
  });

  it("does not draw a label canvas from a baseline (F5), and leaves it out of the figures a baseline's document is made with", async () => {
    const content = (await store.baselines.content(WS, DEMO_BASELINE.id))!;
    const canvas = content.canvases[0]!;
    const labelled = { ...content, canvases: content.canvases.map((c) => (c.id === canvas.id ? { ...c, live_label_id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3777" } : c)) };
    const live = (await store.snapshot(WS, DOCUMENT_TABLES))!;
    const snapshot = snapshotOfContent(labelled, live, DOCUMENT_TABLES);
    const source: DocumentSource = { kind: "baseline", id: DEMO_BASELINE.id, name: DEMO_BASELINE.name, created_at: DEMO_BASELINE.at };
    const d = await demoDocument({ sections: [{ id: "01a0f9e9-2036-7b1a-8c35-5e1f0a7e3602", type: "figure", on: true, heading: null, newPage: false, options: { figures: [newFigure("f1", canvas.id)] } }] });
    const tree = buildDocument({ definition: d, state: documentStateFor(snapshot, { source }), types: DOCUMENT_SECTION_TYPES, date: "2026-11-25" });
    expect(JSON.stringify(tree.sections[0]!.nodes)).toContain(`${canvas.name}: label canvases are not drawn from a baseline.`);
    // the live model draws the same canvas as before
    const liveTree = buildDocument({ definition: d, state: documentStateFor(live), types: DOCUMENT_SECTION_TYPES, date: "2026-11-25" });
    expect(liveTree.figures).toHaveLength(1);
  });
});

describe("the words in three languages (Q5, Łukasz's answer 9)", () => {
  const shape = (v: unknown): unknown =>
    typeof v === "function" ? "fn" : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])])) : typeof v;

  it("has every comparison word in Polish and German, with the same keys as English", () => {
    expect(shape(COMPARE_WORDS.pl)).toEqual(shape(COMPARE_WORDS.en));
    expect(shape(COMPARE_WORDS.de)).toEqual(shape(COMPARE_WORDS.en));
    for (const l of ["pl", "de"] as const) for (const [k, v] of Object.entries(COMPARE_WORDS[l].fields)) expect(v, `${l} ${k}`).not.toBe("");
  });

  it("takes InfoDocumenter's own word wherever its labels name the same closed value", () => {
    for (const l of ["pl", "de"] as const) {
      const w = COMPARE_WORDS[l].closed;
      const t = LABELS[l];
      expect(w.mapping_status).toEqual({ draft: t.draft, review: t.review, approved: t.approved });
      expect(w.mapping_kind).toEqual({ direct: t.direct, transform: t.transform });
      expect(w.requirement_kind).toEqual({ need: t.k_need, data: t.k_data, business_rule: t.k_business_rule, dq_rule: t.k_dq_rule, non_functional: t.k_non_functional });
      expect(w.requirement_status).toEqual({ draft: t.st_draft, agreed: t.st_agreed, implemented: t.st_implemented, verified: t.st_verified });
      expect(w.requirement_priority).toEqual({ must: t.pr_must, should: t.pr_should, could: t.pr_could, wont: t.pr_wont });
      expect(w.requirement_severity).toEqual({ warn: t.sev_warn, block: t.sev_block });
    }
  });

  it("has slice 36's document labels in all three languages", () => {
    for (const key of ["bl", "wmBl", "t_changes", "t_changesType", "item", "what", "noChanges", "noBase", "blGone", "missing", "labelCanvas", "figLogical"] as const)
      for (const l of ["en", "pl", "de"] as const) expect(LABELS[l][key], `${l} ${key}`).toBeTruthy();
  });
});
