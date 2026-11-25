// Slice 35 (D-87): the baselines' commands: rights per role and in an archived workspace, the name and note rules (B1.3),
// the version (D-59), the soft delete, outside undo, and the content kept out of the change events' images.

import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx } from "../__fixtures__/domain";
import type { BaselineContent } from "../baseline/content";
import { baselineNameKey, baselineNameTakenBy, nameTakenMessage, NAME_REQUIRED_MESSAGE, NOTE_TOO_LONG_MESSAGE, NAME_TOO_LONG_MESSAGE, newestBaselineFirst } from "../baseline/names";
import type { Baseline, Entity, WorkspaceRole } from "../types";
import { createBaseline, deleteBaseline, renameBaseline } from "./baseline";
import { CORE_UNDO_TABLES, isUndoable } from "./undo";

const content = (entities: Partial<Entity>[] = []): BaselineContent => ({
  settings: { dv2_mode: false, four_eyes: false, naming_conventions: null, infocube: false },
  model: {
    concepts: [],
    entities: entities as Entity[],
    attributes: [],
    relationships: [],
    sourceSystems: [],
    sourceTables: [],
    sourceColumns: [],
    mappings: [],
    mappingInputs: [],
    attributeInputs: [],
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
    stereotypes: [],
    lostOriginals: [],
  },
  requirements: [],
  requirementLinks: [],
  projects: [],
  projectCanvases: [],
  canvasItems: [],
  canvases: [],
  frames: [],
  modules: {},
});

const create = (role: WorkspaceRole | null, name: string, baselines: Baseline[] = [], ws = {}) =>
  createBaseline(makeCtx(), access(role, ws), { baselines }, content(), { workspaceId: ids.ws, name, note: null });

function taken(name = "Stage 1 sign-off"): Baseline {
  const r = create("owner", name);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.baseline;
}

describe("the name and the note (B1.3)", () => {
  it("compares names in any letter case, trimmed, repeated spaces as one; not D-78's rule", () => {
    expect(baselineNameKey("  Stage  2   Sign-off ")).toBe("stage 2 sign-off");
    expect(baselineNameKey("Stage-2")).not.toBe(baselineNameKey("Stage 2"));
  });

  it("finds a live baseline of that name, not a deleted one, not itself", () => {
    const b = taken();
    expect(baselineNameTakenBy([b], "STAGE 1 SIGN-OFF")).toBe(b);
    expect(baselineNameTakenBy([b], "stage 1 sign-off", b.id)).toBeNull();
    expect(baselineNameTakenBy([{ ...b, deleted_at: "2026-11-24T10:00:00.000Z" }], "Stage 1 sign-off")).toBeNull();
  });

  it("refuses an empty name, a name over 120 and a note over 1,000 characters; trims both; an empty note is none", () => {
    const empty = create("owner", "   ");
    expect(empty.ok ? null : empty.error.message).toBe(NAME_REQUIRED_MESSAGE);
    const long = create("owner", "x".repeat(121));
    expect(long.ok ? null : long.error.message).toBe(NAME_TOO_LONG_MESSAGE);
    expect(create("owner", "x".repeat(120)).ok).toBe(true);
    const note = (n: string) => createBaseline(makeCtx(), access("owner"), { baselines: [] }, content(), { workspaceId: ids.ws, name: " A ", note: n });
    const tooLong = note("y".repeat(1001));
    expect(tooLong.ok ? null : tooLong.error.message).toBe(NOTE_TOO_LONG_MESSAGE);
    const ok = note(`  ${"y".repeat(1000)}  `);
    expect(ok.ok && ok.value.baseline.note?.length).toBe(1000);
    expect(ok.ok && ok.value.baseline.name).toBe("A");
    const blank = note("   ");
    expect(blank.ok && blank.value.baseline.note).toBeNull();
  });

  it("refuses a name taken in any letter case among live baselines; free again after a delete", () => {
    const b = taken();
    const again = create("modeler", "stage 1 SIGN-OFF", [b]);
    expect(again.ok ? null : again.error).toMatchObject({ code: "conflict", message: nameTakenMessage("stage 1 SIGN-OFF") });
    expect(create("modeler", "Stage 1 sign-off", [{ ...b, deleted_at: "2026-11-24T10:00:00.000Z" }]).ok).toBe(true);
  });

  it("orders newest first, then by id", () => {
    const a = { created_at: "2026-09-15T08:12:00.000Z", id: "a" }, b = { created_at: "2026-11-24T10:00:00.000Z", id: "b" };
    expect([a, b].sort(newestBaselineFirst)).toEqual([b, a]);
  });
});

