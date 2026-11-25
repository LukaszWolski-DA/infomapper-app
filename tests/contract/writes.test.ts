// The contract of the writes (slice 30, S30-10): the same writes on the same rows give the same answers and leave the
// same data on both adapters, and the count rules hold under writes at the same moment (S30-07).
//
// - The scenario: one sequence of domain commands (a concept, an entity, an attribute, a rename, a cascade delete with
//   its undo and redo, an import with its undo) and of hand-built write sets for what the adapter alone must refuse (a
//   stale version, a row not found, a unique index, a foreign key, a check, the six count rules, the access read again),
//   run on each adapter from the same rows, with the same ids and times. Every answer is compared, then every read of
//   `reads.test.ts`.
// - The concurrency cases: two write sets built from one read, applied at once (`Promise.all`), for each count rule and
//   for one row saved twice from the same version: at most one is stored, the other gets the rule's refusal, and the
//   data keeps the thing counted.
//
// The local adapter always runs (in `npm test`). Postgres runs when INFOMAPPER_CONTRACT_DB names a database on this
// machine (CI's container, the "Schema" workflow); the writes use their own database beside it (`{name}_writes`), made
// here, so the two files never load into one database at once.

import { readFileSync } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose/tables";
import { buildWriteSet, type CommandContext, type CommandResult, type Write, type WriteSet } from "@/domain/changes";
import { addAttribute } from "@/domain/commands/attribute";
import { createBaseline, deleteBaseline, renameBaseline } from "@/domain/commands/baseline";
import { baselineContentNow } from "@/compose/baselines";
import { baselineDocumentCounts, baselineRefs, documentModel } from "@/compose/document-model";
import { DOCUMENT_SECTION_KINDS } from "@/compose/documents";
import { createDocument, updateDocument } from "@/modules/infodocumenter/domain/commands";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";
import { createConcept } from "@/domain/commands/concept";
import { createEntity, deleteEntity, updateEntity } from "@/domain/commands/entity";
import { importSources, importStateOf } from "@/domain/commands/import";
import { acceptInvitation, createInvitation, createPasswordReset, renewInvitation, revokeInvitation, redeemPasswordReset } from "@/domain/commands/invitations";
import { revertChangeGroup } from "@/domain/commands/undo";
import { planFingerprint } from "@/domain/import/compare";
import { buildPlan } from "@/domain/import/plan";
import { readStandard } from "@/domain/import/standard";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { AnyRow } from "@/data/rows";
import type { DevDb } from "@/data/local/schema";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { ApplyOptions, ApplyResult, DataStore } from "@/data/ports";
import { pgClientConfig } from "@/data/postgres/config";
import { getPool } from "@/data/postgres/pool";
import { createPostgresDataStore } from "@/data/postgres/store";
import { assertLocalDatabase, contractClock, contractRows, preparePostgres, readEverything, spreadAll } from "./shared";

const clock = () => contractClock("01a1c000");

const RETAIL = SEED_IDS.wsRetailDwh;
const LUKASZ = SEED_IDS.userLukasz;
const ANNA = SEED_IDS.userAnna;

/** An answer as both adapters must give it: the code and the message up to its detail in brackets (table and rule). */
const answerOf = (r: ApplyResult) => (r.ok ? { ok: true } : { ok: false, code: r.error.code, message: r.error.message.split(" (")[0] });

const ok = <T>(r: CommandResult<T>): WriteSet & { value: T } => {
  if (!r.ok) throw new Error(r.error.message);
  return Object.assign(r.writeSet, { value: r.value });
};

interface Store {
  store: DataStore;
  done: () => Promise<void>;
}

