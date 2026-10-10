// Working labels (D-08, D-09, D-24, slice 3a): assigned by hand to entities, attributes, mappings, source tables and
// columns; renamed, deleted (with their links and project pins, one change group) and pinned to a project's home
// (D-29). Labels are kept apart from the model: deleting one leaves the model untouched. Modelers, admins and owners
// change labels (Łukasz, step 0 answer 2). Pinning is written with its change events but is not an undo step.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { labelKey, labelNamed, LABEL_TARGET_KINDS, marks, normalizeLabelName, targetColumns, type LabelTarget, type LabelTargetKind } from "../model/labels";
import type { WorkspaceAccess } from "../permissions";
import type { Attribute, Entity, Label, LabelLink, Mapping, Project, ProjectPinnedLabel, SourceColumn, SourceTable } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, found, isLive, softDelete } from "./shared";

/** A name as typed: normalised by the server too (trimmed, no commas, hyphens for spaces, 60 characters). */
const labelNameSchema = z
  .string()
  .max(1000, "This name is too long.")
  .transform(normalizeLabelName)
  .refine((v) => v.length > 0, "Enter a label name.");

const targetSchema = z.object({ kind: z.enum(LABEL_TARGET_KINDS), id: uuidSchema }).strict();

export const takenNameMessage = (name: string): string => `Another label is already called “${name}”.`;

const NOUN: Record<LabelTargetKind, string> = {
  entity: "entity",
  attribute: "attribute",
  mapping: "mapping",
  source_table: "source table",
  source_column: "column",
};

/** The model rows a label can mark; the command checks that the named item is live. */
export interface LabelTargetRows {
  entities: readonly Entity[];
  attributes: readonly Attribute[];
  mappings: readonly Mapping[];
  sourceTables: readonly SourceTable[];
  sourceColumns: readonly SourceColumn[];
}

function targetRow(rows: LabelTargetRows, target: LabelTarget): { id: Uuid; workspace_id: Uuid; deleted_at: string | null } | undefined {
  const list = {
    entity: rows.entities,
    attribute: rows.attributes,
    mapping: rows.mappings,
    source_table: rows.sourceTables,
    source_column: rows.sourceColumns,
  }[target.kind] as readonly { id: Uuid; workspace_id: Uuid; deleted_at: string | null }[];
  return list.find((r) => r.id === target.id);
}

// ---- add a label to an item ----

const addInput = z
  .object({
    target: targetSchema,
    /** An existing label, picked from the suggestions. */
    labelId: uuidSchema.optional(),
    /** Or a name: the label with that name in any case, else a new label. */
    name: labelNameSchema.optional(),
  })
  .strict()
  .refine((v) => (v.labelId === undefined) !== (v.name === undefined), "Pick a label or type a name.");
export type AddLabelInput = z.input<typeof addInput>;

export interface AddLabelState extends LabelTargetRows {
  /** The workspace's labels and links (deleted ones may be included; they are skipped). */
  labels: readonly Label[];
  links: readonly LabelLink[];
}

/**
 * Puts a label on an entity, attribute, mapping, source table or column. A name that no label has creates the label
 * in the same change group; a name another label has in any case uses that label (S3A-02).
 */
