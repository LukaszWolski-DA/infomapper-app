// The model level (slice 15a, C-3, C-6, C-7, AD-34): what InfoMapper knows about the dimensional level without knowing
// what it means. An entity's level is set when it is created and never changes; a relationship joins two entities of one
// level; an attribute is pasted within one level; the duplicate-name warning compares names within one level.
//   C-7 as Łukasz changed it (4 November 2026): InfoCube is turned off only while the workspace has no facts or
// dimensions, and while it is off nothing creates or brings back a dimensional entity (a create, a copy, a paste, an
// undo, a redo). So nothing else needs a read-only check: while off there is no dimensional entity to change.

import { domainError, type DomainError } from "../errors";
import type { Write } from "../changes";
import type { Attribute, Entity, Mapping, ModelLevel, Workspace } from "../types";

export const isLogical = (e: Pick<Entity, "model_level">): boolean => e.model_level === "logical";
export const isDimensional = (e: Pick<Entity, "model_level">): boolean => e.model_level === "dimensional";
export const sameLevel = (a: Pick<Entity, "model_level">, b: Pick<Entity, "model_level">): boolean => a.model_level === b.model_level;

/** A create, copy, paste, undo or redo that would add or bring back a fact or a dimension while InfoCube is off. */
export const INFOCUBE_OFF_MESSAGE =
  "InfoCube is off in this workspace, so no fact or dimension can be added or brought back. An owner or admin can turn it on in the workspace settings.";
/** Turning InfoCube off while the workspace has facts or dimensions (Łukasz's text, for his approval). */
export const turnOffRefusedMessage = (n: number): string =>
  `InfoCube can be turned off only when this workspace has no facts or dimensions. It has ${n}: delete them first.`;
/** Turning InfoCube on without the organization's licence (O2). */
export const noLicenceMessage = (organization: string): string => `${organization} has no InfoCube licence.`;
/** A relationship between a logical entity and a dimensional one (C-6; the prototype's text). */
export const CROSS_LEVEL_RELATIONSHIP_MESSAGE =
  "Facts and dimensions relate to each other. To trace a fact to the logical model, map its attributes.";
/** A paste of an attribute into an entity of the other level (O6). */
export const CROSS_LEVEL_PASTE_MESSAGE =
  "An attribute can be pasted only within one level: logical into logical, fact or dimension into fact or dimension.";
/** A write that changes an entity's level: no command does, so this is a guard. */
export const LEVEL_CHANGE_MESSAGE = "An entity's level is set when it is created and never changes.";
/** A stereotype on a fact or dimension, which has a role instead (C-5, Q4). */
export const DIMENSIONAL_STEREOTYPE_MESSAGE = "A fact or dimension has a role, not a stereotype.";

/** A source column mapped to a fact's or a dimension's attribute (B-6's refusal, the prototype's text; slice 15a step 5). */
export const MAPPING_TO_DIMENSIONAL_MESSAGE =
  "Source columns map to the logical model. Map the column to a logical attribute, then that attribute to the fact or dimension.";

export const mappingToDimensional = (): DomainError => domainError("invalid", MAPPING_TO_DIMENSIONAL_MESSAGE);

/** A mapping's target must be a logical attribute: the refusal when its entity is a fact or a dimension. */
export const mappingTargetRefusal = (entity: Pick<Entity, "model_level"> | null | undefined): DomainError | null =>
  entity && isDimensional(entity) ? mappingToDimensional() : null;

/** Whether a write set adds a mapping or points one at another attribute: only then is `mappingWritesRefusal` read. */
export const writesMappingTargets = (writes: readonly Write[]): boolean =>
  writes.some((w) => w.table === "mapping" && (w.kind === "insert" || (w.kind === "update" && (w.before as Mapping).attribute_id !== (w.row as Mapping).attribute_id)));

/**
 * The guard on any write set (runCommand): no mapping is added or pointed at an attribute of a fact or a dimension,
 * whatever command built it. `entities` and `attributes` are the model as stored; attributes the writes insert count too.
 */
export function mappingWritesRefusal(writes: readonly Write[], entities: readonly Entity[], attributes: readonly Attribute[]): DomainError | null {
  if (!writesMappingTargets(writes)) return null;
  const entityOf = new Map(attributes.map((a) => [a.id, a.entity_id]));
  for (const w of writes) if (w.table === "attribute") entityOf.set((w.row as Attribute).id, (w.row as Attribute).entity_id);
  const levelOfEntity = new Map(entities.map((e) => [e.id, e]));
  for (const w of writes) if (w.table === "entity") levelOfEntity.set((w.row as Entity).id, w.row as Entity);
  for (const w of writes) {
    if (w.table !== "mapping") continue;
    const row = w.row as Mapping;
    if (w.kind === "update" && (w.before as Mapping).attribute_id === row.attribute_id) continue;
    const entityId = entityOf.get(row.attribute_id);
    const refusal = mappingTargetRefusal(entityId ? levelOfEntity.get(entityId) : undefined);
    if (refusal) return refusal;
  }
  return null;
}

export const infocubeOff = (): DomainError => domainError("forbidden", INFOCUBE_OFF_MESSAGE);

/** The workspace's live dimensional entities: the facts and dimensions that keep InfoCube from being turned off. */
export const dimensionalCount = (entities: readonly Entity[], workspaceId: string): number =>
  entities.filter((e) => e.workspace_id === workspaceId && e.deleted_at === null && isDimensional(e)).length;

const levelOf = (row: unknown): ModelLevel | undefined => (row as { model_level?: ModelLevel }).model_level;

/**
 * The level rules every write keeps, whatever command or undo built it (runCommand and `revertChangeGroup` call it):
 * no write changes an entity's level, and while InfoCube is off no write inserts a dimensional entity or brings a
 * deleted one back. `workspace` is the workspace as it stands after the write (a write that turns InfoCube on and adds
 * a fact at once would pass). An image recorded before slice 15a has no level and is logical.
 */
export function levelWritesRefusal(workspace: Pick<Workspace, "infocube">, writes: readonly Write[]): DomainError | null {
  for (const w of writes) {
    if (w.table !== "entity") continue;
    if (w.kind === "update" && (levelOf(w.before) ?? "logical") !== (levelOf(w.row) ?? "logical")) return domainError("invalid", LEVEL_CHANGE_MESSAGE);
    if (workspace.infocube) continue;
    const added = w.kind === "insert" || (w.kind === "update" && w.before.deleted_at !== null && w.row.deleted_at === null);
    if (added && levelOf(w.row) === "dimensional") return infocubeOff();
  }
  return null;
}

/** Whether a write set can break a level rule: it writes an entity (the rest needs no workspace row). */
export const writesEntities = (writes: readonly Write[]): boolean => writes.some((w) => w.table === "entity");
