import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, organization, organizationMember, workspace } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { WORKSPACE_ROLES, type Classification } from "../types";
import {
  archiveWorkspace,
  createWorkspace,
  FIRST_CANVAS_NAME,
  FIRST_PROJECT_NAME,
  setNamingConventions,
  unarchiveWorkspace,
  updateWorkspaceSettings,
} from "./workspace";

describe("createWorkspace", () => {
  const state = { organization: organization(), organizationMember: organizationMember() };

  it("creates the workspace, the creator as owner, a first project, a first canvas and the built-in classifications in one change group", () => {
    const ctx = makeCtx();
    const r = createWorkspace(ctx, state, { organizationId: ids.org, name: "  Insurance DWH " });
    if (!r.ok) throw new Error(r.error.message);
    const { writes, events, changeGroupId } = r.writeSet;

    expect(writes.map((w) => `${w.kind}:${w.table}`)).toEqual([
      "insert:workspace",
      "insert:workspace_member",
      "insert:project",
      "insert:canvas",
      "insert:project_canvas",
      ...Array<string>(19).fill("insert:classification"),
    ]);
    const [ws, mem, proj, canv, link] = writes.map((w) => (w.kind === "insert" ? w.row : null)) as never[];
    expect(ws).toMatchObject({
      id: r.value.workspaceId,
      organization_id: ids.org,
      name: "Insurance DWH",
      doc_language: "en",
      dv2_mode: false,
      four_eyes: false,
      archived_at: null,
      requirement_key_next: 101,
      version: 1,
      created_by: ids.actor,
      created_at: NOW,
      deleted_at: null,
    });
    expect(mem).toEqual({ workspace_id: r.value.workspaceId, user_id: ids.actor, role: "owner", added_by: ids.actor, created_at: NOW });
    expect(proj).toMatchObject({ id: r.value.projectId, workspace_id: r.value.workspaceId, name: FIRST_PROJECT_NAME });
    expect(canv).toMatchObject({ id: r.value.canvasId, workspace_id: r.value.workspaceId, name: FIRST_CANVAS_NAME });
    expect(link).toMatchObject({ project_id: r.value.projectId, canvas_id: r.value.canvasId, sort_order: 0 });

    expect(events).toHaveLength(24);
    for (const e of events) {
      expect(e).toMatchObject({
        change_group_id: changeGroupId,
        workspace_id: r.value.workspaceId,
        operation: "create",
        before_image: null,
        user_id: ids.actor,
        occurred_at: NOW,
        context_label_id: null,
      });
      expect(e.after_image).not.toBeNull();
    }
    expect(events[0]!.after_image).toEqual(ws);
    expect(events[1]!.object_id).toBe(ids.actor);
    expect(events[4]!.object_id).toBe(r.value.canvasId);
  });

  it("is refused to someone outside the organization", () => {
    const r = createWorkspace(makeCtx(), { ...state, organizationMember: null }, { organizationId: ids.org, name: "X" });
    expect(r.ok || r.error.code).toBe("forbidden");
  });

  it("needs a name", () => {
    const r = createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "   " });
    expect(r.ok || r.error).toMatchObject({ code: "invalid", fields: { name: "Enter a name." } });
  });

  it("refuses an unknown or deleted organization", () => {
    expect(createWorkspace(makeCtx(), { ...state, organization: null }, { organizationId: ids.org, name: "X" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    const deleted = { ...state, organization: organization({ deleted_at: NOW }) };
    expect(createWorkspace(makeCtx(), deleted, { organizationId: ids.org, name: "X" })).toMatchObject({ ok: false });
    expect(createWorkspace(makeCtx(), state, { organizationId: ids.otherOrg, name: "X" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("createWorkspace in a documentation language (slice 23, F1, items 9, 11)", () => {
  const state = { organization: organization(), organizationMember: organizationMember() };
  const builtinRows = (r: ReturnType<typeof createWorkspace>) =>
    r.ok ? r.writeSet.writes.filter((w) => w.kind === "insert" && w.table === "classification").map((w) => (w as { row: Classification }).row) : [];

  it("writes the language and the built-in names and definitions in it; English when absent", () => {
    const pl = createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "Polski", docLanguage: "pl" });
    expect(pl.ok && pl.writeSet.writes.find((w) => w.table === "workspace")).toMatchObject({ row: { doc_language: "pl", naming_conventions: null } });
    expect(builtinRows(pl).find((c) => c.code === "BK")).toMatchObject({ name: "Klucz biznesowy", definition: "Kolumna identyfikuje obiekt biznesowy w źródle; przetrwa zmiany systemu." });
    const de = createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "Deutsch", docLanguage: "de" });
    expect(builtinRows(de).find((c) => c.code === "BK")?.name).toBe("Fachlicher Schlüssel");
    const en = createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "English" });
    expect(builtinRows(en).find((c) => c.code === "PII")).toMatchObject({ name: "Personal data", definition: "The column holds personal data in the sense of the GDPR." });
    expect(createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "X", docLanguage: "fr" }).ok).toBe(false);
  });

  it("changing the language later renames nothing and rewrites no definition (item 11)", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner", { doc_language: "pl" }), { workspaceId: ids.ws, expectedVersion: 3, docLanguage: "de" });
    expect(r.ok && r.writeSet.writes.map((w) => w.table)).toEqual(["workspace"]);
  });
});

