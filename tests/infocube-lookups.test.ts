// InfoCube's lookups (slice 18, item 4; acceptance F13, F15, F16): on the star's Dim Customer.country_name (fed from
// Country.country_name by a direct copy): Lookup with its relationship chosen when there is one, its value for no match,
// switching away and back keeping both, two inputs refusing it, a second input making it a transformation, D-51 on its
// relationship and value but not its note, and a relationship's delete keeping the id and sending an approved lookup back
// to review in the same change group, through the composition root's registry; one undo brings both back.

import { describe, expect, it } from "vitest";
import { UNDO_TABLES } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { buildWriteSet, type CommandContext, type CommandResult, type WriteSet } from "@/domain/changes";
import { deleteEntity } from "@/domain/commands/entity";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { createRelationship, deleteRelationship } from "@/domain/commands/relationship";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import { makeCtx, member, workspace } from "@/domain/__fixtures__/domain";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Attribute, ChangeEvent, Entity, Relationship } from "@/domain/types";
import {
  addCubeMappingInput,
  CUBE_MAPPING_LOG,
  LOOKUP_READS_ONE,
  lookupRelationshipGone,
  lookupRelationshipRefusal,
  lookupRelationships,
  lookupSentence,
  mappingIndex,
  relationshipText,
  setCubeMappingStatus,
  updateCubeMapping,
  type MappingModel,
} from "@/modules/infocube/domain/mappings";
import type { CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
type Rows = Record<string, Record<string, unknown>[]>;

function starRows(): Rows {
  const db = buildSeed() as unknown as Rows;
  addModuleDemoData(db as never);
  return Object.fromEntries(Object.entries(db).filter(([k]) => Array.isArray(db[k])).map(([k, rows]) => [k, rows.filter((r) => r.workspace_id === WS)]));
}

function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows);
  for (const w of writeSet.writes) {
    const list = (next[w.table] ??= []);
    if (w.kind === "insert") list.push(structuredClone(w.row) as unknown as Record<string, unknown>);
    else if (w.kind === "update") {
      const id = (w.before as unknown as { id: string }).id;
      list[list.findIndex((r) => r.id === id)] = structuredClone(w.row) as unknown as Record<string, unknown>;
    }
  }
  return next;
}

const ok = <T>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};

