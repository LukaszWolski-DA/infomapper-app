// InfoDocumenter's commands (slice 25, PRD section 5, step 2): create from a preset, save, share and unshare,
// duplicate, delete; since slice 26 (F12) a save takes the style and a section's heading and page break, and a
// section is added, removed and moved. Each is a write of `document_definition` outside undo (R2-4a2): one change group with its change
// event (AD-13) that never becomes an undo step, saved against the row's version (D-59). A save takes only the fields
// that changed (slice 9, P3) and checks the recipe it leaves against the section kinds' schemas.

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "@/domain/changes";
import { olderFirst } from "@/domain/baseline/compare";
import { BASELINE_GONE_MESSAGE } from "@/domain/baseline/names";
import { current, nothingToChange, softDeleted } from "@/domain/commands/shared";
import type { DocumentSectionKind } from "@/domain/document/sections";
import type { BaselineRef } from "@/domain/document/state";
import { sectionOptionsRefusal } from "@/domain/document/sections";
import { domainError, notFound, type DomainError } from "@/domain/errors";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Uuid } from "@/domain/ids";
import { parseInput, uuidSchema, versionSchema } from "@/domain/validation";
import { diagramFigures } from "./figures";
import { newSection, presetOf, presetSections } from "./presets";
import { headingSchema } from "./sections";
import { defaultStyle, patchedStyle, SECTIONS_MAX, stylePatch } from "./style";
import { canSee, createRefusal, deleteRefusal, editRefusal, shareRefusal } from "./rights";
import { DOCUMENT_PRESETS, MAPPING_FILTERS, type DocumentCover, type DocumentDefinition, type DocumentScope } from "./types";

/** The refusal of an empty name (step 1's list of new texts). */
export const NAME_REQUIRED = "A document needs a name.";
/** The longest name, audience and title page field. */
export const SHORT_TEXT_MAX = 200;
/** The most projects or concepts a scope names. */
export const SCOPE_IDS_MAX = 500;

/** Slice 26's refusals (step 1's list of new texts). */
export const SECTION_TEXTS = {
  tooMany: `A document holds at most ${SECTIONS_MAX} sections.`,
  notInstalled: "This section type is not installed.",
  off: (module: string) => `${module} is off in this workspace.`,
} as const;

/** The toasts (step 1's list of new texts); no Undo: documents are outside undo. */
export const DOCUMENT_TEXTS = {
  deleted: "Document deleted.",
  duplicated: (name: string) => `Duplicated as your private document “${name}”.`,
  copyName: (name: string) => `${name} (copy)`,
} as const;

type Kinds = ReadonlyMap<string, DocumentSectionKind>;

const shortText = z
  .string()
  .trim()
  .max(SHORT_TEXT_MAX, "This text is too long.")
  .nullable()
  .transform((v) => (v ? v : null));
const nameSchema = z.string().trim().min(1, NAME_REQUIRED).max(SHORT_TEXT_MAX, "This name is too long.");
const idList = z
  .array(uuidSchema)
  .max(SCOPE_IDS_MAX, "Too many are chosen.")
  .refine((ids) => new Set(ids).size === ids.length, "Each is chosen once.");

const coverPatch = z
  .object({ title: shortText, subtitle: shortText, version: shortText, status: shortText, preparedBy: shortText })
  .partial()
  .strict();
const scopePatch = z
  .object({ projects: idList, concepts: idList, logical: z.boolean(), dimensional: z.boolean(), mappings: z.enum(MAPPING_FILTERS) })
  .partial()
  .strict();
const sectionPatch = z
  .object({ id: uuidSchema, on: z.boolean().optional(), heading: headingSchema.optional(), newPage: z.boolean().optional(), options: z.record(z.string(), z.unknown()).optional() })
  .strict();

const of = { workspaceId: uuidSchema, documentId: uuidSchema };

// ---- create ----