async function localStore(db: DevDb): Promise<Store> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-contract-writes-"));
  const file = path.join(dir, "db.json");
  fs.writeFileSync(file, JSON.stringify(db));
  return { store: createLocalDataStore(file, STORE_SCHEMA), done: async () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const CONTRACT_DB = process.env.INFOMAPPER_CONTRACT_DB;

/** The writes' own database on the contract server, made when missing. */
async function writesDatabase(): Promise<string> {
  assertLocalDatabase(CONTRACT_DB!);
  const url = new URL(CONTRACT_DB!);
  const name = `${url.pathname.slice(1)}_writes`;
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("The contract database's name is not a plain name.");
  const admin = new Client(pgClientConfig(CONTRACT_DB!));
  await admin.connect();
  try {
    if (!(await admin.query("select 1 from pg_database where datname = $1", [name])).rows.length) await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }
  url.pathname = `/${name}`;
  return url.toString();
}

let pgUrl: string | null = null;
async function postgresStore(db: DevDb): Promise<Store> {
  pgUrl ??= await writesDatabase();
  await preparePostgres(pgUrl, db);
  process.env.INFOMAPPER_DATABASE_URL = pgUrl;
  return { store: createPostgresDataStore(STORE_SCHEMA), done: async () => undefined };
}

afterAll(async () => {
  if (pgUrl) await getPool().end();
});

/** A live canvas of the workspace that is in a project (the contract rows delete one of the seed's canvases). */
async function liveCanvas(store: DataStore, workspaceId = RETAIL): Promise<string> {
  for (const c of await store.canvases.list(workspaceId)) if ((await store.canvases.listLinksOfCanvas(workspaceId, c.id)).length) return c.id;
  throw new Error("No live canvas in a project.");
}

const accessOf = async (store: DataStore, userId: string, workspaceId: string = RETAIL): Promise<WorkspaceAccess> => ({
  workspace: (await store.workspaces.get(workspaceId))!,
  member: await store.workspaces.getMember(workspaceId, userId),
});

/** A versioned row's next version, as a command writes it. */
const next = <R extends object>(ctx: CommandContext, row: R, patch: Partial<R>): R =>
  ({ ...row, ...patch, version: ((row as AnyRow).version as number) + 1, updated_at: ctx.now, updated_by: ctx.actorId }) as R;
const update = (table: string, before: object, row: object) => ({ kind: "update", table, before, row }) as unknown as Write;
const insert = (table: string, row: object) => ({ kind: "insert", table, row }) as unknown as Write;
const remove = (table: string, before: object) => ({ kind: "remove", table, before }) as unknown as Write;

/** The scenario's steps: each runs one write and answers what the adapter said. */
async function scenario(store: DataStore, ctxOf: (actorId: string) => CommandContext): Promise<Record<string, unknown>> {
  const answers: Record<string, unknown> = {};
  const step = async (name: string, writeSet: WriteSet, options?: ApplyOptions) => {
    answers[name] = answerOf(await store.apply(writeSet, options));
  };
  const anna = await accessOf(store, ANNA);

  // slice 35 (S35-03, S35-05): a baseline taken before every write below; at the end its content is what was taken
  const lukaszAccess = await accessOf(store, LUKASZ);
  const taken = (await baselineContentNow(store, RETAIL))!;
  const baselineState = async () => ({ baselines: await store.baselines.listAll(RETAIL) });
  const take = ok(createBaseline(ctxOf(LUKASZ), lukaszAccess, await baselineState(), taken, { workspaceId: RETAIL, name: "Contract  Baseline", note: " Before the scenario. " }));
  await step("baseline: create", take);
  const baselineId = take.value.baseline.id;

  // a concept and an entity on a canvas, then an attribute and a rename (inserts, then a versioned update)
  const concept = ok(createConcept(ctxOf(ANNA), anna, { concepts: (await store.model.load(RETAIL)).concepts }, { name: "Finance" }));
  await step("create concept", concept);
  let m = await store.model.load(RETAIL);
  const canvasId = await liveCanvas(store);
  const entity = ok(
    createEntity(ctxOf(ANNA), anna, { concept: m.concepts.find((c) => c.id === concept.value.conceptId)!, entities: m.entities, canvas: await store.canvases.get(RETAIL, canvasId) }, {
      conceptId: concept.value.conceptId,
      placement: { canvasId, x: 900, y: 40 },
    }),
  );
  await step("create entity", entity);
  m = await store.model.load(RETAIL);
  const made = m.entities.find((e) => e.id === entity.value.entityId)!;
  await step("add attribute", ok(addAttribute(ctxOf(ANNA), anna, { entity: made, attributes: m.attributes }, { entityId: made.id, name: "amount" })));
  const rename = ok(updateEntity(ctxOf(ANNA), anna, { entity: made, entities: m.entities, concept: null, stereotypes: m.stereotypes }, { entityId: made.id, expectedVersion: made.version, name: "Invoice" }));
  await step("rename entity", rename);
  // the same rename again from the version it was read at: someone changed it meanwhile
  await step("stale version", ok(updateEntity(ctxOf(ANNA), anna, { entity: made, entities: m.entities, concept: null, stereotypes: m.stereotypes }, { entityId: made.id, expectedVersion: made.version, name: "Bill" })));

  // a cascade: an entity with its attribute and its card (soft deletes), its undo and redo
  m = await store.model.load(RETAIL);
  // the entity made above, with its attribute and its card (the seed's entities carry the contract rows' guard cases)
  const customer = m.entities.find((e) => e.id === made.id)!;
  const del = ok(deleteEntity(ctxOf(ANNA), anna, { ...m, entity: customer, canvasItems: await store.canvasItems.list(RETAIL) }, { entityId: customer.id, expectedVersion: customer.version }));
  await step("delete an entity", del);
  const undone = ok(revertChangeGroup(ctxOf(ANNA), anna, { events: del.events, rows: await store.model.loadForUndo(RETAIL) }, "undo", UNDO_TABLES));
  await step("undo delete an entity", undone);
  await step("redo delete an entity", ok(revertChangeGroup(ctxOf(ANNA), anna, { events: undone.events, rows: await store.model.loadForUndo(RETAIL) }, "redo", UNDO_TABLES)));

  // an import into a new system (inserts across the source tables, classification links, the import), and its undo
  const text = readFileSync(path.resolve(__dirname, "../../src/domain/import/samples/crm_snapshot_2026-10-20.csv"), "utf8");
  const read = readStandard(text, "crm.csv");
  const state = importStateOf(await store.model.load(RETAIL), await store.model.listChanges(RETAIL));
  const target = { newName: "CRM contract" };
  const scope = read.tables.map((t) => t.key);
  const plan = buildPlan(state.model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
  const imported = ok(
    importSources(ctxOf(ANNA), anna, state, { target, channel: "file", sourceLabel: "crm.csv", text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) }),
  );
  await step("import", imported);
  await step("undo import", ok(revertChangeGroup(ctxOf(ANNA), anna, { events: imported.events, rows: await store.model.loadForUndo(RETAIL) }, "undo", UNDO_TABLES)));

  // F8: a child written before its parent in one write set is stored (the phases put the parent first)
  {
    const ctx = ctxOf(ANNA);
    const conceptId = ctx.newId();
    const base = { version: 1, created_at: ctx.now, created_by: ANNA, updated_at: ctx.now, updated_by: ANNA, deleted_at: null, workspace_id: RETAIL };
    const parent = { ...m.concepts[0]!, ...base, id: conceptId, name: "Child first", sort_order: 99 };
    const child = { ...m.entities.find((e) => e.name === "Product")!, ...base, id: ctx.newId(), concept_id: conceptId, name: "Child of child first" };
    await step("child before parent", buildWriteSet(ctx, RETAIL, [insert("entity", child), insert("concept", parent)]));
  }

  // what the adapter refuses by itself
  m = await store.model.load(RETAIL);
  {
    const ctx = ctxOf(ANNA);
    const product = m.entities.find((e) => e.name === "Product")!;
    await step("not found", buildWriteSet(ctx, RETAIL, [update("entity", { ...product, id: "01a1c0ff-0000-7000-8000-000000000001" }, next(ctx, { ...product, id: "01a1c0ff-0000-7000-8000-000000000001" }, { name: "Ghost" }))]));
    const system = m.sourceSystems[0]!;
    await step("unique index", buildWriteSet(ctx, RETAIL, [insert("source_system", { ...system, id: ctx.newId(), created_at: ctx.now })]));
    const attribute = m.attributes[0]!;
    await step("foreign key", buildWriteSet(ctx, RETAIL, [insert("attribute", { ...attribute, id: ctx.newId(), entity_id: "01a1c0ff-0000-7000-8000-000000000002", created_at: ctx.now })]));
    const mapping = m.mappings[0]!;
    await step("check", buildWriteSet(ctx, RETAIL, [update("mapping", mapping, next(ctx, mapping, { status: "bogus" } as never))]));
  }

  // the count rules, written past the domain's own checks
  {
    const ctx = ctxOf(LUKASZ);
    const projects = await store.projects.list(RETAIL);
    await step("count: last project", buildWriteSet(ctx, RETAIL, projects.map((p) => update("project", p, next(ctx, p, { deleted_at: ctx.now })))));
    const owners = (await store.workspaces.listMembers(RETAIL)).filter((x) => x.role === "owner");
    await step("count: last owner", buildWriteSet(ctx, RETAIL, owners.map((o) => update("workspace_member", o, { ...o, role: "admin" }))));
    const links = await store.canvases.listLinksOfCanvas(RETAIL, canvasId);
    await step("count: canvas links", buildWriteSet(ctx, RETAIL, links.map((l) => remove("project_canvas", l))));
    const workspace = (await store.workspaces.get(RETAIL))!;
    const product = m.entities.find((e) => e.name === "Product")!;
    await step(
      "count: InfoCube off",
      buildWriteSet(ctx, RETAIL, [
        update("workspace", workspace, next(ctx, workspace, { infocube: false })),
        insert("entity", { ...product, id: ctx.newId(), name: "Dim Off", model_level: "dimensional", created_at: ctx.now }),
      ]),
    );
    const lukaszHere = (await store.workspaces.getMember(RETAIL, LUKASZ))!;
    const otherOwner = { ...lukaszHere, user_id: ANNA, role: "owner" as const };
    const annaHere = (await store.workspaces.getMember(RETAIL, ANNA))!;
    // Łukasz owns InfoMate: out of every one of his InfoMate workspaces at once, another owner left in each
    const his = (await store.workspaces.listForUser(LUKASZ)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
    const writes: Write[] = [update("workspace_member", annaHere, otherOwner)];
    for (const w of his) {
      if (w.id !== RETAIL) {
        const anyone = (await store.workspaces.listMembers(w.id)).find((x) => x.user_id !== LUKASZ);
        if (anyone) writes.push(update("workspace_member", anyone, { ...anyone, role: "owner" }));
        else writes.push(insert("workspace_member", { workspace_id: w.id, user_id: ANNA, role: "owner", added_by: LUKASZ, created_at: ctx.now }));
      }
      writes.push(remove("workspace_member", (await store.workspaces.getMember(w.id, LUKASZ))!));
    }
    await step("count: organization owner's last workspace", buildWriteSet(ctx, RETAIL, writes));
  }

  // the access read again: a role and an archive other than the command checked
  {
    const ctx = ctxOf(ANNA);
    const product = m.entities.find((e) => e.name === "Product")!;
    const set = () => buildWriteSet(ctx, RETAIL, [update("entity", product, next(ctx, product, { alias: "checked" }))]);
    const ws = (await store.workspaces.get(RETAIL))!;
    await step("access: role changed", set(), { access: { userId: ANNA, workspace: { id: RETAIL, name: ws.name, archived: false, role: "owner" } } });
    await step("access: archived meanwhile", set(), { access: { userId: ANNA, workspace: { id: RETAIL, name: ws.name, archived: true, role: "modeler" } } });
    await step("access: as checked", set(), { access: { userId: ANNA, workspace: { id: RETAIL, name: ws.name, archived: false, role: "modeler" } } });
  }

  // a link row changed in place (a tab order) from the row it was read as, and once more from that old row: stale
  {
    const ctx = ctxOf(LUKASZ);
    const [link] = await store.canvases.listLinksOfCanvas(RETAIL, await liveCanvas(store));
    await step("link update", buildWriteSet(ctx, RETAIL, [update("project_canvas", link!, { ...link!, sort_order: link!.sort_order + 10 })]));
    await step("link update, stale", buildWriteSet(ctx, RETAIL, [update("project_canvas", link!, { ...link!, sort_order: link!.sort_order + 20 })]));
  }

  // slice 33: invitations and reset links through their commands, on both adapters
  {
    const lukasz = await accessOf(store, LUKASZ);
    const inviteState = async (email: string) => ({
      access: lukasz,
      account: await store.users.getByEmail(email),
      members: await store.workspaces.listMembers(RETAIL),
      invitations: await store.invitations.listOpen(RETAIL),
    });
    const made = ok(createInvitation(ctxOf(LUKASZ), await inviteState("ola.nowa@example.com"), { workspaceId: RETAIL, email: "Ola.Nowa@example.com", role: "reviewer", tokenHash: hex(1) }));
    await step("invite", made);
    // the pending index, written past the command's own check
    await step("invite, pending twice", buildWriteSet(ctxOf(LUKASZ), RETAIL, [insert("invitation", { ...(await store.invitations.get(RETAIL, made.value.invitationId))!, id: ctxOf(LUKASZ).newId(), token_hash: hex(2) })]));
    const renewed = ok(renewInvitation(ctxOf(LUKASZ), { access: lukasz, invitation: await store.invitations.get(RETAIL, made.value.invitationId) }, { workspaceId: RETAIL, invitationId: made.value.invitationId, tokenHash: hex(3) }));
    await step("new link", renewed);
    // accepting: a new person, signed by the id the caller made
    const acceptState = async (tokenHash: string) => {
      const invitation = await store.invitations.getByTokenHash(tokenHash);
      const workspace = invitation ? await store.workspaces.get(invitation.workspace_id) : null;
      const account = invitation ? await store.users.getByEmail(invitation.email) : null;
      const organizationId = workspace?.organization_id;
      return {
        invitation,
        workspace,
        organization: organizationId ? await store.organizations.get(organizationId) : null,
        inviter: invitation ? await store.users.get(invitation.invited_by) : null,
        account,
        accountOrganizationMember: account && organizationId ? await store.organizations.getMember(organizationId, account.id) : null,
        accountWorkspaceIds: account ? (await store.workspaces.listForUser(account.id)).filter((w) => w.organization_id === organizationId).map((w) => w.id) : [],
      };
    };
    const stale = await acceptState(hex(3));
    const newcomer = ctxOf(LUKASZ).newId();
    const joinCtx = { ...ctxOf(newcomer), actorId: newcomer };
    // the link before "New link" finds nothing: the command refuses before anything is written
    const old = acceptInvitation(joinCtx, await acceptState(hex(1)), { tokenHash: hex(1), name: "Ola Nowa", authUserId: null });
    answers["accept, the old link"] = old.ok ? { ok: true } : { ok: false, code: old.error.code, message: old.error.message };
    await step("accept, new person", ok(acceptInvitation(joinCtx, stale, { tokenHash: hex(3), name: "Ola Nowa", authUserId: null })));
    // an existing person (Anna, already in InfoMate) into another InfoMate workspace
    const annaRow = (await store.users.get(ANNA))!;
    const annaIn = new Set((await store.workspaces.listForUser(ANNA)).map((w) => w.id));
    const target = (await store.workspaces.listForUser(LUKASZ)).find((w) => w.organization_id === SEED_IDS.orgInfoMate && !annaIn.has(w.id));
    expect(target, "an InfoMate workspace of Łukasz's without Anna").toBeDefined();
    {
      const there = await accessOf(store, LUKASZ, target!.id);
      await step(
        "invite, existing person",
        ok(createInvitation(ctxOf(LUKASZ), { access: there, account: annaRow, members: await store.workspaces.listMembers(target!.id), invitations: await store.invitations.listOpen(target!.id) }, { workspaceId: target!.id, email: annaRow.email, role: "reader", tokenHash: hex(4) })),
      );
      await step("accept, existing person", ok(acceptInvitation(ctxOf(ANNA), await acceptState(hex(4)), { tokenHash: hex(4), authUserId: null })));
    }
    // revoking the contract rows' pending one
    const pending = (await store.invitations.listOpen(RETAIL)).find((i) => i.email === "pending.person@example.com")!;
    await step("revoke", ok(revokeInvitation(ctxOf(LUKASZ), { access: lukasz, invitation: pending }, { workspaceId: RETAIL, invitationId: pending.id })));
    // a reset link for the person who just joined (only in Retail Co – DWH, a member of InfoMate), then used
    const ola = (await store.users.getByEmail("ola.nowa@example.com"))!;
    const reach = {
      workspaces: await Promise.all(
        (await store.workspaces.listForUser(ola.id)).map(async (w) => ({
          workspaceId: w.id,
          organizationId: w.organization_id,
          personRole: (await store.workspaces.getMember(w.id, ola.id))!.role,
          actorRole: (await store.workspaces.getMember(w.id, LUKASZ))?.role ?? null,
        })),
      ),
      organizations: await store.organizations.listMembershipsOfUsers([ola.id]),
    };
    const resetState = async () => ({ access: lukasz, person: ola, members: await store.workspaces.listMembers(RETAIL), reach, resets: await store.passwordResets.listOfUser(ola.id) });
    await step("reset link", ok(createPasswordReset(ctxOf(LUKASZ), await resetState(), { workspaceId: RETAIL, userId: ola.id, tokenHash: hex(5) })));
    await step("reset link again", ok(createPasswordReset(ctxOf(LUKASZ), await resetState(), { workspaceId: RETAIL, userId: ola.id, tokenHash: hex(6) })));
    const redeemState = async (h: string) => {
      const reset = await store.passwordResets.getByTokenHash(h);
      return { reset, person: reset ? await store.users.get(reset.app_user_id) : null };
    };
    await step("use reset link", ok(redeemPasswordReset(ctxOf(ola.id), await redeemState(hex(6)), { tokenHash: hex(6), authUserId: null })));
  }

  // slice 35: the baseline's rename (and a stale one), the unique name past the command's check, an update that carries a
  // content (refused by both adapters), its delete and its name taken again; its content unchanged by everything above
  {
    const ctx = ctxOf(LUKASZ);
    const b = (await store.baselines.get(RETAIL, baselineId))!;
    answers["baseline: content unchanged by the writes"] = JSON.stringify(sortedKeys(await store.baselines.content(RETAIL, baselineId))) === JSON.stringify(sortedKeys(taken));
    const renamed = ok(renameBaseline(ctx, lukaszAccess, await baselineState(), b, { baselineId, expectedVersion: b.version, name: "Contract renamed", note: null }));
    await step("baseline: rename", renamed);
    answers["baseline: content unchanged by its rename"] = JSON.stringify(sortedKeys(await store.baselines.content(RETAIL, baselineId))) === JSON.stringify(sortedKeys(taken));
    await step("baseline: rename, stale", ok(renameBaseline(ctxOf(LUKASZ), lukaszAccess, { baselines: [] }, b, { baselineId, expectedVersion: b.version, name: "Contract stale", note: null })));
    const now = (await store.baselines.get(RETAIL, baselineId))!;
    await step("baseline: same name twice", buildWriteSet(ctx, RETAIL, [insert("baseline", { ...now, id: ctx.newId(), created_at: ctx.now, version: 1, snapshot: taken })]));
    await step("baseline: content rewritten", buildWriteSet(ctx, RETAIL, [update("baseline", now, { ...next(ctx, now, { note: "x" }), snapshot: taken })]));
    // slice 36 (S36-01, S36-03, S36-05): the sign-off preset's row from the newest baseline, Anna's private document from
    // it, a source switched to the live model and back, a source the database's pairing refuses, the documents' count
    // with another person's private document, and after the delete the documents kept and read as gone
    const refs = await baselineRefs(store, RETAIL);
    const signoff = ok(createDocument(ctxOf(LUKASZ), lukaszAccess, { workspaceId: RETAIL, preset: "signoff" }, DOCUMENT_SECTION_KINDS, [], refs));
    await step("document: sign-off preset", signoff);
    const fromIt = ok(createDocument(ctxOf(ANNA), anna, { workspaceId: RETAIL, preset: "signoff", baselineId }, DOCUMENT_SECTION_KINDS, [], refs));
    await step("document: from a baseline, private", fromIt);
    const docOf = async (id: string) => (await store.modules.list(RETAIL, "document_definition")).find((d) => d.id === id) as DocumentDefinition;
    const stored = await docOf(signoff.value.document.id);
    answers["document: sign-off row"] = { preset: stored.preset, source_kind: stored.source_kind, baseline: stored.baseline_id === baselineId, watermark: stored.style.watermark, sections: stored.sections.map((x) => x.type) };
    const asLive = ok(updateDocument(ctxOf(LUKASZ), lukaszAccess, stored, { workspaceId: RETAIL, documentId: stored.id, expectedVersion: stored.version, source: { kind: "live" } }, DOCUMENT_SECTION_KINDS, undefined, refs));
    await step("document: source to the live model", asLive);
    const live = await docOf(stored.id);
    await step("document: source to a baseline again", ok(updateDocument(ctxOf(LUKASZ), lukaszAccess, live, { workspaceId: RETAIL, documentId: live.id, expectedVersion: live.version, source: { kind: "baseline", baselineId } }, DOCUMENT_SECTION_KINDS, undefined, refs)));
    const again = await docOf(stored.id);
    const unpaired = ctxOf(LUKASZ);
    await step("document: a baseline source without its id", buildWriteSet(unpaired, RETAIL, [update("document_definition", again, next(unpaired, again, { baseline_id: null }))]));
    answers["document: count with another's private document"] = (await baselineDocumentCounts(store, RETAIL))[baselineId];
    // each write after the documents' on a later clock, so the change log's order is the writes' order on both adapters
    const later = ctxOf(LUKASZ);
    await step("baseline: delete", ok(deleteBaseline(later, lukaszAccess, now, { baselineId, expectedVersion: now.version })));
    const kept = await docOf(stored.id);
    answers["document: kept after its baseline's delete"] = { live: kept.deleted_at === null, baseline: kept.baseline_id === baselineId, count: (await baselineDocumentCounts(store, RETAIL))[baselineId] ?? null };
    answers["document: its baseline gone"] = (await documentModel(store, (await store.workspaces.get(RETAIL))!, kept))?.source.kind;
    await step("baseline: name free again", ok(createBaseline(ctxOf(LUKASZ), lukaszAccess, await baselineState(), taken, { workspaceId: RETAIL, name: "contract renamed" })));
    answers["baseline: no content read after its delete"] = (await store.baselines.content(RETAIL, baselineId)) === null;
  }
  return answers;
}

/** A value with every object's keys sorted (Postgres's jsonb keeps no key order). */
function sortedKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortedKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys((v as Record<string, unknown>)[k])]));
  return v;
}

