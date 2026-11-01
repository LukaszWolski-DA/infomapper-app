// Benchmark (slice 12b, step 2; PRD item 3 and section 6; step 1, F1, F2, F4, F5, F7; not part of `npm test`): what
// the project home and the workspace home do on the server today, split, and what the thumbnails would add, on three
// data sets: the seed (Order management), "Performance test" and "Performance test – 20 canvases". The page's reads go
// through the same store calls as the pages (`page.tsx`, `loadProjectView`, `loadShellFor`, copied here, since
// `server-only` modules cannot be imported outside Next.js); the thumbnails are `scripts/lib/thumbnail-draft.ts` with
// both height rules, and their bytes in the HTML and the RSC payload for four ways of writing them. The data file is
// its own (`.data/bench-thumbnails.json`, made from the seed each run), never `.data/dev-db.json`.
// One warm-up, then ROUNDS; median, fastest, slowest. Reported, not a gate.
// Run: npx tsx scripts/bench-thumbnails.ts

import path from "node:path";
import { performance } from "node:perf_hooks";
import { projectOpenNotes, projectRequirements, projectStats, workspaceStats } from "../src/app/_panels/stats";
import { resetDevData, seedLargeData } from "../src/data/local/dev-data";
import { removeDb } from "../src/data/local/file";
import { LARGE_IDS } from "../src/data/local/seed-large";
import { SEED_IDS } from "../src/data/local/seed";
import { createLocalDataStore } from "../src/data/local/store";
import type { DataStore } from "../src/data/ports";
import type { Uuid } from "../src/domain/ids";
import { projectLabels, type ProjectLabelContext } from "../src/domain/model/labels";
import { buildRequirementIndex } from "../src/domain/model/requirement-index";
import { modelConsistency } from "../src/domain/source-changes/consistency";
import type { CanvasItem, WorkspaceModel } from "../src/domain/types";
import { addManyCanvases, MANY_PROJECT_ID } from "./lib/many-canvases";
import { bytesOf, kindsOf, thumbIndex, thumbnail, type HeightRule } from "./lib/thumbnail-draft";

const ROUNDS = Number(process.env.ROUNDS ?? 9);
const FILE = path.resolve(".data", "bench-thumbnails.json");
const USER = SEED_IDS.userLukasz;

type Timings = Record<string, number>;

async function timed<T>(t: Timings, label: string, run: () => Promise<T> | T): Promise<T> {
  const s = performance.now();
  const r = await run();
  t[label] = (t[label] ?? 0) + performance.now() - s;
  return r;
}

/** `page.tsx`'s labelContext. */
function labelContext(model: WorkspaceModel, items: readonly CanvasItem[]): ProjectLabelContext {
  const mappingEnds = new Map<Uuid, { attributeId: Uuid; columnIds: Uuid[] }>(model.mappings.map((m) => [m.id, { attributeId: m.attribute_id, columnIds: [] }]));
  for (const i of model.mappingInputs) mappingEnds.get(i.mapping_id)?.columnIds.push(i.source_column_id);
  return {
    entitiesHere: new Set(items.flatMap((i) => (i.entity_id ? [i.entity_id] : []))),
    tablesHere: new Set(items.flatMap((i) => (i.source_table_id ? [i.source_table_id] : []))),
    entityOfAttribute: new Map(model.attributes.map((a) => [a.id, a.entity_id])),
    tableOfColumn: new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id])),
    mappingEnds,
  };
}

/** `loadShellFor`'s store calls (the session and cookies aside). */
async function shellReads(store: DataStore, ws: Uuid) {
  const workspace = await store.workspaces.get(ws);
  await store.workspaces.getMember(ws, USER);
  const [, mine, , projects] = await Promise.all([store.organizations.listForUser(USER), store.workspaces.listForUser(USER), store.organizations.listMembershipsOfUsers([USER]), store.projects.list(ws)]);
  await Promise.all(mine.filter((w) => w.organization_id === workspace!.organization_id).map((w) => store.workspaces.getMember(w.id, USER)));
  return Promise.all(projects.map(async (p) => ({ id: p.id, links: await store.canvases.listLinksOfProject(ws, p.id) })));
}