describe("setNamingConventions (slice 23, item 13, F11)", () => {
  const input = (namingConventions: string | null, expectedVersion = 3) => ({ workspaceId: ids.ws, expectedVersion, namingConventions });

  it("saves them trimmed for owners, admins and modelers; empty clears them; no undo table", () => {
    for (const role of ["owner", "admin", "modeler"] as const) {
      const r = setNamingConventions(makeCtx(), access(role), input("  - Entities: singular  "));
      expect(r.ok && r.writeSet.writes).toEqual([expect.objectContaining({ kind: "update", table: "workspace", row: expect.objectContaining({ naming_conventions: "- Entities: singular", version: 4 }) })]);
    }
    const cleared = setNamingConventions(makeCtx(), access("owner", { naming_conventions: "x" }), input("  "));
    expect(cleared.ok && cleared.value).toMatchObject({ removed: true, workspace: { naming_conventions: null } });
  });

  it("refuses nothing to change, a stale version, too long a text, a reviewer, a reader and an archived workspace", () => {
    expect(setNamingConventions(makeCtx(), access("owner"), input(""))).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(setNamingConventions(makeCtx(), access("owner"), input("x", 2))).toMatchObject({ ok: false, error: { message: STALE_VERSION_MESSAGE } });
    expect(setNamingConventions(makeCtx(), access("owner"), input("x".repeat(20001)))).toMatchObject({ ok: false, error: { code: "invalid" } });
    for (const a of [access("reviewer"), access("reader"), access("owner", archived)]) expect(setNamingConventions(makeCtx(), a, input("x")).ok).toBe(false);
  });
});

