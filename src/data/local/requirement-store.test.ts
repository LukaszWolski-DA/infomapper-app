// The local adapter for requirements (slice 4a, step 1): the demo requirements and their coverage, the data model's
// rules (the key unique in any case among live rows, the closed lists, a severity for any kind, exactly one target),
// a format-4 file, and domain commands applied end to end with undo, as the server does it.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommandContext } from "@/domain/changes";
import { deleteAttribute } from "@/domain/commands/attribute";
import { createRequirement, deleteRequirement, setRequirementStatus, updateRequirement } from "@/domain/commands/requirement";
import { revertChangeGroup } from "@/domain/commands/undo";
import { uuidv7 } from "@/domain/ids";
import { lastRequirementEditor, requirementCoverage } from "@/domain/model/requirements";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { DataStore } from "../ports";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { findViolation } from "./schema";
import { buildSeed, SEED_IDS } from "./seed";
import { seedId } from "./seed-model";
import { createLocalDataStore } from "./store";

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-requirements-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RETAIL = SEED_IDS.wsRetailDwh;
const id = (key: string) => seedId(RETAIL, key);
const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });
const accessAs = async (userId: string): Promise<WorkspaceAccess> => ({ workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, userId) });

describe("demo requirements (PRD item 15)", () => {
  it("are the prototype's five with their parents, links and key counter 106; Sales analytics has none", async () => {
    const reqs = await store.requirements.list(RETAIL);
    expect(reqs.map((r) => [r.key, r.kind, r.status, r.priority, reqs.find((p) => p.id === r.parent_id)?.key ?? null]).sort()).toEqual([
      ["REQ-101", "need", "agreed", "must", null],
      ["REQ-102", "data", "agreed", "must", "REQ-101"],
      ["REQ-103", "dq_rule", "draft", "should", "REQ-102"],
      ["REQ-104", "business_rule", "draft", "must", null],
      ["REQ-105", "non_functional", "agreed", "must", null],
    ]);
    expect(reqs.find((r) => r.key === "REQ-103")).toMatchObject({ expression: "COUNT(DISTINCT customer_id) per lower(email) = 1", severity: "warn", owner_name: "Data steward" });
    expect(reqs.find((r) => r.key === "REQ-104")).toMatchObject({ external_ref: "JIRA-481", description_html: "<p>Total amount = sum over lines of quantity × unit price × (1 − discount).</p>" });
    expect(await store.requirements.listLinks(RETAIL)).toHaveLength(13);
    expect((await store.workspaces.get(RETAIL))!.requirement_key_next).toBe(106);
    expect(await store.requirements.list(SEED_IDS.wsSales)).toEqual([]);
    // REQ-104's card on “Customer & orders” (slice 4b-2, PRD item 25), the only requirement card
    const reqCards = (await readDb(file)).canvas_item.filter((i) => i.requirement_id !== null);
    expect(reqCards).toHaveLength(1);
    expect(reqCards[0]).toMatchObject({ canvas_id: SEED_IDS.canvasCustomerOrders, requirement_id: reqs.find((r) => r.key === "REQ-104")!.id, frame_id: null });
  });

  it("have this coverage on the demo mappings (the end-to-end tests rely on it)", async () => {
    const [reqs, links, model] = await Promise.all([store.requirements.list(RETAIL), store.requirements.listLinks(RETAIL), store.model.load(RETAIL)]);
    const name = (attributeId: string) => model.attributes.find((a) => a.id === attributeId)!.name;
    const figures = reqs
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => {
        const c = requirementCoverage(r.id, links, model);
        return [r.key, `${c.covered.length} / ${c.total}`, c.notApproved.map(name), c.notMapped.map(name), c.done];
      });
    expect(figures).toEqual([
      // an entity link: one item, covered because Customer has covered attributes (slice 4b-1; 4a: 5 / 8)
      ["REQ-101", "1 / 1", [], [], true],
      ["REQ-102", "3 / 3", [], [], true],
      ["REQ-103", "1 / 1", [], [], true],
      ["REQ-104", "1 / 4", [], ["quantity", "unit_price", "discount_pct"], false],
      ["REQ-105", "3 / 4", ["birth_date"], [], false],
    ]);
  });
});

