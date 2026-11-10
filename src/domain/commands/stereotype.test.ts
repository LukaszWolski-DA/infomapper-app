import { describe, expect, it } from "vitest";
import { access, archived, builtinStereotype, builtinStereotypes, entity, ids, makeCtx, NOW, ownStereotype } from "../__fixtures__/domain";
import { changeLabel } from "../model/change-label";
import { STEREOTYPE_BAD_CODE, STEREOTYPE_CODE_TAKEN, STEREOTYPE_NAME_TAKEN } from "../model/stereotypes";
import type { Entity, Stereotype } from "../types";
import {
  addStereotype,
  BUILTIN_NOT_REMOVED,
  CHOOSE_MOVE_TO,
  removeStereotype,
  renameStereotype,
  setStereotypeDefinition,
  STEREOTYPE_REMOVED_MOVED,
} from "./stereotype";
import { updateEntity } from "./entity";
import { UNKNOWN_STEREOTYPE } from "../model/stereotypes";
import { DIMENSIONAL_STEREOTYPE_MESSAGE } from "../model/levels";

const modeler = access("modeler");
const EVENT = "01900000-0000-7000-8000-5000000000e1";
const list = (...own: Stereotype[]) => [...builtinStereotypes(), ...own];
const event = (over: Partial<Stereotype> = {}) => ownStereotype(EVENT, "Event", "business_event", over);