describe("updateWorkspaceSettings", () => {
  const input = { workspaceId: ids.ws, expectedVersion: 3, name: "Retail DWH", clientName: "", docLanguage: "pl", dv2Mode: true, fourEyes: true };

  it("updates the settings, bumps the version and logs before and after", () => {
    const ctx = makeCtx();
    const r = updateWorkspaceSettings(ctx, access("admin"), input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({
      name: "Retail DWH",
      client_name: null,
      doc_language: "pl",
      dv2_mode: true,
      four_eyes: true,
      description: null,
      version: 4,
      updated_at: NOW,
      updated_by: ids.actor,
    });
    const [event] = r.writeSet.events;
    expect(r.writeSet.events).toHaveLength(1);
    expect(event).toMatchObject({ operation: "update", object_type: "workspace", object_id: ids.ws, change_group_id: r.writeSet.changeGroupId });
    expect(event!.before_image).toEqual(workspace());
    expect(event!.after_image).toEqual(r.value.workspace);
  });

  it("changes only the fields that are given", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 3, fourEyes: true });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toEqual({ ...workspace(), four_eyes: true, version: 4, updated_at: NOW, updated_by: ids.actor });
  });

  it("refuses a stale version without writing anything", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { ...input, expectedVersion: 2 });
    expect(r).toEqual({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
  });

  it("is refused to modelers, reviewers and readers", () => {
    for (const role of ["modeler", "reviewer", "reader"] as const) {
      expect(updateWorkspaceSettings(makeCtx(), access(role), input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("is refused in an archived workspace", () => {
    expect(updateWorkspaceSettings(makeCtx(), access("owner", archived), input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("validates the input", () => {
    const bad = [
      { ...input, name: "" },
      { ...input, docLanguage: "fr" },
      { ...input, expectedVersion: 0 },
      { ...input, unknownField: 1 },
      { ...input, workspaceId: "nope" },
    ];
    for (const b of bad) expect(updateWorkspaceSettings(makeCtx(), access("owner"), b)).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses an input for another workspace", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { ...input, workspaceId: ids.org });
    expect(r).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("archiveWorkspace and unarchiveWorkspace (AD-09)", () => {
  it("the owner archives: archived_at and archived_by are set", () => {
    const r = archiveWorkspace(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 3 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({ archived_at: NOW, archived_by: ids.actor, version: 4 });
    expect(r.writeSet.events[0]).toMatchObject({ operation: "update", before_image: { archived_at: null } });
  });

  it("the owner unarchives: archived_at and archived_by are cleared", () => {
    const r = unarchiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 3 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({ archived_at: null, archived_by: null, version: 4 });
  });

  it("nobody but the owner may archive or unarchive", () => {
    for (const role of WORKSPACE_ROLES.filter((x) => x !== "owner")) {
      expect(archiveWorkspace(makeCtx(), access(role), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
      expect(unarchiveWorkspace(makeCtx(), access(role, archived), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("an archived workspace cannot be archived again", () => {
    expect(archiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses a stale version", () => {
    expect(archiveWorkspace(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(unarchiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 4 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});

describe("updateWorkspaceSettings: InfoCube on and off (slice 15a, C-7)", () => {
  const licensed = { licensed: true, organizationName: "Retail Co", dimensionalEntities: 0 };
  const turn = (infocube: boolean) => ({ workspaceId: ids.ws, expectedVersion: 3, infocube });

  it("lets an owner or an admin turn it on with the organization's licence, and off without facts or dimensions", () => {
    for (const role of ["owner", "admin"] as const) {
      const r = updateWorkspaceSettings(makeCtx(), access(role), turn(true), licensed);
      expect(r.ok && r.value.workspace).toMatchObject({ infocube: true, version: 4 });
      const off = updateWorkspaceSettings(makeCtx(), access(role, { infocube: true }), turn(false), licensed);
      expect(off.ok && off.value.workspace.infocube).toBe(false);
    }
  });

  it("refuses a modeler, a reviewer, a reader and an archived workspace", () => {
    for (const role of ["modeler", "reviewer", "reader"] as const) {
      expect(updateWorkspaceSettings(makeCtx(), access(role), turn(true), licensed)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(updateWorkspaceSettings(makeCtx(), access("owner", archived), turn(true), licensed)).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses to turn it on without the licence, with the organization's name (O2)", () => {
    expect(updateWorkspaceSettings(makeCtx(), access("owner"), turn(true), { ...licensed, licensed: false })).toMatchObject({
      ok: false,
      error: { code: "forbidden", message: "Retail Co has no InfoCube licence." },
    });
  });

  it("refuses to turn it off while the workspace has facts or dimensions, with their number", () => {
    expect(updateWorkspaceSettings(makeCtx(), access("owner", { infocube: true }), turn(false), { ...licensed, dimensionalEntities: 3 })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "InfoCube can be turned off only when this workspace has no facts or dimensions. It has 3: delete them first." },
    });
    // turning it off needs no licence: an ended licence still lets an owner turn it off
    const off = updateWorkspaceSettings(makeCtx(), access("owner", { infocube: true }), turn(false), { ...licensed, licensed: false });
    expect(off.ok).toBe(true);
  });

  it("refuses a change of InfoCube without its state, and ignores a value that does not change it", () => {
    expect(updateWorkspaceSettings(makeCtx(), access("owner"), turn(true))).toMatchObject({ ok: false, error: { code: "invalid" } });
    const same = updateWorkspaceSettings(makeCtx(), access("owner"), { ...turn(false), name: "Retail DWH" });
    expect(same.ok && same.value.workspace).toMatchObject({ infocube: false, name: "Retail DWH" });
  });
});