describe("the rights (the design, D-87)", () => {
  const roles: WorkspaceRole[] = ["owner", "admin", "modeler", "reviewer", "reader"];
  it("creates and renames for owners, admins and modelers; deletes for owners and admins", () => {
    const b = taken();
    const can = (role: WorkspaceRole) => ({
      create: create(role, "New").ok,
      rename: renameBaseline(makeCtx(), access(role), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: "Renamed" }).ok,
      delete: deleteBaseline(makeCtx(), access(role), b, { baselineId: b.id, expectedVersion: 1 }).ok,
    });
    expect(Object.fromEntries(roles.map((r) => [r, can(r)]))).toEqual({
      owner: { create: true, rename: true, delete: true },
      admin: { create: true, rename: true, delete: true },
      modeler: { create: true, rename: true, delete: false },
      reviewer: { create: false, rename: false, delete: false },
      reader: { create: false, rename: false, delete: false },
    });
    const r = create("reader", "New");
    expect(r.ok ? null : r.error.message).toBe("As a reader you cannot create baselines.");
  });

  it("refuses every write in an archived workspace, and anyone who is not a member", () => {
    const b = taken();
    const r = create("owner", "New", [], archived);
    expect(r.ok ? null : r.error.code).toBe("archived");
    expect(renameBaseline(makeCtx(), access("owner", archived), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: "X" }).ok).toBe(false);
    expect(deleteBaseline(makeCtx(), access("owner", archived), b, { baselineId: b.id, expectedVersion: 1 }).ok).toBe(false);
    expect(create(null, "New").ok).toBe(false);
  });
});

describe("taking, renaming and deleting", () => {
  it("writes the row with its counts and the content in its insert only, out of the change event's images", () => {
    const r = createBaseline(makeCtx(), access("modeler"), { baselines: [] }, content([{ model_level: "logical" }, { model_level: "dimensional" }]), {
      workspaceId: ids.ws,
      name: "Stage 2",
      note: "Signed.",
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.baseline).toMatchObject({ name: "Stage 2", name_key: "stage 2", note: "Signed.", snapshot_schema: 1, entity_count: 1, mapping_count: 0, requirement_count: 0, version: 1 });
    expect(r.value.baseline).not.toHaveProperty("snapshot");
    const [write] = r.writeSet.writes;
    expect(write!.kind === "insert" && "snapshot" in write!.row).toBe(true);
    const [event] = r.writeSet.events;
    expect(event).toMatchObject({ object_type: "baseline", operation: "create", before_image: null });
    expect(event!.after_image).not.toHaveProperty("snapshot");
    expect(event!.after_image).toMatchObject({ name: "Stage 2" });
  });

  it("renames the name and the note against the row's version; a stale or gone row is refused; nothing to change", () => {
    const b = taken();
    const r = renameBaseline(makeCtx(), access("modeler"), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: "Stage 1", note: "Moved." });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ renamed: true, baseline: { name: "Stage 1", name_key: "stage 1", note: "Moved.", version: 2 } });
    expect(r.writeSet.writes[0]!.kind === "update" && "snapshot" in r.writeSet.writes[0]!.row).toBe(false);
    const noteOnly = renameBaseline(makeCtx(), access("modeler"), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: b.name, note: "Moved." });
    expect(noteOnly.ok && noteOnly.value.renamed).toBe(false);
    const stale = renameBaseline(makeCtx(), access("modeler"), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 7, name: "X" });
    expect(stale.ok ? null : stale.error.code).toBe("stale_version");
    const same = renameBaseline(makeCtx(), access("modeler"), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: b.name, note: null });
    expect(same.ok ? null : same.error.message).toBe("Nothing to change.");
    const gone = renameBaseline(makeCtx(), access("modeler"), { baselines: [b] }, { ...b, deleted_at: "2026-11-24T10:00:00.000Z" }, { baselineId: b.id, expectedVersion: 1, name: "X" });
    expect(gone.ok ? null : gone.error).toMatchObject({ code: "not_found", message: "This baseline no longer exists." });
    const other = { ...taken("Other"), id: "01900000-0000-7000-8000-00000000b002" };
    const clash = renameBaseline(makeCtx(), access("modeler"), { baselines: [b, other] }, b, { baselineId: b.id, expectedVersion: 1, name: "other" });
    expect(clash.ok ? null : clash.error.message).toBe(nameTakenMessage("other"));
  });

  it("deletes softly; none of the three is an undo step", () => {
    const b = taken();
    const d = deleteBaseline(makeCtx(), access("admin"), b, { baselineId: b.id, expectedVersion: 1 });
    if (!d.ok) throw new Error(d.error.message);
    expect(d.value.baseline.deleted_at).not.toBeNull();
    expect(d.writeSet.events[0]).toMatchObject({ operation: "delete", object_type: "baseline" });
    const c = create("owner", "X");
    const r = renameBaseline(makeCtx(), access("owner"), { baselines: [b] }, b, { baselineId: b.id, expectedVersion: 1, name: "Y" });
    for (const set of [c, r, d]) expect(set.ok && isUndoable(set.writeSet.events, CORE_UNDO_TABLES)).toBe(false);
  });
});