/** The project home's server work, split; with the thumbnails of every canvas when `rule` is given. */
async function projectHome(store: DataStore, ws: Uuid, projectId: Uuid, rule: HeightRule | null, t: Timings) {
  await timed(t, "shell reads", () => shellReads(store, ws));
  // loadProjectView
  const [, , , , canvases, links, items0, labels0] = await timed(t, "project view reads", () =>
    Promise.all([store.workspaces.get(ws), store.workspaces.getMember(ws, USER), store.projects.get(ws, projectId), store.projects.list(ws), store.canvases.list(ws), store.canvases.listLinksOfProject(ws, projectId), store.canvasItems.list(ws), store.labels.list(ws)]),
  );
  void items0; void labels0;
  await timed(t, "listLinksOfCanvas per canvas", async () => {
    for (const c of canvases) await store.canvases.listLinksOfCanvas(ws, c.id);
  });
  const canvasIds = links.map((l) => l.canvas_id);
  // page.tsx
  const [model, items, labels, labelLinks, pins, notes, frames, , requirements, requirementLinks, sourceChanges] = await timed(t, "page reads", () =>
    Promise.all([store.model.load(ws), store.canvasItems.list(ws), store.labels.list(ws), store.labels.listLinks(ws), store.labels.listPins(ws), store.notes.list(ws), store.frames.list(ws), store.canvases.list(ws), store.requirements.list(ws), store.requirements.listLinks(ws), store.model.listChanges(ws), store.undoHistory.get(ws, USER)]),
  );
  await timed(t, "stats", () => projectStats(model, items, canvasIds));
  const itemsOf = (ids: readonly Uuid[]) => items.filter((i) => ids.includes(i.canvas_id));
  const pinned = new Set(pins.filter((p) => p.project_id === projectId).map((p) => p.label_id));
  await timed(t, "labels (project)", () => projectLabels(labels, labelLinks, pinned, labelContext(model, itemsOf(canvasIds))));
  await timed(t, "labels per canvas (usedOn)", () => canvasIds.map((id) => projectLabels(labels, labelLinks, new Set(), labelContext(model, itemsOf([id])))));
  const index = await timed(t, "requirement index", () => buildRequirementIndex(requirements, requirementLinks, model));
  const reqs = await timed(t, "project requirements", () => projectRequirements(index, items, canvasIds));
  await timed(t, "model consistency", () => modelConsistency(model, items, canvasIds, index, reqs, sourceChanges));
  await timed(t, "open notes", () => projectOpenNotes(notes, canvases.filter((c) => canvasIds.includes(c.id)), items, frames, model));
  if (!rule) return null;
  // the thumbnails: one index per page, then one thumbnail per canvas
  const ix = await timed(t, `thumbnails: index (${rule})`, () => thumbIndex(model, requirements.map((r) => r.id), labelLinks));
  return timed(t, `thumbnails: shapes (${rule})`, () =>
    canvasIds.map((id) => thumbnail(canvases.find((c) => c.id === id)!, items.filter((i) => i.canvas_id === id), frames.filter((f) => f.canvas_id === id), notes.filter((n) => n.canvas_id === id), ix, rule)),
  );
}

/** The workspace home's server work today, and what P8 adds (each project's first canvas). */
async function workspaceHome(store: DataStore, ws: Uuid, p8: boolean, t: Timings) {
  const shell = await timed(t, "shell reads", () => shellReads(store, ws));
  const [, , , model, requirements, requirementLinks] = await timed(t, "page reads", async () => {
    await store.workspaces.get(ws);
    return Promise.all([store.workspaces.listMembers(ws), store.users.list(), store.projects.list(ws), store.model.load(ws), store.requirements.list(ws), store.requirements.listLinks(ws), store.undoHistory.get(ws, USER)]);
  });
  await timed(t, "stats and requirement index", () => {
    workspaceStats(model);
    buildRequirementIndex(requirements, requirementLinks, model);
  });
  if (!p8) return null;
  const [items, frames, notes, canvases, labelLinks] = await timed(t, "P8: canvas reads", () => Promise.all([store.canvasItems.list(ws), store.frames.list(ws), store.notes.list(ws), store.canvases.list(ws), store.labels.listLinks(ws)]));
  const ix = await timed(t, "P8: thumbnails: index", () => thumbIndex(model, requirements.map((r) => r.id), labelLinks));
  return timed(t, "P8: thumbnails: shapes", () =>
    shell.flatMap((p) => {
      const id = p.links[0]?.canvas_id;
      return id ? [thumbnail(canvases.find((c) => c.id === id)!, items.filter((i) => i.canvas_id === id), frames.filter((f) => f.canvas_id === id), notes.filter((n) => n.canvas_id === id), ix, "canvas")] : [];
    }),
  );
}

