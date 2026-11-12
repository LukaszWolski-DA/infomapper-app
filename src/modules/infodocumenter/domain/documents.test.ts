// InfoDocumenter's rights and commands (slice 25, step 2): PRD item 10 as changed after step 1 (F14 b, F15, F17), the
// presets (D1), saves with a version (D-59) and a change event, outside undo (R2-4a2), share and unshare (D4: at once),
// duplicate, delete, an archived workspace read only, nothing written while InfoDocumenter is off (F13).

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { access, archived, ids, makeCtx } from "@/domain/__fixtures__/domain";
import { sectionKinds, type DocumentSectionKind } from "@/domain/document/sections";
import { ARCHIVED_MESSAGE } from "@/domain/errors";
import type { WorkspaceAccess } from "@/domain/permissions";
import { WORKSPACE_ROLES, type Workspace, type WorkspaceRole } from "@/domain/types";
import { createDocument, deleteDocument, duplicateDocument, NAME_REQUIRED, setDocumentShared, updateDocument } from "./commands";
import { PRESETS } from "./presets";
import { canSee, documentRights, editRefusal, openRefusal, RIGHTS_TEXTS } from "./rights";
import { INFODOC_SECTION_KINDS } from "./sections";
import type { DocumentDefinition } from "./types";

// a module's kind as InfoCube registers one (the real wiring: tests/document-sections.test.ts; a module never imports another)
const CUBE_SECTION_KIND: DocumentSectionKind = {
  type: "cube.dim",
  available: (w) => w.infocube,
  presets: ["s2t"],
  defaults: () => ({ facts: true }),
  options: z.object({ facts: z.boolean() }).strict() as unknown as z.ZodType<Record<string, unknown>>,
};
const KINDS = sectionKinds([...INFODOC_SECTION_KINDS, CUBE_SECTION_KIND]);
const ON: Partial<Workspace> = { infodoc: true };
const as = (role: WorkspaceRole | null, ws: Partial<Workspace> = {}, user = ids.actor): WorkspaceAccess => {
  const a = access(role, { ...ON, ...ws });
  return a.member ? { ...a, member: { ...a.member, user_id: user } } : a;
};
const ME = ids.actor;
const OTHER = ids.someoneElse;