describe("adding an own stereotype (item 5)", () => {
  it("writes an own row with the code lower-cased and names it in the history", () => {
    const r = addStereotype(makeCtx(), modeler, { stereotypes: list() }, { name: " Event ", code: " Business_Event " });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.stereotype).toMatchObject({ name: "Event", name_key: "event", code: "business_event", origin: "own", definition: null, workspace_id: ids.ws });
    expect(r.writeSet.writes.map((w) => `${w.kind}:${w.table}`)).toEqual(["insert:stereotype"]);
    expect(r.writeSet.label).toBe("Add stereotype Event");
    expect(changeLabel(r.writeSet.events)).toBe("Add stereotype Event");
  });

  it("lets a name equal its own code through", () => {
    expect(addStereotype(makeCtx(), modeler, { stereotypes: list() }, { name: "Event", code: "event" }).ok).toBe(true);
  });

  it("refuses a taken name, a bad code and a taken code, also one whose add was undone", () => {
    const s = { stereotypes: list(event()) };
    expect(addStereotype(makeCtx(), modeler, s, { name: "link", code: "x" })).toMatchObject({ ok: false, error: { code: "conflict", message: STEREOTYPE_NAME_TAKEN } });
    expect(addStereotype(makeCtx(), modeler, s, { name: "business event", code: "x" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_NAME_TAKEN } });
    expect(addStereotype(makeCtx(), modeler, s, { name: "Agreement", code: "1st" })).toMatchObject({ ok: false, error: { code: "invalid", message: STEREOTYPE_BAD_CODE } });
    expect(addStereotype(makeCtx(), modeler, s, { name: "Agreement", code: "" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_BAD_CODE } });
    expect(addStereotype(makeCtx(), modeler, s, { name: "Agreement", code: "link" })).toMatchObject({ ok: false, error: { code: "conflict", message: STEREOTYPE_CODE_TAKEN } });
    expect(addStereotype(makeCtx(), modeler, s, { name: "Agreement", code: "business_event" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_CODE_TAKEN } });
    const undone = { stereotypes: list(event({ deleted_at: NOW })) };
    expect(addStereotype(makeCtx(), modeler, undone, { name: "Event", code: "business_event" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_CODE_TAKEN } });
    // the name of a removed one is free again, its code is not
    expect(addStereotype(makeCtx(), modeler, undone, { name: "Event", code: "event_2" }).ok).toBe(true);
  });

  it("is for owners, admins and modelers, not in an archived workspace (D-57's roles)", () => {
    for (const role of ["reviewer", "reader"] as const) expect(addStereotype(makeCtx(), access(role), { stereotypes: list() }, { name: "Event", code: "event" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(addStereotype(makeCtx(), access("owner", archived), { stereotypes: list() }, { name: "Event", code: "event" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("renaming and defining (items 3, 4)", () => {
  const link = builtinStereotype("link");

  it("renames only the row, with the version check, and names the old name in the history", () => {
    const r = renameStereotype(makeCtx(), modeler, { stereotypes: list() }, { stereotypeId: link.id, expectedVersion: 1, name: "Association" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.stereotype).toMatchObject({ code: "link", name: "Association", name_key: "association", version: 2 });
    expect(r.writeSet.writes).toHaveLength(1);
    expect(changeLabel(r.writeSet.events)).toBe("Rename stereotype Link");
    expect(renameStereotype(makeCtx(), modeler, { stereotypes: list() }, { stereotypeId: link.id, expectedVersion: 2, name: "Association" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("refuses another's name or a code, allows its own code, and writes nothing unchanged or empty", () => {
    const s = { stereotypes: list(event()) };
    expect(renameStereotype(makeCtx(), modeler, s, { stereotypeId: link.id, expectedVersion: 1, name: "OBJECT" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_NAME_TAKEN } });
    expect(renameStereotype(makeCtx(), modeler, s, { stereotypeId: link.id, expectedVersion: 1, name: "Business event" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_NAME_TAKEN } });
    expect(renameStereotype(makeCtx(), modeler, s, { stereotypeId: link.id, expectedVersion: 1, name: "LINK" }).ok).toBe(true);
    expect(renameStereotype(makeCtx(), modeler, s, { stereotypeId: link.id, expectedVersion: 1, name: "Link" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(renameStereotype(makeCtx(), modeler, s, { stereotypeId: link.id, expectedVersion: 1, name: "  " })).toMatchObject({ ok: false, error: { code: "invalid" } });
    // a removed own one's code stays taken for names (F5)
    const removed = { stereotypes: list(event({ deleted_at: NOW })) };
    expect(renameStereotype(makeCtx(), modeler, removed, { stereotypeId: link.id, expectedVersion: 1, name: "business_event" })).toMatchObject({ ok: false, error: { message: STEREOTYPE_NAME_TAKEN } });
  });

  it("sets a definition trimmed and clears it when empty", () => {
    const set = setStereotypeDefinition(makeCtx(), modeler, { stereotypes: list() }, { stereotypeId: link.id, expectedVersion: 1, definition: "  Mine  " });
    if (!set.ok) throw new Error(set.error.message);
    expect(set.value).toMatchObject({ name: "Link", removed: false, stereotype: { definition: "Mine" } });
    expect(changeLabel(set.writeSet.events)).toBe("Change definition of Link");
    const cleared = setStereotypeDefinition(makeCtx(), modeler, { stereotypes: list() }, { stereotypeId: link.id, expectedVersion: 1, definition: "" });
    expect(cleared).toMatchObject({ ok: true, value: { removed: true, stereotype: { definition: null } } });
    expect(setStereotypeDefinition(makeCtx(), modeler, { stereotypes: list() }, { stereotypeId: link.id, expectedVersion: 1, definition: link.definition })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("removing an own stereotype (item 6, F16)", () => {
  const onEvent = (id: string, over: Partial<Entity> = {}) => entity(id, { stereotype: "business_event", ...over });

  it("removes an unused one at once", () => {
    const r = removeStereotype(makeCtx(), modeler, { stereotypes: list(event()), entities: [entity(ids.customer)] }, { stereotypeId: EVENT, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ name: "Event", moved: 0, movedTo: null });
    expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "stereotype", row: { deleted_at: NOW } }]);
    expect(changeLabel(r.writeSet.events)).toBe("Remove stereotype Event");
  });

  it("moves its live logical entities to the chosen one in the same change group", () => {
    const entities = [onEvent(ids.customer), onEvent(ids.salesOrder), onEvent("01900000-0000-7000-8000-00000000f002", { deleted_at: NOW })];
    const r = removeStereotype(makeCtx(), modeler, { stereotypes: list(event()), entities }, { stereotypeId: EVENT, expectedVersion: 1, moveTo: builtinStereotype("link").id });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ name: "Event", moved: 2, movedTo: "Link" });
    expect(r.writeSet.writes.map((w) => `${w.kind}:${w.table}`)).toEqual(["update:entity", "update:entity", "update:stereotype"]);
    expect(r.writeSet.writes.slice(0, 2).map((w) => ((w as { row: Entity }).row).stereotype)).toEqual(["link", "link"]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(changeLabel(r.writeSet.events)).toBe("Remove stereotype Event");
    expect(STEREOTYPE_REMOVED_MOVED("Event", 2, "Link")).toBe("Event removed; 2 entities are now Link.");
    expect(STEREOTYPE_REMOVED_MOVED("Event", 1, "Link")).toBe("Event removed; 1 entity is now Link.");
  });

  it("refuses a built-in one, a used one without a target, and a target that is itself or removed", () => {
    const entities = [onEvent(ids.customer)];
    const gone = ownStereotype("01900000-0000-7000-8000-5000000000e2", "Gone", "gone", { deleted_at: NOW });
    const s = { stereotypes: list(event(), gone), entities };
    expect(removeStereotype(makeCtx(), modeler, s, { stereotypeId: builtinStereotype("object").id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: BUILTIN_NOT_REMOVED } });
    expect(removeStereotype(makeCtx(), modeler, s, { stereotypeId: EVENT, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: CHOOSE_MOVE_TO } });
    expect(removeStereotype(makeCtx(), modeler, s, { stereotypeId: EVENT, expectedVersion: 1, moveTo: EVENT })).toMatchObject({ ok: false, error: { message: CHOOSE_MOVE_TO } });
    expect(removeStereotype(makeCtx(), modeler, s, { stereotypeId: EVENT, expectedVersion: 1, moveTo: gone.id })).toMatchObject({ ok: false, error: { message: CHOOSE_MOVE_TO } });
    expect(removeStereotype(makeCtx(), access("reviewer"), s, { stereotypeId: EVENT, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("an entity's stereotype (F15)", () => {
  const customer = entity(ids.customer);
  const state = (stereotypes?: Stereotype[]) => ({ entity: customer, entities: [customer], concept: null, ...(stereotypes ? { stereotypes } : {}) });

  it("takes a live code of the workspace's list, an own one too", () => {
    expect(updateEntity(makeCtx(), modeler, state(list(event())), { entityId: customer.id, expectedVersion: 1, stereotype: "business_event" })).toMatchObject({ ok: true, value: { entity: { stereotype: "business_event" } } });
    expect(updateEntity(makeCtx(), modeler, state(list(event())), { entityId: customer.id, expectedVersion: 1, stereotype: "link" }).ok).toBe(true);
  });

  it("refuses an unknown or removed code, and an own code without the list", () => {
    expect(updateEntity(makeCtx(), modeler, state(list()), { entityId: customer.id, expectedVersion: 1, stereotype: "hub" })).toMatchObject({ ok: false, error: { code: "invalid", message: UNKNOWN_STEREOTYPE } });
    expect(updateEntity(makeCtx(), modeler, state(list(event({ deleted_at: NOW }))), { entityId: customer.id, expectedVersion: 1, stereotype: "business_event" })).toMatchObject({ ok: false, error: { message: UNKNOWN_STEREOTYPE } });
    expect(updateEntity(makeCtx(), modeler, state(), { entityId: customer.id, expectedVersion: 1, stereotype: "business_event" })).toMatchObject({ ok: false, error: { message: UNKNOWN_STEREOTYPE } });
    expect(updateEntity(makeCtx(), modeler, state(), { entityId: customer.id, expectedVersion: 1, stereotype: "context" }).ok).toBe(true);
  });

  it("still refuses any stereotype on a fact or a dimension (C-5)", () => {
    const fact = entity(ids.customer, { model_level: "dimensional" });
    expect(updateEntity(makeCtx(), modeler, { entity: fact, entities: [fact], concept: null, stereotypes: list(event()) }, { entityId: fact.id, expectedVersion: 1, stereotype: "business_event" })).toMatchObject({
      ok: false,
      error: { message: DIMENSIONAL_STEREOTYPE_MESSAGE },
    });
  });
});
