// A read-only count of the model checks in a local data file (slice 20, step 2; Łukasz's step 1 answer 12): per
// workspace and per project, the lines per group, never a name. Reads the file given (a copy of a backup, never
// `.data/dev-db.json`) and writes nothing.
// Run: npx tsx scripts/count-checks.ts <copy of .data/backups/kb-model-latest.json>

import { readFileSync } from "node:fs";
import { projectScope } from "../src/domain/model/checks";
import { homeOf, prepare, type ChecksDb } from "./lib/checks-model";

const file = process.argv[2];
if (!file || /dev-db\.json$/.test(file)) throw new Error("Give a copy of a backup, never .data/dev-db.json.");
const db = JSON.parse(readFileSync(file, "utf8")) as ChecksDb;
const counts = (c: ReturnType<typeof homeOf>["checks"]) => (c.count ? c.groups.map((g) => `${g.id} ${g.items.length}`).join(", ") : "none");

db.workspace.forEach((w, wi) => {
  const p = prepare(db, w.id);
  const { checks } = homeOf(p, null);
  console.log(`W${wi + 1}: ${p.model.entities.length} entities, ${p.model.attributes.length} attributes, ${p.model.relationships.length} relationships; InfoCube ${p.on ? "on" : "off"}`);
  console.log(`  whole model: ${checks.count} lines (${counts(checks)})`);
  const projects = db.project.filter((x) => x.workspace_id === w.id && x.deleted_at === null);
  projects.forEach((project, pi) => {
    const canvases = db.project_canvas.filter((l) => l.project_id === project.id).map((l) => l.canvas_id).filter((id) => db.canvas.some((c) => c.id === id && c.deleted_at === null));
    const scope = projectScope(db.canvas_item.filter((i) => i.workspace_id === w.id), canvases);
    const c = homeOf(p, scope).checks;
    console.log(`  P${pi + 1} (${scope.size} entities on its canvases): ${c.count} lines (${counts(c)})`);
  });
});