const createInput = z
  .object({
    workspaceId: uuidSchema,
    preset: z.enum(DOCUMENT_PRESETS),
    /** Slice 36: "New document from it" (a baseline's row); without it the sign-off preset takes the newest. */
    baselineId: uuidSchema.optional(),
  })
  .strict();
export type CreateDocumentInput = z.input<typeof createInput>;

const EMPTY_COVER: DocumentCover = { title: null, subtitle: null, version: null, status: null, preparedBy: null };

/** Slice 36's refusals and names (step 1's Q7, F10; Łukasz's answer 6). */
export const BASELINE_TEXTS = {
  /** The sign-off preset while the workspace has no baseline (the prototype's). */
  noBaseline: "Create a baseline first.",
  /** A baseline deleted meanwhile, of another workspace, or none (slice 35's `BASELINE_GONE_MESSAGE`). */
  gone: BASELINE_GONE_MESSAGE,
  fromBaseline: (name: string) => `Documentation of “${name}”`,
  changesSince: (older: string, newer: string | null) => (newer === null ? `Changes since “${older}”` : `Changes since “${older}” to “${newer}”`),
} as const;

/** A name cut to the longest a document has (F10), as Duplicate does. */
const fitName = (name: string) => name.slice(0, SHORT_TEXT_MAX).trim();

const baselineGone = () => fail(domainError("not_found", BASELINE_TEXTS.gone));

/**
 * A new private document of the person's from a preset (D1, D13): named by the preset's label, the live model, the whole
 * model in scope, both levels, the preset's mappings, its sections, then the available modules' that end it.
 *
 * Slice 36: with a baseline (`baselineId`, "New document from it": "Documentation of “{name}”"), or the sign-off preset
 * (the newest baseline), the document's source is that baseline and its draft mark is off (Łukasz's answer 2); the
 * sign-off preset is refused while the workspace has no live baseline. `canvasIds` are then the baseline's (the caller
 * reads them from its content).
 */
export function createDocument(
  ctx: CommandContext,
  access: WorkspaceAccess,
  input: unknown,
  kinds: Kinds,
  /** Slice 27 (D9): the scope's canvases in order (`diagramCanvases`), for Diagrams' figures. */
  canvasIds: readonly Uuid[] = [],
  /** Slice 36: the workspace's live baselines, newest first (`baselines.list`). */
  baselines: readonly BaselineRef[] = [],
): CommandResult<{ document: DocumentDefinition }> {
  const refused = createRefusal(access);
  if (refused) return fail(refused);
  const parsed = parseInput(createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.data.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const preset = presetOf(parsed.data.preset);
  const chosen = parsed.data.baselineId;
  const baseline = chosen ? baselines.find((b) => b.id === chosen) : preset.fromBaseline ? baselines[0] : undefined;
  if (chosen && !baseline) return baselineGone();
  if (preset.fromBaseline && !baseline) return fail(domainError("invalid", BASELINE_TEXTS.noBaseline));
  const scope: DocumentScope = { projects: [], concepts: [], logical: true, dimensional: true, mappings: preset.mappings };
  const language = access.workspace.doc_language;
  const row: DocumentDefinition = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name: chosen && baseline ? fitName(BASELINE_TEXTS.fromBaseline(baseline.name)) : preset.label,
    author_id: ctx.actorId,
    shared: false,
    audience: preset.audience,
    preset: preset.code,
    source_kind: baseline ? "baseline" : "live",
    baseline_id: baseline?.id ?? null,
    scope,
    cover: { ...EMPTY_COVER },
    // a new document takes the workspace's documentation language (Q8) and its preset's draft mark; none from a baseline
    style: defaultStyle({ language, watermark: baseline ? false : preset.watermark }),
    sections: presetSections(preset, kinds.values(), access.workspace, ctx.newId, canvasIds, language),
  };
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "document_definition", row }]) };
}

