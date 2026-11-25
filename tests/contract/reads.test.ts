// The contract of the reads (slice 29, Q8, S29-02): every read of the 14 repositories and `snapshot`, on the same rows,
// gives the same result on both adapters, in the same order (F2 condition 3). The writes are `writes.test.ts` (slice 30).
//
// The rows: the demo and "Performance test" built in memory (`scripts/lib/seed-rows.ts`), with cases added for the
// guards: a deleted original with live copies (lost originals), a deleted entity that label and requirement links point
// to, a deleted canvas with notes and project links, a pin of a deleted label.
//
// The local adapter always runs (in `npm test`), checked against the rows themselves. Postgres runs when
// INFOMAPPER_CONTRACT_DB names an empty database on this machine (CI's container, the "Schema" workflow): the suite applies
// the migrations, loads the rows and compares every read with the local adapter's. It refuses any other host: it empties
// the database it loads into, so it can never reach infomapper-dev.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { baselineDocumentCounts, documentModel } from "@/compose/document-model";
import { STORE_SCHEMA } from "@/compose/tables";
import type { DevDb } from "@/data/local/schema";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { spreadCrowded, stampPlaces } from "@/data/postgres/load";
import { getPool } from "@/data/postgres/pool";
import { createPostgresDataStore } from "@/data/postgres/store";
import { buildDocument } from "@/modules/infodocumenter/domain/document";
import { documentMarkdown } from "@/modules/infodocumenter/domain/markdown";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";
import { contractRows, preparePostgres, readEverything, spreadAll, type Row } from "./shared";

let db: DevDb;
let localReads: Record<string, unknown>;
let localStore: DataStore;
let tmp: string;

/**
 * Slice 34 (F23, S34-04): each live document's Markdown, built as the editor builds it from the store's snapshot (the
 * same tree, the same renderer), with a fixed time: both adapters must give the same text.
 */
async function markdownFrom(store: DataStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const documents = ((db as unknown as Record<string, DocumentDefinition[]>).document_definition ?? []).filter((d) => d.deleted_at === null);
  for (const d of documents) {
    const snapshot = await store.snapshot(d.workspace_id, DOCUMENT_TABLES);
    const tree = buildDocument({ definition: d, state: documentStateFor(snapshot!), types: DOCUMENT_SECTION_TYPES, date: "2026-11-21" });
    out[d.id] = documentMarkdown({ tree, name: d.name, generated: "2026-11-21T09:05+01:00" });
  }
  return out;
}

/**
 * Slice 36 (S36-06): each live document read as if made from each live baseline of its workspace, with a changes
 * section (the previous baseline) at its end: the model's source and comparisons, and its Markdown with a fixed time;
 * and each workspace's documents' count per baseline. Nothing is written: both adapters must give the same.
 */
async function baselineDocumentsFrom(store: DataStore): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const documents = ((db as unknown as Record<string, DocumentDefinition[]>).document_definition ?? []).filter((d) => d.deleted_at === null);
  for (const d of documents) {
    const workspace = (await store.workspaces.get(d.workspace_id))!;
    for (const b of await store.baselines.list(d.workspace_id)) {
      const definition: DocumentDefinition = {
        ...d,
        source_kind: "baseline",
        baseline_id: b.id,
        sections: [...d.sections, { id: "01a0f9e9-2036-7b1a-8c35-5e1f0a7e3601", type: "changes", on: true, heading: null, newPage: true, options: { against: null } }],
      };
      const model = (await documentModel(store, workspace, definition))!;
      const state = documentStateFor(model.snapshot, { source: model.source, changes: (a) => model.changes[a ?? ""] ?? { kind: "pending" } });
      const tree = buildDocument({ definition, state, types: DOCUMENT_SECTION_TYPES, date: "2026-11-21", time: (iso) => iso.slice(0, 16) });
      out[`${d.id} ${b.id}`] = { source: model.source, changes: model.changes, markdown: documentMarkdown({ tree, name: d.name, generated: "2026-11-21T09:05+01:00" }) };
    }
    out[`counts ${d.workspace_id}`] = await baselineDocumentCounts(store, d.workspace_id);
  }
  return out;
}

