// "Performance test – 20 canvases" (slice 12b, PRD item 2; step 1, answer 8): a project of its own in the workspace
// "Performance test", with 20 copies of the canvas "100 cards" (its frames, cards and notes, references moved to the
// copies, as `addLargeRequirementCards` copies it). For the home's measurement only: the measuring spec and the bench
// write it into their own data file (the e2e one, or a copy), never into the seed or `.data/dev-db.json`.

import { readDb, writeDb } from "../../src/data/local/file";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { seedId } from "../../src/data/local/seed-model";
import { SEED_IDS } from "../../src/data/local/seed";
import type { Uuid } from "../../src/domain/ids";

export const MANY_CANVASES = 20;
export const MANY_PROJECT_NAME = "Performance test – 20 canvases";
export const MANY_PROJECT_ID = seedId(LARGE_IDS.workspace, "many-canvases:project");

/** Adds the project and its canvases to the data file, which must already hold "Performance test"; false if it is there. */
export async function addManyCanvases(file: string, count = MANY_CANVASES): Promise<boolean> {
  const db = await readDb(file);
  if (db.project.some((p) => p.id === MANY_PROJECT_ID)) return false;
  const ws = LARGE_IDS.workspace;
  const at = new Date().toISOString();
  const by = SEED_IDS.userLukasz;
  const audit = { workspace_id: ws, version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null };
  const from = db.canvas.find((c) => c.id === LARGE_IDS.canvas);
  if (!from) throw new Error(`${file} has no "Performance test" (npm run seed:large).`);

  db.project.push({ ...audit, id: MANY_PROJECT_ID, name: MANY_PROJECT_NAME, description: `${count} copies of "100 cards" (slice 12b's measurement).` });
  const frames = db.frame.filter((x) => x.canvas_id === from.id && x.deleted_at === null);
  const items = db.canvas_item.filter((x) => x.canvas_id === from.id && x.deleted_at === null);
  const notes = db.note.filter((x) => x.canvas_id === from.id && x.deleted_at === null);
  for (let k = 0; k < count; k++) {
    const canvasId = seedId(ws, `many-canvases:${k}`);
    const copyId = (old: Uuid) => seedId(ws, `many-canvases:${k}:${old}`);
    db.canvas.push({ ...from, ...audit, id: canvasId, name: `100 cards ${k + 1}`, look: { ...from.look } });
    db.project_canvas.push({ project_id: MANY_PROJECT_ID, canvas_id: canvasId, workspace_id: ws, sort_order: k, added_at: at, added_by: by });
    for (const f of frames) db.frame.push({ ...f, id: copyId(f.id), canvas_id: canvasId });
    for (const i of items) db.canvas_item.push({ ...i, id: copyId(i.id), canvas_id: canvasId, frame_id: i.frame_id ? copyId(i.frame_id) : null });
    for (const n of notes) {
      db.note.push({
        ...n,
        id: copyId(n.id),
        canvas_id: canvasId,
        frame_id: n.frame_id ? copyId(n.frame_id) : null,
        pin_canvas_item_id: n.pin_canvas_item_id ? copyId(n.pin_canvas_item_id) : null,
        pin_frame_id: n.pin_frame_id ? copyId(n.pin_frame_id) : null,
      });
    }
  }
  await writeDb(file, db);
  return true;
}