export function addLabel(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: AddLabelState,
  input: unknown,
): CommandResult<{ labelId: Uuid; labelLinkId: Uuid; created: boolean; name: string }> {
  const parsed = begin(access, "label.edit", addInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { target, labelId, name } = parsed.data;
  const ws = access.workspace.id;
  if (!isLive(targetRow(state, target), ws)) return fail(notFound(NOUN[target.kind]));

  const writes: Write[] = [];
  let label: Label | null;
  if (labelId) {
    label = state.labels.find((l) => l.id === labelId) ?? null;
    if (!isLive(label, ws)) return fail(notFound("label"));
  } else {
    label = labelNamed(state.labels.filter((l) => isLive(l, ws)), name!);
    if (!label) {
      label = { ...newRowColumns(ctx), workspace_id: ws, name: name!, name_key: labelKey(name!) };
      writes.push({ kind: "insert", table: "label", row: label });
    }
  }
  const created = writes.length > 0;
  if (!created && state.links.some((k) => isLive(k, ws) && k.label_id === label!.id && marks(k, target))) {
    return fail(domainError("conflict", `It already has the label ${label.name}.`));
  }
  const link: LabelLink = { ...newRowColumns(ctx), workspace_id: ws, label_id: label.id, ...targetColumns(target) };
  writes.push({ kind: "insert", table: "label_link", row: link });
  return done(ctx, access, { labelId: label.id, labelLinkId: link.id, created, name: label.name }, writes);
}

// ---- take a label off an item ----

const removeInput = z.object({ labelLinkId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RemoveLabelInput = z.input<typeof removeInput>;

/** Takes a label off one item. The label stays, also when it marks nothing any more (as in the prototype). */
export function removeLabel(ctx: CommandContext, access: WorkspaceAccess, state: { link: LabelLink | null }, input: unknown): CommandResult {
  const parsed = begin(access, "label.edit", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.link, access, parsed.data.labelLinkId, parsed.data.expectedVersion, "label on this item");
  if (!got.ok) return fail(got.error);
  return done(ctx, access, undefined, [softDelete(ctx, "label_link", got.row)]);
}

// ---- rename ----

const renameInput = z.object({ labelId: uuidSchema, expectedVersion: versionSchema, name: labelNameSchema }).strict();
export type RenameLabelInput = z.input<typeof renameInput>;

/** Renames a label; the name stays unique in any case (another case of its own name is fine). */
export function renameLabel(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { labels: readonly Label[] },
  input: unknown,
): CommandResult<{ label: Label }> {
  const parsed = begin(access, "label.edit", renameInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { labelId, expectedVersion, name } = parsed.data;
  const got = current(state.labels.find((l) => l.id === labelId), access, labelId, expectedVersion, "label");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (name === before.name) return fail(domainError("invalid", "Nothing to change."));
  const other = labelNamed(state.labels.filter((l) => l.id !== labelId && isLive(l, access.workspace.id)), name);
  if (other) return fail(domainError("conflict", takenNameMessage(other.name)));
  const row = nextVersion(ctx, before, { name, name_key: labelKey(name) });
  return done(ctx, access, { label: row }, [{ kind: "update", table: "label", before, row }]);
}

// ---- delete ----

const deleteInput = z.object({ labelId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteLabelInput = z.input<typeof deleteInput>;

export interface DeleteLabelState {
  label: Label | null;
  /** The label's links and project pins (others are ignored). */
  links: readonly LabelLink[];
  pins: readonly ProjectPinnedLabel[];
}

/** Deletes a label: it comes off every item and every project home, in one change group. The model is untouched. */
export function deleteLabel(ctx: CommandContext, access: WorkspaceAccess, state: DeleteLabelState, input: unknown): CommandResult<{ name: string; items: number }> {
  const parsed = begin(access, "label.edit", deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.label, access, parsed.data.labelId, parsed.data.expectedVersion, "label");
  if (!got.ok) return fail(got.error);
  const label = got.row;
  const ws = access.workspace.id;
  const links = state.links.filter((k) => isLive(k, ws) && k.label_id === label.id);
  const pins = state.pins.filter((p) => p.workspace_id === ws && p.label_id === label.id);
  return done(ctx, access, { name: label.name, items: links.length }, [
    ...links.map((k) => softDelete(ctx, "label_link", k)),
    ...pins.map((p): Write => ({ kind: "remove", table: "project_pinned_label", before: p })),
    softDelete(ctx, "label", label),
  ]);
}

// ---- pin to a project (D-29) ----

const pinInput = z.object({ projectId: uuidSchema, labelId: uuidSchema, pinned: z.boolean() }).strict();
export type PinLabelInput = z.input<typeof pinInput>;

export interface PinLabelState {
  project: Project | null;
  label: Label | null;
  /** The project's pins. */
  pins: readonly ProjectPinnedLabel[];
}

/** Pins a label to a project's home or unpins it (written with its change event, not an undo step). */
export function setLabelPinned(ctx: CommandContext, access: WorkspaceAccess, state: PinLabelState, input: unknown): CommandResult {
  const parsed = begin(access, "label.edit", pinInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { projectId, labelId, pinned } = parsed.data;
  const project = found(state.project, access, projectId, "project");
  if (!project.ok) return fail(project.error);
  const label = found(state.label, access, labelId, "label");
  if (!label.ok) return fail(label.error);
  const pin = state.pins.find((p) => p.project_id === projectId && p.label_id === labelId);
  if (pinned) {
    if (pin) return fail(domainError("conflict", `${label.row.name} is already pinned to ${project.row.name}.`));
    const row: ProjectPinnedLabel = { project_id: projectId, label_id: labelId, workspace_id: access.workspace.id };
    return done(ctx, access, undefined, [{ kind: "insert", table: "project_pinned_label", row }]);
  }
  if (!pin) return fail(domainError("not_found", `${label.row.name} is not pinned to ${project.row.name}.`));
  return done(ctx, access, undefined, [{ kind: "remove", table: "project_pinned_label", before: pin }]);
}

// ---- links of deleted items (D-47 cascade) ----

/** The live links on any of these items: soft-deleted with them, in the deleting command's change group. */
export function linksOnItems(links: readonly LabelLink[] | undefined, targets: readonly LabelTarget[]): LabelLink[] {
  if (!links?.length || !targets.length) return [];
  const keys = new Set(targets.map((t) => `${t.kind}:${t.id}`));
  return links.filter(
    (k) => k.deleted_at === null && LABEL_TARGET_KINDS.some((kind) => k[`${kind}_id` as keyof LabelLink] !== null && keys.has(`${kind}:${String(k[`${kind}_id` as keyof LabelLink])}`)),
  );
}

export const softDeleteLinks = (ctx: CommandContext, links: readonly LabelLink[]): Write[] => links.map((k) => softDelete(ctx, "label_link", k));