/** A link's token hash as the server hands it on. */
const hex = (n: number) => n.toString(16).padStart(64, "d");

const EXPECTED: Record<string, unknown> = {
  "baseline: create": { ok: true },
  "create concept": { ok: true },
  "create entity": { ok: true },
  "add attribute": { ok: true },
  "rename entity": { ok: true },
  "stale version": { ok: false, code: "stale_version", message: "Someone changed this meanwhile." },
  "delete an entity": { ok: true },
  "undo delete an entity": { ok: true },
  "redo delete an entity": { ok: true },
  import: { ok: true },
  "undo import": { ok: true },
  "child before parent": { ok: true },
  "not found": { ok: false, code: "not_found", message: "This record does not exist." },
  "unique index": { ok: false, code: "conflict", message: "This already exists" },
  "foreign key": { ok: false, code: "not_found", message: "This refers to something that does not exist" },
  check: { ok: false, code: "invalid", message: "A data rule was broken" },
  "count: last project": { ok: false, code: "invalid", message: "A workspace needs at least one project." },
  "count: last owner": { ok: false, code: "invalid", message: "Retail Co – DWH needs at least one owner." },
  "count: canvas links": { ok: false, code: "invalid", message: "A canvas belongs to at least one project." },
  "count: InfoCube off": { ok: false, code: "invalid", message: "InfoCube can be turned off only when this workspace has no facts or dimensions. It has 8: delete them first." },
  "count: organization owner's last workspace": { ok: false, code: "invalid", message: "Łukasz owns InfoMate, so they keep at least one workspace there." },
  "access: role changed": { ok: false, code: "forbidden", message: "Your role in Retail Co – DWH changed meanwhile, so nothing was saved." },
  "access: archived meanwhile": { ok: false, code: "stale_version", message: "Someone changed this meanwhile." },
  "access: as checked": { ok: true },
  "link update": { ok: true },
  "link update, stale": { ok: false, code: "stale_version", message: "Someone changed this meanwhile." },
  invite: { ok: true },
  "invite, pending twice": { ok: false, code: "conflict", message: "This already exists" },
  "new link": { ok: true },
  "accept, the old link": { ok: false, code: "not_found", message: "This invitation link has expired, was already used or was revoked. Nothing was changed." },
  "accept, new person": { ok: true },
  "invite, existing person": { ok: true },
  "accept, existing person": { ok: true },
  revoke: { ok: true },
  "reset link": { ok: true },
  "reset link again": { ok: true },
  "use reset link": { ok: true },
  // slice 35
  "baseline: content unchanged by the writes": true,
  "baseline: rename": { ok: true },
  "baseline: content unchanged by its rename": true,
  "baseline: rename, stale": { ok: false, code: "stale_version", message: "Someone changed this meanwhile." },
  "baseline: same name twice": { ok: false, code: "conflict", message: "This already exists" },
  "baseline: content rewritten": { ok: false, code: "invalid", message: "A baseline's content never changes." },
  // slice 36
  "document: sign-off preset": { ok: true },
  "document: from a baseline, private": { ok: true },
  "document: sign-off row": {
    preset: "signoff",
    source_kind: "baseline",
    baseline: true,
    watermark: false,
    sections: ["text", "conv", "overview", "ready", "diagrams", "dict", "s2t", "reqs", "trace", "dq", "sources", "classreg", "changes"],
  },
  "document: source to the live model": { ok: true },
  "document: source to a baseline again": { ok: true },
  "document: a baseline source without its id": { ok: false, code: "invalid", message: "A data rule was broken" },
  "document: count with another's private document": 2,
  "document: kept after its baseline's delete": { live: true, baseline: true, count: null },
  "document: its baseline gone": "gone",
  "baseline: delete": { ok: true },
  "baseline: name free again": { ok: true },
  "baseline: no content read after its delete": true,
};

