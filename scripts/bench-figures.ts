// Benchmark (slice 27, step 3; Q3: reference figures only, no bar; not part of `npm test`, run on demand): a document with
// figures in Node: the longest preset with Diagrams (the business dictionary, its figures made from the scope's canvases
// as New document makes them) on "Performance test" and the demo, built in memory from the seed (never
// .data/dev-db.json): the snapshot, the state, the tree with and without Diagrams' figures, the figures' share, each
// SVG's size. One warm-up, then 9 rounds; median, fastest, slowest. The editor's figures in the browser are
// `e2e/slice-27/S27-10-figures.spec.ts` (MEASURE=1).
// Run: npx tsx scripts/bench-figures.ts

import { performance } from "node:perf_hooks";
import { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "../src/compose/documents";
import { addFullDemoData } from "../src/compose/seed";
import type { DevDb } from "../src/data/local/schema";
import { buildSeed, SEED_IDS } from "../src/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "../src/data/local/seed-large";
import type { DocNode } from "../src/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "../src/domain/model/workspace-model";
import type { ModuleTable } from "../src/domain/types";
import { buildDocument } from "../src/modules/infodocumenter/domain/document";
import { diagramCanvases } from "../src/modules/infodocumenter/domain/figures";
import { presetOf, presetSections } from "../src/modules/infodocumenter/domain/presets";
import { defaultStyle } from "../src/modules/infodocumenter/domain/style";

const ROUNDS = 9;
const ms = (v: number) => `${v.toFixed(1)} ms`;
function time(label: string, run: () => unknown): number {
  run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`  ${label}: median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}`);
  return median;
}
const figuresIn = (nodes: readonly DocNode[]): { svg: string; parts: number }[] =>
  nodes.flatMap((x) => (x.kind === "figure" ? [{ svg: x.figure.svg, parts: x.figure.parts.length }] : x.kind === "group" ? figuresIn(x.nodes) : []));

function report(name: string, db: DevDb, ws: string) {
  const rows = db as unknown as StoredRows;
  const modules = Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never;
  const snapshot = () => workspaceSnapshotOf<ModuleTable>(rows, ws, modules)!;
  const s = snapshot();
  const workspace = db.workspace.find((w) => w.id === ws)!;
  const canvases = diagramCanvases(s.projects, s.projectCanvases, [], s.canvases);
  let n = 0;
  const id = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const sections = presetSections(presetOf("dictionary"), DOCUMENT_SECTION_KINDS.values(), workspace, id, canvases);
  const without = sections.map((x) => (x.type === "diagrams" ? { ...x, options: { ...x.options, figures: [] } } : x));
  const definition = (list: typeof sections) => ({
    name: "Data dictionary for the business",
    author_id: SEED_IDS.userLukasz,
    scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "approved" as const },
    cover: { title: null, subtitle: null, version: "1.0", status: null, preparedBy: null },
    style: defaultStyle(),
    sections: list,
  });
  const state = documentStateFor(s);
  const tree = buildDocument({ definition: definition(sections), state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-15" });
  const figs = tree.sections.flatMap((x) => figuresIn(x.nodes));
  console.log(
    `${name}: ${s.model.entities.length} entities, ${s.canvasItems.length} cards on ${s.canvases.length} canvases; Diagrams: ${figs.length} figures (${figs.reduce((a, f) => a + f.parts, 0)} parts), ` +
      `SVG ${figs.map((f) => `${(f.svg.length / 1024).toFixed(1)} KB`).join(", ")}; tree ${(JSON.stringify(tree).length / 1024).toFixed(1)} KB as JSON`,
  );
  time("snapshot from the rows", snapshot);
  time("document state", () => documentStateFor(s));
  const withF = time("the tree, with Diagrams' figures", () => buildDocument({ definition: definition(sections), state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-15" }));
  const withoutF = time("the tree, Diagrams without figures", () => buildDocument({ definition: definition(without), state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-15" }));
  console.log(`  the figures' share of the tree: ${ms(withF - withoutF)}`);
}

const large = buildSeed();
addLargeWorkspace(large, new Date().toISOString());
report("Performance test", large, LARGE_IDS.workspace);
const demo = buildSeed();
addFullDemoData(demo);
report("Demo (Retail Co – DWH, the star)", demo, SEED_IDS.wsRetailDwh);