function made(preset: "dictionary" | "s2t" | "blank" = "dictionary", ws: Partial<Workspace> = {}, role: WorkspaceRole = "reader"): DocumentDefinition {
  const r = createDocument(makeCtx(ME), as(role, ws), { workspaceId: ids.ws, preset }, KINDS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.document;
}
const doc = (over: Partial<DocumentDefinition> = {}): DocumentDefinition => ({ ...made(), ...over });
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("the rights (PRD item 10, F14 b)", () => {
  it("lets every member see shared documents and their own private ones, never another's private one", () => {
    for (const role of WORKSPACE_ROLES) {
      expect(canSee(as(role), doc({ shared: true, author_id: OTHER }))).toBe(true);
      expect(canSee(as(role), doc({ shared: false, author_id: ME }))).toBe(true);
      expect(canSee(as(role), doc({ shared: false, author_id: OTHER }))).toBe(false);
    }
    expect(canSee(as(null), doc({ shared: true }))).toBe(false);
    expect(canSee(as("owner"), doc({ shared: true, deleted_at: "2026-10-03T00:00:00.000Z" }))).toBe(false);
  });

  it("gives each role its rights on a shared document of someone else's", () => {
    const shared = doc({ shared: true, author_id: OTHER });
    const rights = Object.fromEntries(WORKSPACE_ROLES.map((r) => [r, documentRights(as(r), shared)]));
    expect(rights).toEqual({
      owner: { edit: true, share: true, unshare: false, delete: true, duplicate: true },
      admin: { edit: true, share: true, unshare: false, delete: true, duplicate: true },
      modeler: { edit: true, share: true, unshare: false, delete: false, duplicate: true },
      reviewer: { edit: false, share: false, unshare: false, delete: false, duplicate: true },
      reader: { edit: false, share: false, unshare: false, delete: false, duplicate: true },
    });
  });

  it("gives every role full rights on their own private document, sharing to owners, admins and modelers only", () => {
    for (const role of WORKSPACE_ROLES) {
      const share = role === "owner" || role === "admin" || role === "modeler";
      expect(documentRights(as(role), doc({ author_id: ME })), role).toEqual({ edit: true, share, unshare: share, delete: true, duplicate: true });
    }
  });

  it("lets an author whose role was lowered delete their shared document, not change it (F17 b)", () => {
    const shared = doc({ shared: true, author_id: ME });
    expect(documentRights(as("reader"), shared)).toEqual({ edit: false, share: false, unshare: false, delete: true, duplicate: true });
    expect(editRefusal(as("reader"), shared)?.message).toBe(RIGHTS_TEXTS.sharedEdit);
  });

  it("says not found for another's private document, so it is not told to exist", () => {
    const theirs = doc({ author_id: OTHER });
    for (const role of WORKSPACE_ROLES) expect(editRefusal(as(role), theirs)?.code).toBe("not_found");
    expect(openRefusal(as("owner"), theirs)?.code).toBe("not_found");
  });

  it("lets every member open and print what they see, also in an archived workspace (F16 as answered)", () => {
    for (const role of WORKSPACE_ROLES) {
      expect(openRefusal(as(role), doc({ shared: true, author_id: OTHER }))).toBeNull();
      expect(openRefusal(as(role, archived), doc({ shared: true, author_id: OTHER }))).toBeNull();
    }
  });

  it("reads an archived workspace's documents only", () => {
    const mine = doc({ author_id: ME });
    expect(documentRights(as("owner", archived), mine)).toEqual({ edit: false, share: false, unshare: false, delete: false, duplicate: false });
    expect(editRefusal(as("owner", archived), mine)).toEqual({ code: "archived", message: ARCHIVED_MESSAGE });
  });

  it("refuses every write and every opening while InfoDocumenter is off (F13); it keeps the rows", () => {
    const off = as("owner", { infodoc: false });
    expect(createDocument(makeCtx(), off, { workspaceId: ids.ws, preset: "blank" }, KINDS)).toMatchObject({ ok: false, error: { message: RIGHTS_TEXTS.off } });
    expect(editRefusal(off, doc({ author_id: ME }))?.message).toBe(RIGHTS_TEXTS.off);
    expect(openRefusal(off, doc({ author_id: ME }))?.message).toBe(RIGHTS_TEXTS.off);
  });
});

describe("creating from a preset (D1, D13)", () => {
  it("makes a private document of the person's, of every role, from each preset", () => {
    for (const role of WORKSPACE_ROLES) {
      for (const p of PRESETS) {
        const r = createDocument(makeCtx(ME), as(role), { workspaceId: ids.ws, preset: p.code }, KINDS);
        const d = ok(r).document;
        expect(d).toMatchObject({ name: p.label, author_id: ME, shared: false, audience: p.audience, preset: p.code, source_kind: "live", baseline_id: null });
        expect(d.scope).toEqual({ projects: [], concepts: [], logical: true, dimensional: true, mappings: p.mappings });
        expect(d.cover).toEqual({ title: null, subtitle: null, version: null, status: null, preparedBy: null });
        expect(d.sections.map((s) => s.type)).toEqual(p.sections.map((s) => s.type));
        expect(d.sections.every((s) => s.on)).toBe(true);
      }
    }
  });

  it("ends the source-to-target preset with the Dimensional model only while InfoCube is on", () => {
    expect(made("s2t").sections.map((s) => s.type)).toEqual(["s2t"]);
    const withCube = made("s2t", { infocube: true });
    expect(withCube.sections.map((s) => s.type)).toEqual(["s2t", "cube.dim"]);
    expect(withCube.sections[1]!.options).toEqual(CUBE_SECTION_KIND.defaults());
    expect(made("dictionary", { infocube: true }).sections.map((s) => s.type)).toEqual(["text", "dict"]);
  });

  it("is one change event, outside the undo history (R2-4a2)", () => {
    const r = createDocument(makeCtx(ME), as("reader"), { workspaceId: ids.ws, preset: "blank" }, KINDS);
    expect(r.ok && r.writeSet.events).toEqual([expect.objectContaining({ object_type: "document_definition", operation: "create", workspace_id: ids.ws })]);
  });

  it("refuses an unknown preset, another workspace, an archived workspace and a non-member", () => {
    expect(createDocument(makeCtx(), as("owner"), { workspaceId: ids.ws, preset: "other" }, KINDS)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(createDocument(makeCtx(), as("owner"), { workspaceId: ids.org, preset: "blank" }, KINDS)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createDocument(makeCtx(), as("owner", archived), { workspaceId: ids.ws, preset: "blank" }, KINDS)).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(createDocument(makeCtx(), as(null), { workspaceId: ids.ws, preset: "blank" }, KINDS)).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("saving (D-59, F19)", () => {
  const base = (d: DocumentDefinition) => ({ workspaceId: ids.ws, documentId: d.id, expectedVersion: d.version });

  it("saves the named fields only, with the next version and a change event with both images", () => {
    const d = made("dictionary");
    const r = updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), name: "  Customer dictionary ", cover: { subtitle: "Stage 1" }, scope: { mappings: "all" } }, KINDS);
    const next = ok(r).document;
    expect(next).toMatchObject({ name: "Customer dictionary", version: d.version + 1, updated_by: ME });
    expect(next.cover).toEqual({ ...d.cover, subtitle: "Stage 1" });
    expect(next.scope).toEqual({ ...d.scope, mappings: "all" });
    expect(next.sections).toEqual(d.sections);
    expect(r.ok && r.writeSet.events[0]).toMatchObject({ operation: "update", before_image: expect.objectContaining({ name: d.name }), after_image: expect.objectContaining({ name: "Customer dictionary" }) });
  });

  it("refuses a stale version, an empty name and nothing to change", () => {
    const d = made();
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), expectedVersion: d.version + 1, name: "X" }, KINDS)).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), name: "   " }, KINDS)).toMatchObject({ ok: false, error: { message: NAME_REQUIRED } });
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), name: d.name }, KINDS)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("merges a section's options into its stored ones, keeps the columns in their order and checks them", () => {
    const d = made("dictionary");
    const dict = d.sections.find((s) => s.type === "dict")!;
    const r = updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: dict.id, options: { columns: ["definition", "attribute", "keys"] } } }, KINDS);
    expect(ok(r).document.sections.find((s) => s.id === dict.id)!.options).toEqual({ entity: dict.options.entity, columns: ["attribute", "keys", "definition"] });
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: dict.id, options: { columns: ["colour"] } } }, KINDS)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: dict.id, options: { layout: "column" } } }, KINDS)).toMatchObject({ ok: false, error: { code: "invalid" } });
    const off = updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: dict.id, on: false } }, KINDS);
    expect(ok(off).document.sections.find((s) => s.id === dict.id)!.on).toBe(false);
  });

  it("keeps a section of a type no module knows: its switch changes, its options do not", () => {
    const d = { ...made(), sections: [{ id: ids.canvas1, type: "gone.part", on: true, options: { x: 1 } }] };
    expect(ok(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: ids.canvas1, on: false } }, KINDS)).document.sections[0]).toEqual({ id: ids.canvas1, type: "gone.part", on: false, options: { x: 1 } });
    expect(updateDocument(makeCtx(ME), as("reader"), d, { ...base(d), section: { id: ids.canvas1, options: { x: 2 } } }, KINDS)).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("lets owners, admins and modelers change a shared document, not reviewers or readers", () => {
    const shared = doc({ shared: true, author_id: OTHER });
    for (const role of WORKSPACE_ROLES) {
      const r = updateDocument(makeCtx(ME), as(role), shared, { ...base(shared), audience: "Client" }, KINDS);
      expect(r.ok, role).toBe(role === "owner" || role === "admin" || role === "modeler");
    }
  });
});