beforeAll(async () => {
  // slice 30 (L8): the loader spreads a crowded millisecond into the next ones; the local adapter gets the same times
  db = spreadAll(contractRows());
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "im-contract-"));
  const file = path.join(tmp, "contract-db.json");
  fs.writeFileSync(file, JSON.stringify(db));
  localStore = createLocalDataStore(file, STORE_SCHEMA);
  localReads = await readEverything(localStore, db);
}, 120_000);

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the reads on the local adapter, against the rows themselves", () => {
  const rowsOf = (t: string) => (db as unknown as Record<string, Row[]>)[t]!;
  const liveIn = (t: string, ws: string) => rowsOf(t).filter((r) => r.workspace_id === ws && r.deleted_at === null);

  it("lists without a sort of their own in the stored order: the file's", () => {
    for (const w of rowsOf("workspace")) {
      const ws = w.id!;
      expect(localReads[`projects.list ${ws}`]).toEqual(liveIn("project", ws));
      expect(localReads[`canvasItems.list ${ws}`]).toEqual(liveIn("canvas_item", ws));
      expect(localReads[`requirements.list ${ws}`]).toEqual(liveIn("requirement", ws));
      expect(localReads[`changeEvents.list ${ws}`]).toEqual(rowsOf("change_event").filter((e) => e.workspace_id === ws));
    }
  });

  it("keeps the guards: no link to a deleted element, no note on a deleted canvas, no pin of a deleted label", () => {
    const deleted = (t: string) => new Set(rowsOf(t).filter((r) => r.deleted_at !== null).map((r) => r.id));
    const deletedEntities = deleted("entity");
    const deletedCanvases = deleted("canvas");
    const deletedLabels = deleted("label");
    expect([deletedEntities.size, deletedCanvases.size, deletedLabels.size].every((n) => n > 0)).toBe(true);
    expect(rowsOf("workspace").some((w) => (localReads[`labels.listPins ${w.id}`] as Row[]).length > 0)).toBe(true);
    for (const w of rowsOf("workspace")) {
      const ws = w.id!;
      for (const k of localReads[`labels.listLinks ${ws}`] as Row[]) expect(deletedEntities.has(k.entity_id as string)).toBe(false);
      for (const k of localReads[`requirements.listLinks ${ws}`] as Row[]) expect(deletedEntities.has(k.entity_id as string)).toBe(false);
      for (const n of localReads[`notes.list ${ws}`] as Row[]) expect(deletedCanvases.has(n.canvas_id as string)).toBe(false);
      for (const p of localReads[`labels.listPins ${ws}`] as Row[]) expect(deletedLabels.has(p.label_id as string)).toBe(false);
    }
  });

  it("lists the open invitations (expired ones too, D6) and finds a link's rows by their hash (slice 33)", () => {
    const invitations = rowsOf("invitation");
    expect(invitations).toHaveLength(4);
    const ws = invitations[0]!.workspace_id!;
    expect((localReads[`invitations.listOpen ${ws}`] as Row[]).map((i) => i.email)).toEqual(["expired.person@example.com", "pending.person@example.com"]);
    for (const i of invitations) expect(localReads[`invitations.getByTokenHash ${i.id}`]).toEqual(i);
    expect(localReads["invitations.getByTokenHash (unknown)"]).toBeNull();
    const resets = rowsOf("password_reset");
    expect(localReads[`passwordResets.listOfUser ${resets[0]!.app_user_id}`]).toEqual(resets);
    expect(localReads["passwordResets.getByTokenHash (unknown)"]).toBeNull();
  });

  it("builds documents from a baseline: its content, its comparison with the previous one, the counts (slice 36)", async () => {
    const read = await baselineDocumentsFrom(localStore);
    const built = Object.entries(read).filter(([k]) => !k.startsWith("counts"));
    expect(built.length).toBeGreaterThan(0);
    for (const [, v] of built) expect((v as { source: { kind: string } }).source.kind).toBe("baseline");
  });

  it("names the lost original in model.load", () => {
    const lost = rowsOf("workspace").flatMap((w) => (localReads[`model.load ${w.id}`] as { lostOriginals: unknown[] }).lostOriginals);
    expect(lost.length).toBeGreaterThan(0);
  });

  it("builds every demo document's Markdown from its snapshot (slice 34)", async () => {
    const md = Object.values(await markdownFrom(localStore));
    expect(md).toHaveLength(3);
    for (const text of md) expect(text).toMatch(/^---\ndocument: "/);
  });
});

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;