describe("the data model's rules (slice 4a migration)", () => {
  const db = buildSeed();
  const req = db.requirement.find((r) => r.key === "REQ-103")!;
  const twin = { ...req, id: uuidv7(), key: "req-103", parent_id: null };

  it("a key is unique per workspace in any case among live requirements", () => {
    expect(findViolation({ ...db, requirement: [...db.requirement, twin] })).toMatchObject({ kind: "unique", table: "requirement" });
    expect(findViolation({ ...db, requirement: [...db.requirement, { ...twin, deleted_at: twin.created_at }] })).toBeNull();
  });

  it("checks kind, status, priority and severity values; a severity is allowed for any kind; not its own parent", () => {
    const bad = (patch: object) => findViolation({ ...db, requirement: db.requirement.map((r) => (r.id === req.id ? { ...r, ...patch } : r)) });
    expect(bad({ kind: "story" })).toMatchObject({ kind: "check", detail: expect.stringContaining("requirement_kind_ck") });
    expect(bad({ status: "done" })).toMatchObject({ detail: expect.stringContaining("requirement_status_ck") });
    expect(bad({ priority: "high" })).toMatchObject({ detail: expect.stringContaining("requirement_priority_ck") });
    expect(bad({ severity: "error" })).toMatchObject({ detail: expect.stringContaining("requirement_severity_ck") });
    expect(bad({ kind: "business_rule", severity: "block" })).toBeNull();
    expect(bad({ parent_id: req.id })).toMatchObject({ detail: expect.stringContaining("requirement_not_own_parent_ck") });
    expect(bad({ parent_id: uuidv7() })).toMatchObject({ kind: "foreign_key", table: "requirement" });
  });

  it("a link has exactly one target and points at live tables", () => {
    const k = db.requirement_link[0]!;
    expect(findViolation({ ...db, requirement_link: [{ ...k, entity_id: null, attribute_id: null }] })).toMatchObject({ kind: "check", table: "requirement_link" });
    expect(findViolation({ ...db, requirement_link: [{ ...k, source_table_id: db.source_table[0]!.id }] })).toMatchObject({ kind: "check", table: "requirement_link" });
    expect(findViolation({ ...db, requirement_link: [{ ...k, requirement_id: uuidv7() }] })).toMatchObject({ kind: "foreign_key", table: "requirement_link" });
  });
});