const changesDocumentInput = z.object({ workspaceId: uuidSchema, olderId: uuidSchema, newerId: uuidSchema.nullable() }).strict();
export type CreateChangesDocumentInput = z.input<typeof changesDocumentInput>;

/**
 * "Make a document" in the Compare dialog (B4.6, slice 36): a private document from the blank preset (its row's preset
 * stays `blank`, F11) whose source is the newer state (a baseline, or the live model for Now) and whose one section is
 * "Changes since" the older baseline, chosen, not "previous"; named "Changes since “{older}” to “{newer}”" (or
 * "Changes since “{older}”" against Now), cut to the name's length (F10); the whole workspace in scope; no draft mark.
 * The older state is the start whichever way round they come (B4.2).
 */
export function createChangesDocument(
  ctx: CommandContext,
  access: WorkspaceAccess,
  input: unknown,
  kinds: Kinds,
  /** The workspace's live baselines, newest first. */
  baselines: readonly BaselineRef[],
): CommandResult<{ document: DocumentDefinition }> {
  const refused = createRefusal(access);
  if (refused) return fail(refused);
  const parsed = parseInput(changesDocumentInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.data.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const first = baselines.find((b) => b.id === parsed.data.olderId);
  const second = parsed.data.newerId === null ? null : baselines.find((b) => b.id === parsed.data.newerId);
  if (!first || second === undefined) return baselineGone();
  const [older, newer] = olderFirst<BaselineRef>(first, second);
  const preset = presetOf("blank");
  const kind = kinds.get("changes");
  if (!kind) return fail(domainError("invalid", SECTION_TEXTS.notInstalled));
  const row: DocumentDefinition = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name: fitName(BASELINE_TEXTS.changesSince(older!.name, newer?.name ?? null)),
    author_id: ctx.actorId,
    shared: false,
    audience: null,
    preset: preset.code,
    source_kind: newer ? "baseline" : "live",
    baseline_id: newer?.id ?? null,
    scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: preset.mappings },
    cover: { ...EMPTY_COVER },
    style: defaultStyle({ language: access.workspace.doc_language, watermark: false }),
    sections: [newSection(ctx.newId(), kind.type, { ...kind.defaults(), against: older!.id }, !kind.samePage)],
  };
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "document_definition", row }]) };
}

// ---- save ----

/** Slice 27: a figure's canvas or frame of another workspace, or none. */
export const FIGURE_CANVAS_REFUSAL = "That canvas is not in this workspace.";

type FigureRef = { id: string; canvasId: string; frameId: string | null };
const figuresOf = (options: Record<string, unknown>): FigureRef[] => (Array.isArray(options.figures) ? (options.figures as FigureRef[]) : []);
/** The figures of a section's new options that are new, or show another canvas or frame than they did. */
function figuresAdded(before: Record<string, unknown>, after: Record<string, unknown>): FigureRef[] {
  const was = new Map(figuresOf(before).map((f) => [f.id, f]));
  return figuresOf(after).filter((f) => {
    const old = was.get(f.id);
    return !old || old.canvasId !== f.canvasId || old.frameId !== f.frameId;
  });
}

const updateInput = z
  .object({
    ...of,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    audience: shortText.optional(),
    cover: coverPatch.optional(),
    scope: scopePatch.optional(),
    style: stylePatch.optional(),
    section: sectionPatch.optional(),
    /** Slice 36 (B3.2): the document's model state, the live model or a live baseline of the workspace. */
    source: z.discriminatedUnion("kind", [z.object({ kind: z.literal("live") }).strict(), z.object({ kind: z.literal("baseline"), baselineId: uuidSchema }).strict()]).optional(),
  })
  .strict();
export type UpdateDocumentInput = z.input<typeof updateInput>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Saves the fields the input names, against the row's version: the name, the audience, title page fields, scope parts,
 * one section's switch or options (merged into its stored options and checked against its kind). A section of a type no
 * module knows keeps its options; only its switch changes.
 */