describe("sharing and unsharing (D4, F17 a, step 4b)", () => {
  const member = { member: true, name: "Łukasz" };
  const input = (d: DocumentDefinition, shared: boolean) => ({ workspaceId: ids.ws, documentId: d.id, expectedVersion: d.version, shared });

  it("shares and unshares at once, for owners, admins and modelers; only its author makes it private again", () => {
    const d = made("blank", {}, "modeler");
    const shared = ok(setDocumentShared(makeCtx(ME), as("modeler"), d, input(d, true), member)).document;
    expect(shared).toMatchObject({ shared: true, author_id: ME, version: d.version + 1 });
    expect(ok(setDocumentShared(makeCtx(ME), as("modeler"), shared, input(shared, false), member)).document).toMatchObject({ shared: false, author_id: ME });
    const theirs = { ...shared, author_id: OTHER };
    for (const role of ["owner", "admin", "modeler"] as const) {
      expect(setDocumentShared(makeCtx(ME), as(role), theirs, input(theirs, false), { member: true, name: "Anna Nowak" }), role).toMatchObject({
        ok: false,
        error: { code: "forbidden", message: "Only Anna Nowak can make it private." },
      });
      expect(documentRights(as(role), theirs)).toMatchObject({ share: true, unshare: false });
    }
    expect(documentRights(as("modeler"), shared)).toMatchObject({ share: true, unshare: true });
  });

  it("refuses readers and reviewers, also their own document", () => {
    for (const role of ["reader", "reviewer"] as const) {
      const d = made("blank", {}, role);
      expect(setDocumentShared(makeCtx(ME), as(role), d, input(d, true), member)).toMatchObject({ ok: false, error: { message: RIGHTS_TEXTS.share } });
    }
  });

  it("refuses to unshare a document whose author is no longer a member", () => {
    const d = doc({ shared: true, author_id: OTHER });
    expect(setDocumentShared(makeCtx(ME), as("owner"), d, input(d, false), { member: false, name: "Anna Nowak" })).toMatchObject({
      ok: false,
      error: { message: "Anna Nowak is no longer a member of this workspace, so the document stays shared." },
    });
  });
});