describe("the writes on the local adapter (S30-10)", () => {
  let s: Store;
  let answers: Record<string, unknown>;
  beforeAll(async () => {
    s = await localStore(spreadAll(contractRows()));
    answers = await scenario(s.store, clock());
  }, 120_000);
  afterAll(async () => s?.done());

  it("answers every step as the contract says", () => {
    expect(answers).toEqual(EXPECTED);
  });
});

describe.runIf(!!CONTRACT_DB)("the writes on Postgres: the same answers and the same data as the local adapter's (S30-10)", () => {
  let local: Store;
  let pg: Store;
  let localAnswers: Record<string, unknown>;
  let pgAnswers: Record<string, unknown>;
  let localReads: Record<string, unknown>;
  let pgReads: Record<string, unknown>;
  beforeAll(async () => {
    const db = spreadAll(contractRows());
    local = await localStore(db);
    pg = await postgresStore(db);
    localAnswers = await scenario(local.store, clock());
    pgAnswers = await scenario(pg.store, clock());
    localReads = await readEverything(local.store, db);
    pgReads = await readEverything(pg.store, db);
  }, 600_000);
  afterAll(async () => local?.done());

  it("answers every step as the local adapter does", () => {
    expect(pgAnswers).toEqual(localAnswers);
  });

  it("leaves the data every read gives as the local adapter does", () => {
    for (const name of Object.keys(localReads)) {
      // loadForUndo returns deleted rows too; compared as sets past a crowded millisecond, as reads.test.ts does
      expect.soft(pgReads[name], name).toEqual(localReads[name]);
    }
  });
});

