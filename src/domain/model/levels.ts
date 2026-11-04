// The model level (slice 15a, C-3, C-6, C-7, AD-34): what InfoMapper knows about the dimensional level without knowing
// what it means. An entity's level is set when it is created and never changes; a relationship joins two entities of one
// level; an attribute is pasted within one level; the duplicate-name warning compares names within one level.
//   C-7 as Łukasz changed it (4 November 2026): InfoCube is turned off only while the workspace has no facts or
// dimensions, and while it is off nothing creates or brings back a dimensional entity (a create, a copy, a paste, an
// undo, a redo). So nothing else needs a read-only check: while off there is no dimensional entity to change.

import { domainError, type DomainError } from "../errors";
import type { Write } from "../changes";
import type { Entity, ModelLevel, Workspace } from "../types";

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
  "An attribute is pasted within one level only: a logical entity's into a logical entity, a fact's or dimension's into a fact or dimension.";
/** A write that changes an entity's level: no command does, so this is a guard. */
export const LEVEL_CHANGE_MESSAGE = "An entity's level is set when it is created and never changes.";
/** A stereotype on a fact or dimension, which has a role instead (C-5, Q4). */
export const DIMENSIONAL_STEREOTYPE_MESSAGE = "A fact or dimension has a role, not a stereotype.";

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
