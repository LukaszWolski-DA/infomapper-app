// Benchmark (slice 25, step 3; Q-P1: reference figures only, no bar; not part of `npm test`): building a whole document's
// content tree in Node, on "Performance test" and on the demo. A full document: Text, the Data dictionary with every
// field and column, the Source-to-target mapping with every column and the attributes that have no mapping, and
// InfoCube's Dimensional model with every option (skipped where InfoCube is off). Timed apart: the snapshot from the
// rows (what `store.snapshot` does after reading the file), the document state (the indexes), and the tree. One
// warm-up, then 9 rounds; median, fastest, slowest.
// Run: npx tsx scripts/bench-documents.ts

import { performance } from "node:perf_hooks";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "../src/compose/documents";
import { addFullDemoData } from "../src/compose/seed";
import type { DevDb } from "../src/data/local/schema";
import { buildSeed, SEED_IDS } from "../src/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "../src/data/local/seed-large";
import type { DocNode } from "../src/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "../src/domain/model/workspace-model";
import type { ModuleTable } from "../src/domain/types";
import { buildDocument } from "../src/modules/infodocumenter/domain/document";

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

const SECTIONS = [
  { id: "00000000-0000-7000-8000-000000000001", type: "text", on: true, options: { heading: null, body: "Introduction.\n\nSecond paragraph." } },
  {
    id: "00000000-0000-7000-8000-000000000002",
    type: "dict",
    on: true,
    options: { entity: ["stereotype", "definition", "coverage", "requirements", "relationships"], columns: ["attribute", "type", "keys", "nullable", "pii", "definition", "mappedFrom", "calculation", "requirements"] },
  },
  {
    id: "00000000-0000-7000-8000-000000000003",
    type: "s2t",
    on: true,
    options: { columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck", "note", "requirements"], group: "entity", unmapped: true },
  },
  { id: "00000000-0000-7000-8000-000000000004", type: "cube.dim", on: true, options: { facts: true, dimensions: true, dimensionDefinitions: true, measures: true, relationships: true, feeds: true } },
];

const count = (nodes: readonly DocNode[]) => ({
  nodes: nodes.length,
  rows: nodes.reduce((n, x) => n + (x.kind === "table" ? x.rows.length : 0), 0),
});

function report(name: string, db: DevDb, ws: string) {
  const rows = db as unknown as StoredRows;
  const modules = Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never;
  const snapshot = () => workspaceSnapshotOf<ModuleTable>(rows, ws, modules)!;
  const s = snapshot();
  const definition = {
    name: "Full document",
    author_id: SEED_IDS.userLukasz,
    scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" as const },
    cover: { title: null, subtitle: null, version: "1.0", status: null, preparedBy: null },
    sections: SECTIONS,
  };
  const state = documentStateFor(s);
  const tree = buildDocument({ definition, state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-12" });
  console.log(
    `${name}: ${s.model.entities.length} entities, ${s.model.attributes.length} attributes, ${s.model.mappings.length} mappings, ${s.model.relationships.length} relationships; ` +
      tree.sections.map((x) => `${x.type} ${JSON.stringify(count(x.nodes))}`).join(", ") +
      (tree.skipped.length ? `; skipped: ${tree.skipped.map((x) => x.type).join(", ")}` : "") +
      `; ${JSON.stringify(tree).length.toLocaleString("en")} bytes as JSON`,
  );
  time("snapshot from the rows (after the file's read)", snapshot);
  time("document state (requirement index with feeds, derivations, stereotypes)", () => documentStateFor(s));
  time("the tree from the state", () => buildDocument({ definition, state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-12" }));
  time("all three", () => buildDocument({ definition, state: documentStateFor(snapshot()), types: DOCUMENT_SECTION_TYPES, date: "2026-11-12" }));
}

const large = buildSeed();
addLargeWorkspace(large, new Date().toISOString());
report("Performance test", large, LARGE_IDS.workspace);

const demo = buildSeed();
addFullDemoData(demo);
report("Demo (Retail Co – DWH, the star)", demo, SEED_IDS.wsRetailDwh);