describe.runIf(!!CONTRACT_DB)("the reads on Postgres: the same as the local adapter's (S29-02)", () => {
  let pgReads: Record<string, unknown>;
  let crowded: Record<string, number> = {};
  let store: DataStore;

  beforeAll(async () => {
    crowded = (await preparePostgres(CONTRACT_DB!, db)).crowded;
    process.env.INFOMAPPER_DATABASE_URL = CONTRACT_DB;
    store = createPostgresDataStore(STORE_SCHEMA);
    pgReads = await readEverything(store, db);
  }, 300_000);

  afterAll(async () => {
    // only when the pool was made (a failed load never makes it)
    if (store) await getPool().end();
  });

  it("gives every read the local adapter's result, in its order", () => {
    expect(Object.keys(pgReads).sort()).toEqual(Object.keys(localReads).sort());
    for (const name of Object.keys(localReads)) {
      if (name.startsWith("model.loadForUndo")) continue;
      expect.soft(pgReads[name], name).toEqual(localReads[name]);
    }
  });

  it("gives loadForUndo the local adapter's rows; in its order except a crowded millisecond's rows past the 999th", () => {
    const byKey = (rows: Row[]) => [...rows].sort((a, b) => String(a.id ?? JSON.stringify(a)).localeCompare(String(b.id ?? JSON.stringify(b))));
    for (const name of Object.keys(localReads).filter((n) => n.startsWith("model.loadForUndo"))) {
      const local = localReads[name] as Record<string, Row[]>;
      const pg = pgReads[name] as Record<string, Row[]>;
      expect(Object.keys(pg).sort(), name).toEqual(Object.keys(local).sort());
      for (const table of Object.keys(local)) {
        if (crowded[table]) expect.soft(byKey(pg[table]!), `${name} ${table}`).toEqual(byKey(local[table]!));
        else expect.soft(pg[table], `${name} ${table}`).toEqual(local[table]);
      }
    }
  });

  it("gives documents from a baseline the local adapter's model, comparisons and Markdown (slice 36)", async () => {
    const local = await baselineDocumentsFrom(localStore);
    expect(await baselineDocumentsFrom(store)).toEqual(local);
  });

  it("gives every document's Markdown the local adapter's text (slice 34, F23)", async () => {
    const local = await markdownFrom(localStore);
    expect(Object.keys(local).length).toBeGreaterThan(0);
    expect(await markdownFrom(store)).toEqual(local);
  });

});

describe("the loader's places (F2)", () => {
  it("moves a crowded millisecond's rows past the 999th into the following milliseconds (slice 30, L8)", () => {
    const rows = Array.from({ length: 2003 }, (_, i) => ({ id: String(i), created_at: "2026-11-16T10:00:00.123Z" }));
    const spread = spreadCrowded("concept", rows);
    expect(spread[998]!.created_at).toBe("2026-11-16T10:00:00.123Z");
    expect(spread[999]!.created_at).toBe("2026-11-16T10:00:00.124Z");
    expect(spread[2002]!.created_at).toBe("2026-11-16T10:00:00.125Z");
    const { rows: stamped, crowded } = stampPlaces("concept", spread);
    expect(crowded).toBe(0);
    expect(stamped[999]!.created_at).toBe("2026-11-16T10:00:00.124000Z");
    const few = rows.slice(0, 10);
    expect(spreadCrowded("concept", few)).toBe(few);
  });
  it("stamps each row's place in its millisecond as microseconds, and never more than 999", () => {
    const rows = Array.from({ length: 1002 }, (_, i) => ({ id: String(i), created_at: "2026-11-16T10:00:00.123Z" }));
    const { rows: stamped, crowded } = stampPlaces("concept", rows);
    expect(stamped[0]!.created_at).toBe("2026-11-16T10:00:00.123000Z");
    expect(stamped[45]!.created_at).toBe("2026-11-16T10:00:00.123045Z");
    expect(stamped[999]!.created_at).toBe("2026-11-16T10:00:00.123999Z");
    expect(stamped[1001]!.created_at).toBe("2026-11-16T10:00:00.123999Z");
    expect(crowded).toBe(3);
    expect(rows[0]!.created_at).toBe("2026-11-16T10:00:00.123Z");
  });
  it("uses each table's own time column, and none for project_pinned_label", () => {
    expect(stampPlaces("change_event", [{ id: "a", occurred_at: "2026-11-16T10:00:00.000Z" }]).rows[0]!.occurred_at).toBe("2026-11-16T10:00:00.000000Z");
    expect(stampPlaces("project_canvas", [{ added_at: "2026-11-16T10:00:00.000Z" }]).rows[0]!.added_at).toBe("2026-11-16T10:00:00.000000Z");
    expect(stampPlaces("project_pinned_label", [{ project_id: "p", label_id: "l" }]).rows).toEqual([{ project_id: "p", label_id: "l" }]);
  });
});

describe("the loader refuses fields no column holds", () => {
  it("names each stray field as table.field, never a value", async () => {
    const { strayFields } = await import("@/data/postgres/load");
    const columns = new Map([["organization_licence", new Set(["id", "organization_id", "module"])]]);
    expect(strayFields({ organization_licence: [{ id: "a", organization_id: "o", module: "infocube", workspace_id: "w" }] }, columns)).toEqual(["organization_licence.workspace_id"]);
    expect(strayFields({ organization_licence: [{ id: "a", organization_id: "o", module: "infocube" }] }, columns)).toEqual([]);
  });
});