describe("duplicating and deleting", () => {
  it("duplicates a document the person sees into a private copy of theirs", () => {
    const shared = doc({ id: ids.projectB, shared: true, author_id: OTHER, name: "Retail dictionary", audience: "Client" });
    const copy = ok(duplicateDocument(makeCtx(ME), as("reader"), shared, { workspaceId: ids.ws, documentId: shared.id })).document;
    expect(copy).toMatchObject({ name: "Retail dictionary (copy)", author_id: ME, shared: false, audience: "Client", version: 1 });
    expect(copy.id).not.toBe(shared.id);
    expect({ scope: copy.scope, cover: copy.cover, sections: copy.sections }).toEqual({ scope: shared.scope, cover: shared.cover, sections: shared.sections });
    const theirs = doc({ author_id: OTHER });
    expect(duplicateDocument(makeCtx(ME), as("owner"), theirs, { workspaceId: ids.ws, documentId: theirs.id })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("soft-deletes with the version: private ones by their author, shared ones by owners, admins or their author", () => {
    const input = (d: DocumentDefinition) => ({ workspaceId: ids.ws, documentId: d.id, expectedVersion: d.version });
    const mine = doc({ author_id: ME });
    expect(ok(deleteDocument(makeCtx(ME), as("reader"), mine, input(mine))).document).toMatchObject({ deleted_at: makeCtx().now, version: mine.version + 1 });
    const shared = doc({ shared: true, author_id: OTHER });
    for (const role of WORKSPACE_ROLES) expect(deleteDocument(makeCtx(ME), as(role), shared, input(shared)).ok, role).toBe(role === "owner" || role === "admin");
    expect(deleteDocument(makeCtx(ME), as("reader"), mine, { ...input(mine), expectedVersion: 9 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});