async function bench(label: string, run: (t: Timings) => Promise<unknown>) {
  await run({});
  const rounds: Timings[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t: Timings = {};
    const s = performance.now();
    await run(t);
    t.total = performance.now() - s;
    rounds.push(t);
  }
  const rows = Object.keys(rounds[0]!).map((k) => {
    const xs = rounds.map((r) => r[k] ?? 0).sort((a, b) => a - b);
    return { part: k, median: +xs[Math.floor(xs.length / 2)]!.toFixed(2), fastest: +xs[0]!.toFixed(2), slowest: +xs[xs.length - 1]!.toFixed(2) };
  });
  console.log(`\n${label} (ms, ${ROUNDS} rounds)`);
  console.table(rows);
}

function bytesReport(label: string, thumbs: ReturnType<typeof thumbnail>[]) {
  const per = thumbs.map(bytesOf);
  const sum = (pick: (b: ReturnType<typeof bytesOf>) => number) => per.reduce((s, b) => s + pick(b), 0);
  const shapes = thumbs.reduce((s, t) => s + t.shapes.length, 0);
  console.log(`\n${label}: ${thumbs.length} thumbnail(s), ${shapes} shapes ${JSON.stringify(kindsOf(thumbs))}; bytes per page (HTML + RSC payload estimate)`);
  console.table(
    (["elements", "string", "elementsRounded", "stringRounded", "paths"] as const).map((w) => {
      const html = sum((b) => b[w].html), payload = sum((b) => b[w].payload);
      return { way: w, html, payload, total: html + payload, perThumbnail: Math.round((html + payload) / Math.max(1, thumbs.length)) };
    }),
  );
}

async function main() {
  await removeDb(FILE);
  await resetDevData(FILE);
  const store = createLocalDataStore(FILE);
  const sets: { name: string; ws: Uuid; project: Uuid }[] = [{ name: "seed: Order management", ws: SEED_IDS.wsRetailDwh, project: SEED_IDS.projOrderManagement }];

  const runSet = async (s: { name: string; ws: Uuid; project: Uuid }) => {
    await bench(`${s.name}: project home today`, (t) => projectHome(store, s.ws, s.project, null, t));
    await bench(`${s.name}: project home + thumbnails (canvas rule)`, (t) => projectHome(store, s.ws, s.project, "canvas", t));
    await bench(`${s.name}: project home + thumbnails (prototype rule)`, (t) => projectHome(store, s.ws, s.project, "prototype", t));
    bytesReport(`${s.name}: project home`, (await projectHome(store, s.ws, s.project, "canvas", {}))!);
    // the canvas rule against the prototype's: how many cards differ in height
    const a = (await projectHome(store, s.ws, s.project, "canvas", {}))!, b = (await projectHome(store, s.ws, s.project, "prototype", {}))!;
    let differ = 0, cards = 0;
    a.forEach((t, i) => t.shapes.forEach((sh, k) => {
      if (sh.k === "entity" || sh.k === "table") { cards++; if (sh.h !== (b[i]!.shapes[k] as typeof sh).h) differ++; }
    }));
    console.log(`${s.name}: ${differ} of ${cards} cards differ in height between the canvas rule and the prototype's`);
  };
  const runWs = async (name: string, ws: Uuid) => {
    await bench(`${name}: workspace home today`, (t) => workspaceHome(store, ws, false, t));
    await bench(`${name}: workspace home + P8`, (t) => workspaceHome(store, ws, true, t));
    bytesReport(`${name}: workspace home (P8)`, (await workspaceHome(store, ws, true, {}))!);
  };

  await runSet(sets[0]!);
  await runWs("seed: Retail Co – DWH", SEED_IDS.wsRetailDwh);
  await seedLargeData(FILE);
  await runSet({ name: "large: Performance test", ws: LARGE_IDS.workspace, project: LARGE_IDS.project });
  await runWs("large: Performance test (1 project)", LARGE_IDS.workspace);
  await addManyCanvases(FILE);
  await runSet({ name: "many: Performance test – 20 canvases", ws: LARGE_IDS.workspace, project: MANY_PROJECT_ID });
  await runWs("many: Performance test (2 projects)", LARGE_IDS.workspace);
  await removeDb(FILE);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