describe("commands end to end (local adapter)", () => {
  it("refuses a duplicate key in any case, written past the domain, at the adapter", async () => {
    const reqs = await store.requirements.list(RETAIL);
    const r103 = reqs.find((r) => r.key === "REQ-103")!;
    const r = updateRequirement(ctxFor(SEED_IDS.userAnna), await accessAs(SEED_IDS.userAnna), { requirements: reqs.filter((x) => x.key !== "REQ-101") }, {
      requirementId: r103.id,
      expectedVersion: 1,
      field: "key",
      value: "req-101",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await store.apply(r.writeSet)).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("creates REQ-106 and raises the counter in one write; undo removes the requirement and keeps the counter", async () => {
    const anna = await accessAs(SEED_IDS.userAnna);
    const created = createRequirement(ctxFor(SEED_IDS.userAnna), anna, { requirements: await store.requirements.list(RETAIL) }, {});
    expect(created.ok && (await store.apply(created.writeSet))).toEqual({ ok: true });
    if (!created.ok) return;
    expect(created.value.requirement.key).toBe("REQ-106");
    expect((await store.workspaces.get(RETAIL))!.requirement_key_next).toBe(107);
    const undone = revertChangeGroup(ctxFor(SEED_IDS.userAnna), await accessAs(SEED_IDS.userAnna), { events: created.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    expect(undone.ok && (await store.apply(undone.writeSet))).toEqual({ ok: true });
    expect((await store.requirements.list(RETAIL)).map((r) => r.key)).not.toContain("REQ-106");
    expect((await store.workspaces.get(RETAIL))!.requirement_key_next).toBe(107);
  });

  it("deleting email deletes its three requirement links; one undo brings them back", async () => {
    const anna = await accessAs(SEED_IDS.userAnna);
    const model = await store.model.load(RETAIL);
    const email = model.attributes.find((a) => a.id === id("attribute:customer.email"))!;
    const before = (await store.requirements.listLinks(RETAIL)).filter((k) => k.attribute_id === email.id);
    expect(before).toHaveLength(3);
    const del = deleteAttribute(ctxFor(SEED_IDS.userAnna), anna, { attribute: email, mappings: model.mappings, mappingInputs: model.mappingInputs, requirementLinks: await store.requirements.listLinks(RETAIL) }, { attributeId: email.id, expectedVersion: 1 });
    expect(del.ok && (await store.apply(del.writeSet))).toEqual({ ok: true });
    if (!del.ok) return;
    expect((await store.requirements.listLinks(RETAIL)).filter((k) => k.attribute_id === email.id)).toEqual([]);
    const undone = revertChangeGroup(ctxFor(SEED_IDS.userAnna), anna, { events: del.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    expect(undone.ok && (await store.apply(undone.writeSet))).toEqual({ ok: true });
    expect((await store.requirements.listLinks(RETAIL)).filter((k) => k.attribute_id === email.id).map((k) => k.id).sort()).toEqual(before.map((k) => k.id).sort());
  });

  it("four-eyes: the author is read from the change log; a status change by someone else does not make them the author", async () => {
    const ws = (await store.workspaces.get(RETAIL))!;
    const fourEyes = (userId: string) => accessAs(userId).then((a) => ({ ...a, workspace: { ...a.workspace, four_eyes: true } }));
    const r103 = () => store.requirements.list(RETAIL).then((rs) => rs.find((r) => r.key === "REQ-103")!);
    expect(ws.four_eyes).toBe(false);
    // Anna edits the description, Piotr sets Implemented, then Anna tries Agreed
    let r = await r103();
    const edited = updateRequirement(ctxFor(SEED_IDS.userAnna), await fourEyes(SEED_IDS.userAnna), { requirements: [r] }, { requirementId: r.id, expectedVersion: r.version, field: "description", value: "<p>Unique.</p>" });
    expect(edited.ok && (await store.apply(edited.writeSet))).toEqual({ ok: true });
    r = await r103();
    const author = () => store.changeEvents.listForRequirement(RETAIL, r.id).then((events) => lastRequirementEditor(r, events));
    const piotr = setRequirementStatus(ctxFor(SEED_IDS.userPiotr), await fourEyes(SEED_IDS.userPiotr), { requirement: r, contentAuthorId: await author() }, { requirementId: r.id, expectedVersion: r.version, status: "implemented" });
    expect(piotr.ok && (await store.apply(piotr.writeSet))).toEqual({ ok: true });
    r = await r103();
    expect(await author()).toBe(SEED_IDS.userAnna);
    const anna = setRequirementStatus(ctxFor(SEED_IDS.userAnna), await fourEyes(SEED_IDS.userAnna), { requirement: r, contentAuthorId: await author() }, { requirementId: r.id, expectedVersion: r.version, status: "agreed" });
    expect(anna).toMatchObject({ ok: false, error: { message: "You changed REQ-103 last, so someone else has to agree it." } });
  });

  it("undoing a delete is refused when the key is used by another requirement by then", async () => {
    const anna = await accessAs(SEED_IDS.userAnna);
    const reqs = await store.requirements.list(RETAIL);
    const r104 = reqs.find((r) => r.key === "REQ-104")!;
    const del = deleteRequirement(ctxFor(SEED_IDS.userAnna), anna, { requirements: reqs, links: await store.requirements.listLinks(RETAIL), items: await store.canvasItems.list(RETAIL) }, { requirementId: r104.id, expectedVersion: 1 });
    expect(del.ok && (await store.apply(del.writeSet))).toEqual({ ok: true });
    const r101 = (await store.requirements.list(RETAIL)).find((r) => r.key === "REQ-101")!;
    const renamed = updateRequirement(ctxFor(SEED_IDS.userAnna), anna, { requirements: await store.requirements.list(RETAIL) }, { requirementId: r101.id, expectedVersion: 1, field: "key", value: "REQ-104" });
    expect(renamed.ok && (await store.apply(renamed.writeSet))).toEqual({ ok: true });
    if (!del.ok) return;
    const undone = revertChangeGroup(ctxFor(SEED_IDS.userAnna), anna, { events: del.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    expect(undone).toMatchObject({ ok: false, error: { message: "REQ-104 is used by another requirement now, so the deleted one cannot come back." } });
  });
});

describe("file format", () => {
  it("reads a slice 3a to 3b file (format 4) as one without requirements", async () => {
    const old: Record<string, unknown> = { ...(await readDb(file)), format: 4 };
    for (const t of ["requirement", "requirement_link"]) delete old[t];
    await writeFile(file, JSON.stringify(old), "utf8");
    expect(await store.requirements.list(RETAIL)).toEqual([]);
    expect(await store.requirements.listLinks(RETAIL)).toEqual([]);
    expect((await readDb(file)).format).toBe(10);
  });

  it("reads a slice 4a to 6b file (format 5) as one without source imports, the new columns null (slice 7a)", async () => {
    const db = await readDb(file);
    const strip = <R extends object>(rows: R[], keys: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))));
    const old: Record<string, unknown> = {
      ...db,
      format: 5,
      source_table: strip(db.source_table, ["file_format", "missing_since", "retired_since"]),
      source_column: strip(db.source_column, ["missing_since", "retired_since", "not_needed"]),
      mapping: strip(db.mapping, ["review_reason"]),
    };
    for (const t of ["source_relationship", "source_relationship_column", "source_import", "source_change"]) delete old[t];
    await writeFile(file, JSON.stringify(old), "utf8");
    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(10);
    expect([upgraded.source_relationship, upgraded.source_relationship_column, upgraded.source_import]).toEqual([[], [], []]);
    expect(upgraded.source_table.every((t) => t.file_format === null && t.missing_since === null)).toBe(true);
    expect(upgraded.source_column.every((c) => c.missing_since === null)).toBe(true);
    expect(upgraded.mapping.every((m) => m.review_reason === null)).toBe(true);
    expect(upgraded.source_change).toEqual([]);
    expect(upgraded.source_column.every((c) => c.retired_since === null && c.not_needed === false)).toBe(true);
  });

  it("reads a slice 7a file (format 6) with the open changes its imports leave, once, written back (slice 7b, P2, F1)", async () => {
    const db = await readDb(file);
    const strip = <R extends object>(rows: R[], keys: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))));
    // CRM re-imported at AT without customers.segment: missing since then, the import recorded
    const AT = "2026-10-24T09:00:00.000Z";
    const segment = db.source_column.find((c) => c.name === "segment")!;
    const crm = db.source_table.find((t) => t.id === segment.source_table_id)!.source_system_id;
    const imp = { id: uuidv7(), workspace_id: RETAIL, version: 1, created_at: AT, created_by: SEED_IDS.userLukasz, updated_at: AT, updated_by: SEED_IDS.userLukasz, deleted_at: null, source_system_id: crm, channel: "file", source_label: "crm.csv", tables_new: 0, columns_new: 0, columns_changed: 0, columns_renamed: 0, columns_missing: 1, relationships_new: 0 };
    const old: Record<string, unknown> = {
      ...db,
      format: 6,
      source_table: strip(db.source_table, ["retired_since"]),
      source_column: strip(db.source_column, ["retired_since", "not_needed"]).map((c) => (c.id === segment.id ? { ...c, missing_since: AT } : c)),
      source_import: [imp],
    };
    delete old.source_change;
    await writeFile(file, JSON.stringify(old), "utf8");
    const upgraded = await readDb(file);
    expect(upgraded.source_change.map((c) => [c.kind, c.object_label, c.source_import_id, c.created_by, c.created_at, c.status])).toEqual([
      ["column_left", "dbo.customers.segment", imp.id, SEED_IDS.userLukasz, AT, "open"],
    ]);
    expect(upgraded.source_change[0]!.detail).toBe("Not in the file. Was char(3). Raised when slice 7b was installed.");
    expect(upgraded.source_import[0]).toMatchObject({ changes_raised: 0, changes_high: 0 });
    const event = upgraded.change_event.find((e) => e.object_type === "source_change")!;
    expect(event).toMatchObject({ object_id: upgraded.source_change[0]!.id, operation: "create", user_id: SEED_IDS.userLukasz });
    // written back at once: the next read sees the same rows, and the file breaks no rule
    const again = await readDb(file);
    expect(again.format).toBe(10);
    expect(again.source_change.map((c) => c.id)).toEqual(upgraded.source_change.map((c) => c.id));
    expect(findViolation(again)).toBeNull();
    expect((await store.model.listChanges(RETAIL)).map((c) => c.kind)).toEqual(["column_left"]);
  });
});