export function updateDocument(
  ctx: CommandContext,
  access: WorkspaceAccess,
  doc: DocumentDefinition | null | undefined,
  input: unknown,
  kinds: Kinds,
  /** Slice 27: the workspace's canvases and their frames; a figure added in this save must show one of them. */
  canvases?: { readonly canvasIds: ReadonlySet<string>; readonly frameCanvas: ReadonlyMap<string, string> },
  /**
   * Slice 36: the workspace's live baselines; a source, or a changes section's "Compared with", chosen in this save must
   * be one of them ("This baseline no longer exists." otherwise: deleted meanwhile, another workspace's, or none).
   */
  baselines: readonly BaselineRef[] = [],
): CommandResult<{ document: DocumentDefinition }> {
  const refused = editRefusal(access, doc);
  if (refused) return fail(refused);
  const parsed = parseInput(updateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  const found = current(doc, access, p.documentId, p.expectedVersion, "document");
  if (!found.ok) return fail(found.error);
  const before = found.row;

  const patch: Partial<DocumentDefinition> = {};
  if (p.name !== undefined) patch.name = p.name;
  if (p.audience !== undefined) patch.audience = p.audience;
  if (p.cover) patch.cover = { ...before.cover, ...p.cover };
  if (p.scope) patch.scope = { ...before.scope, ...p.scope };
  if (p.style) patch.style = patchedStyle(before.style, p.style);
  const live = (id: string) => baselines.some((b) => b.id === id);
  if (p.source) {
    if (p.source.kind === "baseline" && !live(p.source.baselineId)) return baselineGone();
    patch.source_kind = p.source.kind;
    patch.baseline_id = p.source.kind === "baseline" ? p.source.baselineId : null;
  }
  if (p.section) {
    const at = before.sections.findIndex((s) => s.id === p.section!.id);
    if (at < 0) return fail(notFound("section"));
    const section = before.sections[at]!;
    const kind = kinds.get(section.type);
    if (p.section.options && !kind) return fail(domainError("invalid", "This section's module is not installed, so its options cannot change."));
    let options = section.options;
    if (p.section.options) {
      const merged = { ...section.options, ...p.section.options };
      const refusal = sectionOptionsRefusal(kinds, { id: section.id, type: section.type, options: merged });
      if (refusal) return fail(refusal);
      options = kind!.options.parse(merged);
      // slice 36: a "Compared with" chosen now must be a live baseline (one kept from before may be gone: S36-05)
      if (typeof options.against === "string" && options.against !== section.options.against && !live(options.against)) return baselineGone();
      const added = figuresAdded(section.options, options);
      if (added.some((f) => !canvases?.canvasIds.has(f.canvasId) || (f.frameId !== null && canvases.frameCanvas.get(f.frameId) !== f.canvasId)))
        return fail(domainError("invalid", FIGURE_CANVAS_REFUSAL, { [`sections.${section.id}`]: "invalid" }));
    }
    const next = {
      ...section,
      on: p.section.on ?? section.on,
      heading: p.section.heading !== undefined ? p.section.heading : section.heading,
      newPage: p.section.newPage ?? section.newPage,
      options,
    };
    patch.sections = before.sections.map((s, i) => (i === at ? next : s));
  }
  if (Object.entries(patch).every(([k, v]) => same(v, before[k as keyof DocumentDefinition]))) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "document_definition", before, row }]) };
}

// ---- sections: add, remove, move (slice 26, F12) ----

const addInput = z.object({ ...of, expectedVersion: versionSchema, type: z.string().min(1).max(64) }).strict();
export type AddDocumentSectionInput = z.input<typeof addInput>;