/** Two write sets built from one read, applied at once: the answers, in either order. */
async function atOnce(store: DataStore, a: WriteSet, b: WriteSet): Promise<ApplyResult[]> {
  return Promise.all([store.apply(a), store.apply(b)]);
}

/** One of the two stored, the other refused with `message`. */
function oneWins(results: ApplyResult[], code: string, message: string) {
  const answers = results.map(answerOf);
  expect(answers.filter((r) => r.ok)).toHaveLength(1);
  expect(answers.find((r) => !r.ok)).toEqual({ ok: false, code, message });
}

function concurrency(name: string, make: (db: DevDb) => Promise<Store>) {
  describe(`${name}: writes at the same moment (S30-07)`, { timeout: 120_000 }, () => {
    let s: Store;
    let ctxOf: (actorId: string) => CommandContext;
    // each case from the same fresh rows
    beforeEach(async () => {
      s = await make(spreadAll(contractRows()));
      ctxOf = clock();
    }, 300_000);
    afterEach(async () => s?.done());

    it("the last two projects deleted at once: one stays", async () => {
      const store = s.store;
      const ctx = ctxOf(LUKASZ);
      const projects = await store.projects.list(RETAIL);
      // keep two: the others go first (their canvases stay linked to them; only the project count is tested)
      if (projects.length > 2) {
        const setup = await store.apply(buildWriteSet(ctx, RETAIL, projects.slice(2).map((p) => update("project", p, next(ctx, p, { deleted_at: ctx.now })))));
        expect(setup).toEqual({ ok: true });
      }
      const [p1, p2] = await store.projects.list(RETAIL);
      const c2 = ctxOf(LUKASZ);
      const results = await atOnce(store, buildWriteSet(c2, RETAIL, [update("project", p1!, next(c2, p1!, { deleted_at: c2.now }))]), buildWriteSet(c2, RETAIL, [update("project", p2!, next(c2, p2!, { deleted_at: c2.now }))]));
      oneWins(results, "invalid", "A workspace needs at least one project.");
      expect(await store.projects.list(RETAIL)).toHaveLength(1);
    });

    it("two owners demoting each other at once: one owner stays", async () => {
      const store = s.store;
      const ctx = ctxOf(LUKASZ);
      const anna = (await store.workspaces.getMember(RETAIL, ANNA))!;
      expect(await store.apply(buildWriteSet(ctx, RETAIL, [update("workspace_member", anna, { ...anna, role: "owner" })]))).toEqual({ ok: true });
      const owners = (await store.workspaces.listMembers(RETAIL)).filter((x) => x.role === "owner");
      expect(owners).toHaveLength(2);
      const c2 = ctxOf(LUKASZ);
      const results = await atOnce(
        store,
        buildWriteSet(c2, RETAIL, [update("workspace_member", owners[0]!, { ...owners[0]!, role: "admin" })]),
        buildWriteSet(c2, RETAIL, [update("workspace_member", owners[1]!, { ...owners[1]!, role: "admin" })]),
      );
      oneWins(results, "invalid", "Retail Co – DWH needs at least one owner.");
      expect((await store.workspaces.listMembers(RETAIL)).filter((x) => x.role === "owner")).toHaveLength(1);
    });

    it("a shared canvas taken out of its two projects at once: one link stays", async () => {
      const store = s.store;
      const canvasId = await liveCanvas(store);
      const ctx = ctxOf(LUKASZ);
      const canvases = await store.canvases.list(RETAIL);
      // the canvas in two projects
      const projects = await store.projects.list(RETAIL);
      let links = await store.canvases.listLinksOfCanvas(RETAIL, canvasId);
      if (links.length < 2) {
        const another = projects.find((p) => !links.some((l) => l.project_id === p.id))!;
        expect(await store.apply(buildWriteSet(ctx, RETAIL, [insert("project_canvas", { project_id: another.id, canvas_id: canvasId, workspace_id: RETAIL, sort_order: 40, added_at: ctx.now, added_by: LUKASZ })]))).toEqual({ ok: true });
        links = await store.canvases.listLinksOfCanvas(RETAIL, canvasId);
      }
      // the two projects each keep another canvas, so only the canvas's own count is tested
      const extra: Write[] = [];
      for (const l of links) {
        const others = (await store.canvases.listLinksOfProject(RETAIL, l.project_id)).filter((x) => x.canvas_id !== l.canvas_id);
        if (!others.length) {
          const other = canvases.find((c) => c.id !== l.canvas_id && !extra.some((w) => (w as unknown as { row: AnyRow }).row.canvas_id === c.id))!;
          extra.push(insert("project_canvas", { project_id: l.project_id, canvas_id: other.id, workspace_id: RETAIL, sort_order: 50, added_at: ctx.now, added_by: LUKASZ }));
        }
      }
      if (extra.length) expect(await store.apply(buildWriteSet(ctx, RETAIL, extra))).toEqual({ ok: true });
      expect(links.length).toBeGreaterThanOrEqual(2);
      const c2 = ctxOf(LUKASZ);
      const results = await atOnce(store, buildWriteSet(c2, RETAIL, [remove("project_canvas", links[0]!)]), buildWriteSet(c2, RETAIL, [remove("project_canvas", links[1]!)]));
      if (links.length === 2) oneWins(results, "invalid", "A canvas belongs to at least one project.");
      expect((await store.canvases.listLinksOfCanvas(RETAIL, canvasId)).length).toBeGreaterThanOrEqual(1);
    });

    it("InfoCube turned off while a fact is made: never off with a fact", async () => {
      const store = s.store;
      const ctx = ctxOf(LUKASZ);
      const workspace = (await store.workspaces.get(RETAIL))!;
      if (!workspace.infocube) expect(await store.apply(buildWriteSet(ctx, RETAIL, [update("workspace", workspace, next(ctx, workspace, { infocube: true }))]))).toEqual({ ok: true });
      const on = (await store.workspaces.get(RETAIL))!;
      const facts = (await store.model.load(RETAIL)).entities.filter((e) => e.model_level === "dimensional");
      if (facts.length) {
        const c0 = ctxOf(LUKASZ);
        expect(await store.apply(buildWriteSet(c0, RETAIL, facts.map((f) => update("entity", f, next(c0, f, { deleted_at: c0.now })))))).toEqual({ ok: true });
      }
      const product = (await store.model.load(RETAIL)).entities.find((e) => e.name === "Product")!;
      const c2 = ctxOf(LUKASZ);
      const results = await atOnce(
        store,
        buildWriteSet(c2, RETAIL, [update("workspace", on, next(c2, on, { infocube: false }))]),
        buildWriteSet(c2, RETAIL, [insert("entity", { ...product, id: c2.newId(), name: "Fact Race", model_level: "dimensional", created_at: c2.now, updated_at: c2.now, version: 1 })]),
      );
      expect(results.map(answerOf).filter((r) => r.ok)).toHaveLength(1);
      const after = (await store.workspaces.get(RETAIL))!;
      const dimensional = (await store.model.load(RETAIL)).entities.filter((e) => e.model_level === "dimensional");
      expect(!after.infocube && dimensional.length > 0).toBe(false);
    });

    it("an organization's owner taken out of their last two workspaces at once: one stays", async () => {
      const store = s.store;
      const ctx = ctxOf(LUKASZ);
      // Łukasz owns InfoMate; keep two of his InfoMate workspaces, each with another owner
      const his = (await store.workspaces.listForUser(LUKASZ)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      const setup: Write[] = [];
      for (const w of his) {
        const members = await store.workspaces.listMembers(w.id);
        const other = members.find((x) => x.user_id !== LUKASZ);
        if (other) {
          if (other.role !== "owner") setup.push(update("workspace_member", other, { ...other, role: "owner" }));
        } else setup.push(insert("workspace_member", { workspace_id: w.id, user_id: ANNA, role: "owner", added_by: LUKASZ, created_at: ctx.now }));
      }
      if (setup.length) expect(await store.apply(buildWriteSet(ctx, RETAIL, setup))).toEqual({ ok: true });
      for (const w of his.slice(2)) {
        const c = ctxOf(LUKASZ);
        expect(await store.apply(buildWriteSet(c, w.id, [remove("workspace_member", (await store.workspaces.getMember(w.id, LUKASZ))!)]))).toEqual({ ok: true });
      }
      const [w1, w2] = his;
      expect(w2).toBeDefined();
      const c2 = ctxOf(LUKASZ);
      const results = await atOnce(
        store,
        buildWriteSet(c2, w1!.id, [remove("workspace_member", (await store.workspaces.getMember(w1!.id, LUKASZ))!)]),
        buildWriteSet(c2, w2!.id, [remove("workspace_member", (await store.workspaces.getMember(w2!.id, LUKASZ))!)]),
      );
      oneWins(results, "invalid", "Łukasz owns InfoMate, so they keep at least one workspace there.");
      expect((await store.workspaces.listForUser(LUKASZ)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate)).toHaveLength(1);
    });

    it("one invitation link accepted twice at once: one person joins (slice 33, F26)", async () => {
      const store = s.store;
      const lukasz = await accessOf(store, LUKASZ);
      const tokenHash = "e".repeat(64);
      const made = createInvitation(
        ctxOf(LUKASZ),
        { access: lukasz, account: null, members: await store.workspaces.listMembers(RETAIL), invitations: await store.invitations.listOpen(RETAIL) },
        { workspaceId: RETAIL, email: "twice@example.com", role: "modeler", tokenHash },
      );
      expect(made.ok && (await store.apply(made.writeSet))).toEqual({ ok: true });
      const invitation = (await store.invitations.getByTokenHash(tokenHash))!;
      const state = {
        invitation,
        workspace: (await store.workspaces.get(RETAIL))!,
        organization: await store.organizations.get(SEED_IDS.orgInfoMate),
        inviter: await store.users.get(LUKASZ),
        account: null,
        accountOrganizationMember: null,
        accountWorkspaceIds: [],
      };
      const join = (name: string) => {
        const c = ctxOf(LUKASZ);
        const r = acceptInvitation({ ...c, actorId: c.newId() }, state, { tokenHash, name, authUserId: null });
        if (!r.ok) throw new Error(r.error.message);
        return r.writeSet;
      };
      const answers = (await atOnce(store, join("First"), join("Second"))).map(answerOf);
      // the refusal is the e-mail's unique index or the invitation read stale, whichever the adapter meets first
      expect(answers.filter((r) => r.ok)).toHaveLength(1);
      expect(answers.find((r) => !r.ok)?.code).toMatch(/^(conflict|stale_version)$/);
      const person = (await store.users.getByEmail("twice@example.com"))!;
      expect((await store.workspaces.listMembers(RETAIL)).filter((m) => m.user_id === person.id)).toHaveLength(1);
      expect((await store.invitations.getByTokenHash(tokenHash))!.accepted_at).not.toBeNull();
    });

    it("a member taken out of their last two workspaces at once: their organization row never stays alone", async () => {
      const store = s.store;
      const ctx = ctxOf(LUKASZ);
      // Anna is an InfoMate member: in exactly two of its workspaces, each keeping an owner
      const his = (await store.workspaces.listForUser(LUKASZ)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      const annaIn = (await store.workspaces.listForUser(ANNA)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      const target = his.find((w) => !annaIn.some((a) => a.id === w.id));
      if (annaIn.length < 2 && target) {
        expect(await store.apply(buildWriteSet(ctx, target.id, [insert("workspace_member", { workspace_id: target.id, user_id: ANNA, role: "modeler", added_by: LUKASZ, created_at: ctx.now })]))).toEqual({ ok: true });
      }
      const two = (await store.workspaces.listForUser(ANNA)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      for (const w of two.slice(2)) {
        const c = ctxOf(LUKASZ);
        const row = (await store.workspaces.getMember(w.id, ANNA))!;
        expect(await store.apply(buildWriteSet(c, w.id, [row.role === "owner" ? update("workspace_member", row, { ...row, role: "modeler" }) : remove("workspace_member", row)]))).toEqual({ ok: true });
      }
      const [a1, a2] = (await store.workspaces.listForUser(ANNA)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      expect(a2).toBeDefined();
      for (const w of [a1!, a2!]) {
        const row = (await store.workspaces.getMember(w.id, ANNA))!;
        if (row.role === "owner") {
          const c = ctxOf(LUKASZ);
          expect(await store.apply(buildWriteSet(c, w.id, [update("workspace_member", row, { ...row, role: "modeler" })]))).toEqual({ ok: true });
        }
      }
      expect((await store.organizations.getMember(SEED_IDS.orgInfoMate, ANNA))?.role).toBe("member");
      const c2 = ctxOf(LUKASZ);
      // each removal read the other workspace, so neither removes Anna's organization row (P7)
      const results = await atOnce(
        store,
        buildWriteSet(c2, a1!.id, [remove("workspace_member", (await store.workspaces.getMember(a1!.id, ANNA))!)]),
        buildWriteSet(c2, a2!.id, [remove("workspace_member", (await store.workspaces.getMember(a2!.id, ANNA))!)]),
      );
      oneWins(results, "stale_version", "Someone changed this meanwhile.");
      const left = (await store.workspaces.listForUser(ANNA)).filter((w) => w.organization_id === SEED_IDS.orgInfoMate);
      const row = await store.organizations.getMember(SEED_IDS.orgInfoMate, ANNA);
      expect(left.length > 0 || row === null).toBe(true);
    });

    it("one row saved twice from the same version: the second is stale", async () => {
      const store = s.store;
      const product = (await store.model.load(RETAIL)).entities.find((e) => e.name === "Product")!;
      const c2 = ctxOf(ANNA);
      const results = await atOnce(
        store,
        buildWriteSet(c2, RETAIL, [update("entity", product, next(c2, product, { name: "Product A" }))]),
        buildWriteSet(c2, RETAIL, [update("entity", product, next(c2, product, { name: "Product B" }))]),
      );
      oneWins(results, "stale_version", "Someone changed this meanwhile.");
      expect((await store.model.load(RETAIL)).entities.find((e) => e.id === product.id)!.version).toBe(product.version + 1);
    });
  });
}

concurrency("the local adapter", localStore);
if (CONTRACT_DB) concurrency("Postgres", postgresStore);

/** A new server process as far as the store can tell: Postgres gets a new pool, the local adapter a new store on its file. */
async function freshProcess(name: string, s: Store, file?: string): Promise<DataStore> {
  if (name === "Postgres") {
    await getPool().end();
    delete (globalThis as { __infomapperPgPool?: unknown }).__infomapperPgPool;
    return createPostgresDataStore(STORE_SCHEMA);
  }
  return file ? createLocalDataStore(file, STORE_SCHEMA) : s.store;
}

function lastingUndo(name: string, make: (db: DevDb) => Promise<Store & { file?: string }>) {
  // the cases write tens of steps and read the workspace for each undo: more than the default 5 s on a busy runner
  describe(`${name}: the undo history (S30-02, S30-03)`, { timeout: 120_000 }, () => {
    let s: Store & { file?: string };
    let ctxOf: (actorId: string) => CommandContext;
    beforeEach(async () => {
      s = await make(spreadAll(contractRows()));
      ctxOf = clock();
    }, 300_000);
    afterEach(async () => s?.done());

    /** A rename of Product by `actorId`, recorded as the step "Rename entity". */
    async function rename(store: DataStore, actorId: string, to: string) {
      const ctx = ctxOf(actorId);
      const product = (await store.model.load(RETAIL)).entities.find((e) => e.name.startsWith("Product"))!;
      const set = buildWriteSet(ctx, RETAIL, [update("entity", product, next(ctx, product, { name: to }))]);
      expect(await store.apply(set, { history: { userId: actorId, kind: "record", label: "Rename entity" } })).toEqual({ ok: true });
      return set;
    }
    /** Undo (or redo) of the person's next step, as `undoAction` does: the revert and the history in one write. */
    async function revert(store: DataStore, actorId: string, mode: "undo" | "redo") {
      const step = (await store.undoHistory.next(RETAIL, actorId, mode))!;
      const access = await accessOf(store, actorId);
      const reverted = revertChangeGroup(ctxOf(actorId), access, { events: step.events, rows: await store.model.loadForUndo(RETAIL) }, mode, UNDO_TABLES);
      if (!reverted.ok) return reverted.error;
      return store.apply(reverted.writeSet, { history: { userId: actorId, kind: mode === "undo" ? "undone" : "redone", stepGroupId: step.changeGroupId, label: step.label } });
    }
    const productName = async (store: DataStore) => (await store.model.load(RETAIL)).entities.find((e) => e.name.startsWith("Product"))!.name;

    it("undoes the person's steps in reverse order after a new server process, and redoes them (S30-02)", async () => {
      await rename(s.store, ANNA, "Product 1");
      await rename(s.store, ANNA, "Product 2");
      const store = await freshProcess(name, s, s.file);
      expect(await store.undoHistory.state(RETAIL, ANNA)).toEqual({ canUndo: true, canRedo: false });
      expect(await store.undoHistory.state(RETAIL, LUKASZ)).toEqual({ canUndo: false, canRedo: false });
      expect(await revert(store, ANNA, "undo")).toEqual({ ok: true });
      expect(await productName(store)).toBe("Product 1");
      expect(await revert(store, ANNA, "undo")).toEqual({ ok: true });
      expect(await productName(store)).toBe("Product");
      expect(await store.undoHistory.state(RETAIL, ANNA)).toEqual({ canUndo: false, canRedo: true });
      expect(await revert(store, ANNA, "redo")).toEqual({ ok: true });
      expect(await productName(store)).toBe("Product 1");
      // a new step empties the redo list
      await rename(store, ANNA, "Product 3");
      expect(await store.undoHistory.state(RETAIL, ANNA)).toEqual({ canUndo: true, canRedo: false });
    });

    it("keeps the last 50 steps", async () => {
      for (let i = 1; i <= 52; i++) await rename(s.store, ANNA, `Product ${i}`);
      let undone = 0;
      while ((await s.store.undoHistory.next(RETAIL, ANNA, "undo")) && undone < 60) {
        expect(await revert(s.store, ANNA, "undo")).toEqual({ ok: true });
        undone++;
      }
      expect(undone).toBe(50);
      expect(await productName(s.store)).toBe("Product 2");
    }, 180_000);

    it("refuses an undo over another person's later change of the same row, and writes nothing (S30-03)", async () => {
      await rename(s.store, ANNA, "Product by Anna");
      await rename(s.store, LUKASZ, "Product by Łukasz");
      expect(await revert(s.store, ANNA, "undo")).toEqual({ code: "conflict", message: "This can't be undone because it was changed afterwards." });
      expect(await productName(s.store)).toBe("Product by Łukasz");
    });

    it("refuses an undo raced by another person's write between its read and its write (S30-03)", async () => {
      await rename(s.store, ANNA, "Product by Anna");
      const step = (await s.store.undoHistory.next(RETAIL, ANNA, "undo"))!;
      const access = await accessOf(s.store, ANNA);
      const reverted = ok(revertChangeGroup(ctxOf(ANNA), access, { events: step.events, rows: await s.store.model.loadForUndo(RETAIL) }, "undo", UNDO_TABLES));
      const ctx = ctxOf(LUKASZ);
      const product = (await s.store.model.load(RETAIL)).entities.find((e) => e.name === "Product by Anna")!;
      const theirs = buildWriteSet(ctx, RETAIL, [update("entity", product, next(ctx, product, { name: "Product by Łukasz" }))]);
      const results = await atOnce(s.store, reverted, theirs);
      oneWins(results, "stale_version", "Someone changed this meanwhile.");
      const name = await productName(s.store);
      // whichever came first, nothing was overwritten: the undo's name only if the other write was refused
      expect(["Product", "Product by Łukasz"]).toContain(name);
      if (name === "Product by Łukasz") expect(await s.store.undoHistory.next(RETAIL, ANNA, "undo")).not.toBeNull();
    });
  });
}

async function localStoreWithFile(db: DevDb): Promise<Store & { file: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-contract-undo-"));
  const file = path.join(dir, "db.json");
  fs.writeFileSync(file, JSON.stringify(db));
  return { store: createLocalDataStore(file, STORE_SCHEMA), file, done: async () => fs.rmSync(dir, { recursive: true, force: true }) };
}

lastingUndo("the local adapter", localStoreWithFile);
if (CONTRACT_DB) lastingUndo("Postgres", postgresStore);
