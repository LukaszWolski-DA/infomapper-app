// Requirements (D-30, D-31; slice 4a, PRD items 2–6, 9, 12–14): create (optionally linked to one element), change one
// field, set the status, delete, link and unlink. Each is one write with its change events and one undo step (AD-13).
// Owners, admins and modelers do everything; reviewers only set the status (their approval); readers and archived
// workspaces nothing (AD-05, AD-09). With four-eyes on, the person who last changed a requirement's content cannot set
// it to Agreed (AD-06). The model is never changed by these commands. Rich text is sanitized here (AD-17).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { LABEL_TARGET_KINDS, marks, targetColumns, type LabelTarget } from "../model/labels";
import {
  canBeParent,
  cycleMessage,
  DELETED_REQUIREMENT_MESSAGE,
  fourEyesRequirementMessage,
  keyTakenMessage,
  nextRequirementKey,
  OWN_PARENT_MESSAGE,
  requirementWithKey,
} from "../model/requirements";
import { sanitizeRich } from "../model/rich-text";
import { requirementCardsGone } from "./canvas-item";
import type { WorkspaceAccess } from "../permissions";
import {
  REQUIREMENT_KINDS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_SEVERITIES,
  REQUIREMENT_STATUSES,
  type CanvasItem,
  type Requirement,
  type RequirementLink,
} from "../types";
import { nameSchema, optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import type { LabelTargetRows } from "./label";
import { linksOnItems } from "./label";
import { begin, current, done, isLive, nothingToChange, softDelete } from "./shared";

export const REQUIREMENT_GONE_MESSAGE = "That requirement no longer exists.";
export const ELEMENT_GONE_MESSAGE = "That element no longer exists.";
export const ALREADY_LINKED_MESSAGE = "Already linked.";
export const ALREADY_UNLINKED_MESSAGE = "Already unlinked.";

const KEY_MAX = 40;
const keySchema = z.string().trim().min(1, "Enter a key.").max(KEY_MAX, "This key is too long.");
const textSchema = optionalTextSchema.pipe(z.string().max(2000, "This text is too long.").nullable());
const targetSchema = z.object({ kind: z.enum(LABEL_TARGET_KINDS), id: uuidSchema }).strict();

const NOUN: Record<LabelTarget["kind"], string> = {
  entity: "the entity",
  attribute: "the attribute",
  mapping: "the mapping",
  source_table: "the table",
  source_column: "the column",
};
export const linkedMessage = (key: string, kind: LabelTarget["kind"]): string => `Linked ${key} to ${NOUN[kind]}.`;

function targetLive(rows: LabelTargetRows, target: LabelTarget, workspaceId: Uuid): boolean {
  const list = {
    entity: rows.entities,
    attribute: rows.attributes,
    mapping: rows.mappings,
    source_table: rows.sourceTables,
    source_column: rows.sourceColumns,
  }[target.kind] as readonly { id: Uuid; workspace_id: Uuid; deleted_at: string | null }[];
  return isLive(list.find((r) => r.id === target.id), workspaceId);
}

const gone = (message: string): DomainError => domainError("not_found", message);

// ---- create ----

const createInput = z.object({ link: targetSchema.optional() }).strict();
export type CreateRequirementInput = z.input<typeof createInput>;

export interface CreateRequirementState extends Partial<LabelTargetRows> {
  /** The workspace's requirements (deleted ones may be included; they are skipped). */
  requirements: readonly Requirement[];
}

/**
 * A new requirement: `REQ-{counter}` (skipping keys someone typed), Data requirement, Draft, Should, named “New
 * requirement”; the workspace's counter goes up in the same write. With `link`, it is linked to that element in the same
 * change group (“+ New requirement…” in an element panel).
 */
export function createRequirement(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateRequirementState,
  input: unknown,
): CommandResult<{ requirement: Requirement; link: RequirementLink | null }> {
  const parsed = begin(access, "requirement.edit", createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const ws = access.workspace;
  const target = parsed.data.link;
  if (target && !targetLive(rowsOf(state), target, ws.id)) return fail(gone(ELEMENT_GONE_MESSAGE));
  const { key, next } = nextRequirementKey(ws.requirement_key_next, state.requirements.filter((r) => r.workspace_id === ws.id));
  const requirement: Requirement = {
    ...newRowColumns(ctx),
    workspace_id: ws.id,
    key,
    kind: "data",
    name: "New requirement",
    description_html: null,
    description_text: null,
    expression: null,
    severity: null,
    status: "draft",
    priority: "should",
    owner_name: null,
    external_ref: null,
    parent_id: null,
  };
  const writes: Write[] = [
    { kind: "update", table: "workspace", before: ws, row: nextVersion(ctx, ws, { requirement_key_next: next }) },
    { kind: "insert", table: "requirement", row: requirement },
  ];
  let link: RequirementLink | null = null;
  if (target) {
    link = { ...newRowColumns(ctx), workspace_id: ws.id, requirement_id: requirement.id, ...targetColumns(target) };
    writes.push({ kind: "insert", table: "requirement_link", row: link });
  }
  return done(ctx, access, { requirement, link }, writes);
}

const rowsOf = (s: Partial<LabelTargetRows>): LabelTargetRows => ({
  entities: s.entities ?? [],
  attributes: s.attributes ?? [],
  mappings: s.mappings ?? [],
  sourceTables: s.sourceTables ?? [],
  sourceColumns: s.sourceColumns ?? [],
});

// ---- change one field ----

const ref = { requirementId: uuidSchema, expectedVersion: versionSchema };
const updateInput = z.discriminatedUnion("field", [
  z.object({ ...ref, field: z.literal("key"), value: keySchema }).strict(),
  z.object({ ...ref, field: z.literal("name"), value: nameSchema.pipe(z.string().max(300, "This name is too long.")) }).strict(),
  z.object({ ...ref, field: z.literal("kind"), value: z.enum(REQUIREMENT_KINDS) }).strict(),
  z.object({ ...ref, field: z.literal("description"), value: z.string().max(100_000, "This text is too long.").nullable() }).strict(),
  z.object({ ...ref, field: z.literal("expression"), value: optionalTextSchema.pipe(z.string().max(5000, "This text is too long.").nullable()) }).strict(),
  z.object({ ...ref, field: z.literal("severity"), value: z.enum(REQUIREMENT_SEVERITIES).nullable() }).strict(),
  z.object({ ...ref, field: z.literal("priority"), value: z.enum(REQUIREMENT_PRIORITIES) }).strict(),
  z.object({ ...ref, field: z.literal("owner_name"), value: textSchema }).strict(),
  z.object({ ...ref, field: z.literal("external_ref"), value: textSchema }).strict(),
  z.object({ ...ref, field: z.literal("parent_id"), value: uuidSchema.nullable() }).strict(),
]);
export type UpdateRequirementInput = z.input<typeof updateInput>;
export type RequirementField = UpdateRequirementInput["field"];

/**
 * Changes one field. The key stays unique in any case among live requirements; an empty key or name is refused (the
 * panel shows the previous value). A kind change keeps `expression` and `severity`; becoming a data quality rule without
 * a severity sets `warn`. A description is sanitized and its plain text derived. “Part of” never makes a cycle.
 */
export function updateRequirement(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { requirements: readonly Requirement[] },
  input: unknown,
): CommandResult<{ requirement: Requirement }> {
  const parsed = begin(access, "requirement.edit", updateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const data = parsed.data;
  const ws = access.workspace.id;
  const got = current(state.requirements.find((r) => r.id === data.requirementId), access, data.requirementId, data.expectedVersion, "requirement");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  let patch: Partial<Requirement>;
  switch (data.field) {
    case "key": {
      const other = requirementWithKey(state.requirements.filter((r) => r.workspace_id === ws), data.value, before.id);
      if (other) return fail(domainError("conflict", keyTakenMessage(data.value), { value: keyTakenMessage(data.value) }));
      patch = { key: data.value };
      break;
    }
    case "kind":
      patch = { kind: data.value, ...(data.value === "dq_rule" && before.severity === null ? { severity: "warn" as const } : {}) };
      break;
    case "description": {
      const rich = sanitizeRich(data.value);
      patch = { description_html: rich.html, description_text: rich.text };
      break;
    }
    case "parent_id": {
      if (data.value !== null) {
        if (data.value === before.id) return fail(domainError("invalid", OWN_PARENT_MESSAGE));
        const parent = state.requirements.find((r) => r.id === data.value);
        if (!isLive(parent, ws)) return fail(gone(REQUIREMENT_GONE_MESSAGE));
        if (!canBeParent(state.requirements.filter((r) => r.workspace_id === ws), before.id, parent.id)) {
          return fail(domainError("conflict", cycleMessage(before.key, parent.key)));
        }
      }
      patch = { parent_id: data.value };
      break;
    }
    default:
      patch = { [data.field]: data.value } as Partial<Requirement>;
  }
  if (Object.entries(patch).every(([k, v]) => before[k as keyof Requirement] === v)) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { requirement: row }, [{ kind: "update", table: "requirement", before, row }]);
}

// ---- status ----

const statusInput = z.object({ ...ref, status: z.enum(REQUIREMENT_STATUSES) }).strict();
export type SetRequirementStatusInput = z.input<typeof statusInput>;

export interface SetRequirementStatusState {
  requirement: Requirement | null;
  /** Who last changed its content (`lastRequirementEditor`), read by the caller from the change log. */
  contentAuthorId: Uuid;
}

/**
 * Sets the status; reviewers may do this too, it is their approval. With four-eyes on, the last content author cannot
 * set it to Agreed (AD-06). Every status change is in the change log, which is the approval log.
 */
export function setRequirementStatus(ctx: CommandContext, access: WorkspaceAccess, state: SetRequirementStatusState, input: unknown): CommandResult<{ requirement: Requirement }> {
  const parsed = begin(access, "requirement.set_status", statusInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { requirementId, expectedVersion, status } = parsed.data;
  const got = current(state.requirement, access, requirementId, expectedVersion, "requirement");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (before.status === status) return fail(nothingToChange());
  if (status === "agreed" && access.workspace.four_eyes && state.contentAuthorId === ctx.actorId) {
    return fail(domainError("forbidden", fourEyesRequirementMessage(before.key)));
  }
  const row = nextVersion(ctx, before, { status });
  return done(ctx, access, { requirement: row }, [{ kind: "update", table: "requirement", before, row }]);
}

// ---- delete ----

const deleteInput = z.object(ref).strict();
export type DeleteRequirementInput = z.input<typeof deleteInput>;

/**
 * Deletes a requirement (prototype behaviour, no impact dialog): its links go, its children become top level, its
 * cards leave every canvas (slice 4b-2, PRD item 7; `items`: the workspace's cards), model elements are untouched. One
 * change group, so one undo brings it all back.
 */
export function deleteRequirement(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { requirements: readonly Requirement[]; links: readonly RequirementLink[]; items: readonly CanvasItem[] },
  input: unknown,
): CommandResult<{ key: string; message: string }> {
  const parsed = begin(access, "requirement.edit", deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.requirements.find((r) => r.id === parsed.data.requirementId), access, parsed.data.requirementId, parsed.data.expectedVersion, "requirement");
  if (!got.ok) return fail(got.error);
  const requirement = got.row;
  const ws = access.workspace.id;
  const writes: Write[] = [
    ...state.links.filter((k) => isLive(k, ws) && k.requirement_id === requirement.id).map((k) => softDelete(ctx, "requirement_link", k)),
    ...state.requirements
      .filter((r) => isLive(r, ws) && r.parent_id === requirement.id)
      .map((r): Write => ({ kind: "update", table: "requirement", before: r, row: nextVersion(ctx, r, { parent_id: null }) })),
    ...requirementCardsGone(ctx, ws, state.items, new Set([requirement.id])),
    softDelete(ctx, "requirement", requirement),
  ];
  return done(ctx, access, { key: requirement.key, message: DELETED_REQUIREMENT_MESSAGE(requirement.key) }, writes);
}

// ---- link and unlink ----

const linkInput = z.object({ requirementId: uuidSchema, target: targetSchema }).strict();
export type LinkRequirementInput = z.input<typeof linkInput>;

export interface LinkRequirementState extends LabelTargetRows {
  requirement: Requirement | null;
  /** The workspace's requirement links. */
  links: readonly RequirementLink[];
}

/** Traces a requirement to an entity, attribute, mapping, source table or column. A second link is refused. */
export function linkRequirement(ctx: CommandContext, access: WorkspaceAccess, state: LinkRequirementState, input: unknown): CommandResult<{ link: RequirementLink; message: string }> {
  const parsed = begin(access, "requirement.edit", linkInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { requirementId, target } = parsed.data;
  const ws = access.workspace.id;
  const requirement = state.requirement;
  if (!isLive(requirement, ws) || requirement.id !== requirementId) return fail(gone(REQUIREMENT_GONE_MESSAGE));
  if (!targetLive(state, target, ws)) return fail(gone(ELEMENT_GONE_MESSAGE));
  if (state.links.some((k) => isLive(k, ws) && k.requirement_id === requirementId && marks(k, target))) {
    return fail(domainError("conflict", ALREADY_LINKED_MESSAGE));
  }
  const link: RequirementLink = { ...newRowColumns(ctx), workspace_id: ws, requirement_id: requirementId, ...targetColumns(target) };
  return done(ctx, access, { link, message: linkedMessage(requirement.key, target.kind) }, [{ kind: "insert", table: "requirement_link", row: link }]);
}

const unlinkInput = z.object({ requirementLinkId: uuidSchema, expectedVersion: versionSchema }).strict();
export type UnlinkRequirementInput = z.input<typeof unlinkInput>;

/** Takes one link away; a link that is gone already is refused without a write. */
export function unlinkRequirement(ctx: CommandContext, access: WorkspaceAccess, state: { link: RequirementLink | null }, input: unknown): CommandResult {
  const parsed = begin(access, "requirement.edit", unlinkInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { requirementLinkId, expectedVersion } = parsed.data;
  if (!isLive(state.link, access.workspace.id) || state.link.id !== requirementLinkId) return fail(gone(ALREADY_UNLINKED_MESSAGE));
  const got = current(state.link, access, requirementLinkId, expectedVersion, "link");
  if (!got.ok) return fail(got.error);
  return done(ctx, access, undefined, [softDelete(ctx, "requirement_link", got.row)]);
}

// ---- links of deleted model elements (PRD item 10) ----

/** The requirement links on deleted model elements: soft-deleted in the deleting command's change group. */
export const softDeleteRequirementLinks = (ctx: CommandContext, links: readonly RequirementLink[] | undefined, targets: readonly LabelTarget[]): Write[] =>
  linksOnItems(links, targets).map((k) => softDelete(ctx, "requirement_link", k));