/** The row with its sections changed, against its version; the edit rights first (Q9). */
function withSections(
  ctx: CommandContext,
  access: WorkspaceAccess,
  doc: DocumentDefinition | null | undefined,
  input: { documentId: string; expectedVersion: number },
  change: (sections: DocumentDefinition["sections"]) => DocumentDefinition["sections"] | DomainError,
): CommandResult<{ document: DocumentDefinition }> {
  const refused = editRefusal(access, doc);
  if (refused) return fail(refused);
  const found = current(doc, access, input.documentId, input.expectedVersion, "document");
  if (!found.ok) return fail(found.error);
  const sections = change(found.row.sections);
  if (!Array.isArray(sections)) return fail(sections as DomainError);
  const row = nextVersion(ctx, found.row, { sections });
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "document_definition", before: found.row, row }]) };
}

/**
 * Adds a section of a registered type at the end, on, with its kind's defaults (the prototype's "+ Add section");
 * refused for a type no module knows, one whose module is off, and past `SECTIONS_MAX` (D10). The new section's id is
 * in the answer, for the editor to select it.
 */
export function addDocumentSection(
  ctx: CommandContext,
  access: WorkspaceAccess,
  doc: DocumentDefinition | null | undefined,
  input: unknown,
  kinds: ReadonlyMap<string, DocumentSectionKind & { readonly module?: string | null }>,
  /** Slice 27 (D9): the document's scope's canvases in order (`diagramCanvases`), for a new Diagrams' figures. */
  canvasIds: readonly Uuid[] = [],
): CommandResult<{ document: DocumentDefinition; sectionId: string }> {
  const parsed = parseInput(addInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const id = ctx.newId();
  const r = withSections(ctx, access, doc, parsed.data, (sections) => {
    const kind = kinds.get(parsed.data.type);
    if (!kind) return domainError("invalid", SECTION_TEXTS.notInstalled);
    if (!kind.available(access.workspace)) return domainError("invalid", SECTION_TEXTS.off(kind.module ?? "Its module"));
    if (sections.length >= SECTIONS_MAX) return domainError("invalid", SECTION_TEXTS.tooMany);
    const options = kind.defaults();
    if (kind.type === "diagrams") options.figures = diagramFigures(canvasIds, ctx.newId);
    return [...sections, newSection(id, kind.type, options, !kind.samePage)];
  });
  return r.ok ? { ...r, value: { ...r.value, sectionId: id } } : r;
}

const removeInput = z.object({ ...of, expectedVersion: versionSchema, sectionId: uuidSchema }).strict();
export type RemoveDocumentSectionInput = z.input<typeof removeInput>;

/** Removes a section, without a question (the prototype's); outside undo, so it is gone (D-80). */
export function removeDocumentSection(ctx: CommandContext, access: WorkspaceAccess, doc: DocumentDefinition | null | undefined, input: unknown): CommandResult<{ document: DocumentDefinition }> {
  const parsed = parseInput(removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  return withSections(ctx, access, doc, parsed.data, (sections) =>
    sections.some((s) => s.id === parsed.data.sectionId) ? sections.filter((s) => s.id !== parsed.data.sectionId) : notFound("section"),
  );
}

const moveInput = z.object({ ...of, expectedVersion: versionSchema, sectionId: uuidSchema, direction: z.enum(["up", "down"]) }).strict();
export type MoveDocumentSectionInput = z.input<typeof moveInput>;

/** Moves a section one place up or down; the first one up or the last one down changes nothing. */
export function moveDocumentSection(ctx: CommandContext, access: WorkspaceAccess, doc: DocumentDefinition | null | undefined, input: unknown): CommandResult<{ document: DocumentDefinition }> {
  const parsed = parseInput(moveInput, input);
  if (!parsed.ok) return fail(parsed.error);
  return withSections(ctx, access, doc, parsed.data, (sections) => {
    const at = sections.findIndex((s) => s.id === parsed.data.sectionId);
    if (at < 0) return notFound("section");
    const to = parsed.data.direction === "up" ? at - 1 : at + 1;
    if (to < 0 || to >= sections.length) return nothingToChange();
    const next = [...sections];
    [next[at], next[to]] = [next[to]!, next[at]!];
    return next;
  });
}

// ---- share and unshare ----

const shareInput = z.object({ ...of, expectedVersion: versionSchema, shared: z.boolean() }).strict();
export type ShareDocumentInput = z.input<typeof shareInput>;

/**
 * Shares a document with the workspace, or makes a shared one its author's private document again, at once (D4 as
 * answered: no question); refused while the author is no longer a member (F17 a). `author`: whether the author is a
 * member now, and their name for the refusal.
 */
export function setDocumentShared(
  ctx: CommandContext,
  access: WorkspaceAccess,
  doc: DocumentDefinition | null | undefined,
  input: unknown,
  author: { member: boolean; name: string },
): CommandResult<{ document: DocumentDefinition }> {
  const parsed = parseInput(shareInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const refused = shareRefusal(access, doc, parsed.data.shared, author);
  if (refused) return fail(refused);
  const found = current(doc, access, parsed.data.documentId, parsed.data.expectedVersion, "document");
  if (!found.ok) return fail(found.error);
  if (found.row.shared === parsed.data.shared) return fail(nothingToChange());
  const row = nextVersion(ctx, found.row, { shared: parsed.data.shared });
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "document_definition", before: found.row, row }]) };
}