/** `withModuleCascades` without the store. */
function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, (rows[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, WS, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const as = (role: "modeler" | "reviewer"): WorkspaceAccess => ({ workspace: workspace({ id: WS, infocube: true }), member: member(role, { workspace_id: WS }) });
const entities = (rows: Rows) => rows.entity as unknown as Entity[];
const attributes = (rows: Rows) => rows.attribute as unknown as Attribute[];
const relationships = (rows: Rows) => rows.relationship as unknown as Relationship[];
const entityNamed = (rows: Rows, name: string) => entities(rows).find((e) => e.name === name && e.deleted_at === null)!;
const attributeOf = (rows: Rows, entity: string, name: string) => attributes(rows).find((a) => a.entity_id === entityNamed(rows, entity).id && a.name === name)!;
const mappings = (rows: Rows) => (rows.cube_mapping ?? []) as unknown as CubeMapping[];
const cubeInputs = (rows: Rows) => (rows.cube_mapping_input ?? []) as unknown as CubeMappingInput[];
const state = (rows: Rows): MappingModel => ({ entities: entities(rows), attributes: attributes(rows), cubeMappings: mappings(rows), cubeMappingInputs: cubeInputs(rows), relationships: relationships(rows) });
const countryName = (rows: Rows) => mappings(rows).find((m) => m.attribute_id === attributeOf(rows, "Dim Customer", "country_name").id)!;
const locates = (rows: Rows) => relationships(rows).find((r) => r.label === "locates" && r.deleted_at === null)!;

const ctx = makeCtx();
const update = (rows: Rows, patch: Record<string, unknown>, who = as("modeler")) => {
  const m = countryName(rows);
  return updateCubeMapping(ctx, who, state(rows), { mappingId: m.id, expectedVersion: m.version, ...patch });
};

describe("a lookup (slice 18, item 4, S18-06)", () => {
  it("takes the dictionary's one relationship when Lookup is chosen, and says how it reads", () => {
    const rows = starRows();
    const index = mappingIndex(state(rows));
    const m = countryName(rows);
    expect(lookupRelationships(index, relationships(rows), m.id).map((r) => relationshipText(index, r))).toEqual(["Country → Customer Address (locates)"]);
    const after = apply(rows, ok(update(rows, { kind: "lookup" })).writeSet);
    expect(countryName(after)).toMatchObject({ kind: "lookup", lookup_relationship_id: locates(rows).id, lookup_default: null });
    const unknown = apply(after, ok(update(after, { lookupDefault: "  Unknown " })).writeSet);
    expect(countryName(unknown).lookup_default).toBe("Unknown");
    expect(lookupSentence(mappingIndex(state(unknown)), relationships(unknown), countryName(unknown))).toBe(
      "Each Customer Address row finds its Country by country_code and takes country_name; when the code is empty or has no match, the value is “Unknown”.",
    );
  });

  it("keeps its relationship and value when the kind goes to Direct copy and back", () => {
    let rows = starRows();
    rows = apply(rows, ok(update(rows, { kind: "lookup", lookupDefault: "Unknown" })).writeSet);
    rows = apply(rows, ok(update(rows, { kind: "direct" })).writeSet);
    expect(countryName(rows)).toMatchObject({ kind: "direct", lookup_relationship_id: locates(rows).id, lookup_default: "Unknown" });
    rows = apply(rows, ok(update(rows, { kind: "lookup" })).writeSet);
    expect(countryName(rows)).toMatchObject({ kind: "lookup", lookup_relationship_id: locates(rows).id, lookup_default: "Unknown" });
  });

  it("chooses nothing when the dictionary has two relationships, and refuses one that is not the dictionary's", () => {
    let rows = starRows();
    const country = entityNamed(rows, "Country");
    const customer = entityNamed(rows, "Customer");
    rows = apply(rows, ok(createRelationship(ctx, as("modeler"), { from: country, to: customer }, { fromEntityId: country.id, toEntityId: customer.id })).writeSet);
    rows = apply(rows, ok(update(rows, { kind: "lookup" })).writeSet);
    expect(countryName(rows).lookup_relationship_id).toBeNull();
    const notCountry = relationships(rows).find((r) => r.label === "places")!;
    expect(update(rows, { lookupRelationshipId: notCountry.id })).toMatchObject({ ok: false, error: { message: lookupRelationshipRefusal("Country") } });
    expect(update(rows, { lookupRelationshipId: locates(rows).id }).ok).toBe(true);
  });

  it("refuses Lookup with two inputs; a second input makes a lookup a transformation", () => {
    let rows = starRows();
    rows = apply(rows, ok(update(rows, { kind: "lookup" })).writeSet);
    const m = countryName(rows);
    const add = ok(addCubeMappingInput(ctx, as("modeler"), state(rows), { mappingId: m.id, expectedVersion: m.version, attributeId: attributeOf(rows, "Country", "country_code").id }));
    expect(add.value.becameTransform).toBe(true);
    expect(add.value.toast).toBe("It reads Country.country_code too, so it is a transformation now. Describe the rule.");
    rows = apply(rows, add.writeSet);
    expect(countryName(rows).kind).toBe("transform");
    expect(update(rows, { kind: "lookup" })).toMatchObject({ ok: false, error: { message: LOOKUP_READS_ONE } });
  });

  it("goes back to review when its kind, relationship or value changes (D-51), not when its note does", () => {
    const rows = starRows(); // country_name is approved in the star
    expect(countryName(rows).status).toBe("approved");
    const kind = ok(update(rows, { kind: "lookup" }));
    expect(kind.value.notice).not.toBeNull();
    let after = apply(rows, kind.writeSet);
    expect(countryName(after)).toMatchObject({ status: "review", approved_at: null, approved_by: null });

    // approved again, then each field
    const reapprove = (r: Rows) => {
      const m = countryName(r);
      return apply(r, ok(setCubeMappingStatus(makeCtx("01900000-0000-7000-8000-0000000001ee"), as("reviewer"), { ...state(r), contentAuthorId: null } as never, { mappingId: m.id, expectedVersion: m.version, status: "approved" })).writeSet);
    };
    after = reapprove(after);
    expect(countryName(after).status).toBe("approved");
    expect(countryName(apply(after, ok(update(after, { lookupDefault: "Unknown" })).writeSet)).status).toBe("review");
    expect(countryName(apply(after, ok(update(after, { lookupRelationshipId: null })).writeSet)).status).toBe("review");
    const note = ok(update(after, { note: "Names from the Country dictionary." }));
    expect(note.value.notice).toBeNull();
    expect(countryName(apply(after, note.writeSet)).status).toBe("approved");
  });

  it("counts the relationship and the value as content for four-eyes", () => {
    expect(CUBE_MAPPING_LOG.content).toEqual(expect.arrayContaining(["lookup_relationship_id", "lookup_default"]));
    const rows = starRows();
    const m = countryName(rows);
    const event = (column: string): ChangeEvent =>
      ({ object_type: "cube_mapping", object_id: m.id, operation: "update", user_id: "01900000-0000-7000-8000-0000000001ff", occurred_at: "2026-11-08T10:00:00.000Z", before_image: { ...m }, after_image: { ...m, [column]: "x" } }) as unknown as ChangeEvent;
    expect(lastContentEditor(m, [event("lookup_default")], CUBE_MAPPING_LOG)).toBe("01900000-0000-7000-8000-0000000001ff");
  });
});

describe("a lookup's relationship deleted (slice 18, S18-07, F15, F16)", () => {
  const asLookup = (approved: boolean) => {
    let rows = starRows();
    rows = apply(rows, ok(update(rows, { kind: "lookup", lookupDefault: "Unknown" })).writeSet);
    if (approved) {
      const m = countryName(rows);
      rows = apply(rows, ok(setCubeMappingStatus(makeCtx("01900000-0000-7000-8000-0000000001ee"), as("reviewer"), { ...state(rows), contentAuthorId: null } as never, { mappingId: m.id, expectedVersion: m.version, status: "approved" })).writeSet);
    }
    return rows;
  };
  const deleteLocates = (rows: Rows) => {
    const r = locates(rows);
    return withCascades(ctx, rows, ok(deleteRelationship(ctx, as("modeler"), { relationship: r }, { relationshipId: r.id, expectedVersion: r.version })).writeSet);
  };

  it("keeps the lookup and its relationship's id, sends an approved lookup back to review in the same group; one undo brings both back", () => {
    const rows = asLookup(true);
    const id = locates(rows).id;
    const del = deleteLocates(rows);
    expect(new Set(del.events.map((e) => e.change_group_id)).size).toBe(1);
    const after = apply(rows, del);
    expect(countryName(after)).toMatchObject({ deleted_at: null, kind: "lookup", lookup_relationship_id: id, status: "review", approved_at: null });
    expect(lookupRelationshipGone(relationships(after), countryName(after))).toBe(true);
    expect(lookupSentence(mappingIndex(state(after)), relationships(after), countryName(after))).toBeNull();

    const undone = revertChangeGroup(ctx, as("modeler"), { events: del.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES);
    if (!undone.ok) throw new Error(undone.error.message);
    const back = apply(after, undone.writeSet);
    expect(countryName(back)).toMatchObject({ status: "approved", lookup_relationship_id: id });
    expect(lookupRelationshipGone(relationships(back), countryName(back))).toBe(false);
  });

  it("leaves a lookup that is not approved unchanged, and a direct copy that kept an old relationship too", () => {
    const draft = asLookup(false);
    const del = deleteLocates(draft);
    expect(del.writes.some((w) => w.table === "cube_mapping")).toBe(false);
    expect(lookupRelationshipGone(relationships(apply(draft, del)), countryName(draft))).toBe(true);
  });

  it("does the same when the relationship goes with an entity's delete", () => {
    const rows = asLookup(true);
    const address = entityNamed(rows, "Customer Address");
    const of = (t: string) => (rows[t] ?? []).filter((r) => r.deleted_at === null);
    const result = deleteEntity(ctx, as("modeler"), {
      entity: address,
      attributes: of("attribute"),
      mappings: of("mapping"),
      mappingInputs: of("mapping_input"),
      attributeInputs: of("attribute_input"),
      relationships: of("relationship"),
      canvasItems: of("canvas_item"),
    } as never, { entityId: address.id, expectedVersion: address.version });
    const after = apply(rows, withCascades(ctx, rows, ok(result).writeSet));
    expect(countryName(after)).toMatchObject({ deleted_at: null, status: "review" });
  });
});
