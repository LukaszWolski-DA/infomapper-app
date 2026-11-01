import { expect, test } from "./fixtures";
import {
  deleteButton,
  expectAt,
  expectToast,
  furnishOrderManagement,
  OM,
  OM_HOME,
  OWN,
  rawDb,
  RETAIL,
  recordToasts,
  rowsOn,
  SEED_IDS,
  SHARED,
  signInAs,
  store,
  toasts,
  WS_HOME,
} from "./helpers";

// S12A-08 (items 11, 14): the second click deletes the project, in one change group: its own canvas with its cards,
// requirement cards, frames and notes; the shared canvas stays in its other project with all its content; the
// project's canvas links and pins go; the model is untouched. The page lands on the workspace home with item 14's toast.

/** The model's rows, deleted or not, to compare before and after. */
const modelRows = async () => {
  const db = await rawDb();
  const ws = <R extends { workspace_id: string }>(rows: R[]) => rows.filter((r) => r.workspace_id === RETAIL);
  return JSON.stringify([ws(db.concept), ws(db.entity), ws(db.attribute), ws(db.relationship), ws(db.mapping), ws(db.mapping_input), ws(db.source_table), ws(db.source_column), ws(db.requirement), ws(db.requirement_link), ws(db.label), ws(db.label_link)]);
};

test("S12A-08: the second click deletes the project with its own canvas and content in one change group; the shared canvas, the model stay", async ({ page }) => {
  await furnishOrderManagement();
  const own = await rowsOn(OWN);
  const shared = await rowsOn(SHARED);
  expect(own.items.some((i) => i.requirement_id)).toBe(true);
  expect(own.frames.length).toBeGreaterThan(0);
  expect(own.notes.length).toBeGreaterThan(0);
  const model = await modelRows();

  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await deleteButton(page).click();
  await deleteButton(page).click();
  await expectToast(page, "Deleted the project Order management and 1 canvas that only it used. The model is untouched.");
  await expectAt(page, WS_HOME);
  await expect(page.getByTestId("tile-project").filter({ hasText: "Order management" })).toHaveCount(0);
  expect(await toasts(page)).not.toContain("That project no longer exists.");

  const db = await rawDb();
  expect(db.project.find((p) => p.id === OM)!.deleted_at).not.toBeNull();
  expect(db.canvas.find((c) => c.id === OWN)!.deleted_at).not.toBeNull();
  const ownAfter = await rowsOn(OWN);
  for (const rows of [ownAfter.items, ownAfter.frames, ownAfter.notes]) expect(rows.every((r) => r.deleted_at !== null)).toBe(true);
  // the shared canvas and everything on it, as before, in its other project
  expect(db.canvas.find((c) => c.id === SHARED)!.deleted_at).toBeNull();
  expect(await rowsOn(SHARED)).toEqual(shared);
  expect(db.project_canvas.filter((l) => l.project_id === OM)).toEqual([]);
  expect(db.project_canvas.some((l) => l.canvas_id === SHARED && l.project_id === SEED_IDS.projCustomer360)).toBe(true);
  expect(db.project_pinned_label.filter((p) => p.project_id === OM)).toEqual([]);
  expect(await modelRows()).toBe(model);

  // one change group: the project's delete and its canvas's content
  const events = await store().changeEvents.list(RETAIL);
  const group = events.find((e) => e.object_type === "project" && e.object_id === OM && e.operation === "delete")!.change_group_id;
  const ofGroup = events.filter((e) => e.change_group_id === group);
  const ownIds = new Set([OWN, ...own.items.map((i) => i.id), ...own.frames.map((f) => f.id), ...own.notes.map((n) => n.id)]);
  expect([...ownIds].every((id) => ofGroup.some((e) => e.object_id === id && e.operation === "delete"))).toBe(true);
  expect(ofGroup.some((e) => e.object_type === "project_pinned_label")).toBe(true);
  expect(new Set(ofGroup.map((e) => e.object_type))).toEqual(new Set(["note", "canvas_item", "frame", "canvas", "project_canvas", "project_pinned_label", "project"]));
});