// ---- duplicate ----

const duplicateInput = z.object(of).strict();
export type DuplicateDocumentInput = z.input<typeof duplicateInput>;

/** A private copy of a document the person sees, theirs: "{name} (copy)", the same recipe. */
export function duplicateDocument(ctx: CommandContext, access: WorkspaceAccess, doc: DocumentDefinition | null | undefined, input: unknown): CommandResult<{ document: DocumentDefinition }> {
  const refused = createRefusal(access);
  if (refused) return fail(refused);
  const parsed = parseInput(duplicateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (!doc || doc.id !== parsed.data.documentId || !canSee(access, doc)) return fail(notFound("document"));
  const name = DOCUMENT_TEXTS.copyName(doc.name).slice(0, SHORT_TEXT_MAX).trim();
  const row: DocumentDefinition = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name,
    author_id: ctx.actorId,
    shared: false,
    audience: doc.audience,
    preset: doc.preset,
    source_kind: doc.source_kind,
    baseline_id: doc.baseline_id,
    scope: structuredClone(doc.scope),
    cover: structuredClone(doc.cover),
    style: structuredClone(doc.style),
    sections: structuredClone(doc.sections),
  };
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "document_definition", row }]) };
}

// ---- slice 36: the documents made from a baseline ----

/**
 * How many live documents are made from a baseline, every author's, private ones included (Q8): the delete dialog
 * shows the number only, never a name.
 */
export const documentsFromBaseline = (rows: readonly Pick<DocumentDefinition, "source_kind" | "baseline_id" | "deleted_at">[], baselineId: Uuid): number =>
  rows.filter((d) => d.deleted_at === null && d.source_kind === "baseline" && d.baseline_id === baselineId).length;

// ---- delete ----

const deleteInput = z.object({ ...of, expectedVersion: versionSchema }).strict();
export type DeleteDocumentInput = z.input<typeof deleteInput>;

/** Soft-deletes a document (AD-12), outside undo: the tab asks first (D10). */
export function deleteDocument(ctx: CommandContext, access: WorkspaceAccess, doc: DocumentDefinition | null | undefined, input: unknown): CommandResult<{ document: DocumentDefinition }> {
  const refused = deleteRefusal(access, doc);
  if (refused) return fail(refused);
  const parsed = parseInput(deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const found = current(doc, access, parsed.data.documentId, parsed.data.expectedVersion, "document");
  if (!found.ok) return fail(found.error);
  const row = softDeleted(ctx, found.row);
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "document_definition", before: found.row, row }]) };
}
