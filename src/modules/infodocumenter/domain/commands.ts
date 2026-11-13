// InfoDocumenter's commands (slice 25, PRD section 5, step 2): create from a preset, save, share and unshare,
// duplicate, delete; since slice 26 (F12) a save takes the style and a section's heading and page break, and a
// section is added, removed and moved. Each is a write of `document_definition` outside undo (R2-4a2): one change group with its change
// event (AD-13) that never becomes an undo step, saved against the row's version (D-59). A save takes only the fields
// that changed (slice 9, P3) and checks the recipe it leaves against the section kinds' schemas.

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "@/domain/changes";
import { current, nothingToChange, softDeleted } from "@/domain/commands/shared";
import type { DocumentSectionKind } from "@/domain/document/sections";
import { sectionOptionsRefusal } from "@/domain/document/sections";
import { domainError, notFound, type DomainError } from "@/domain/errors";
import type { WorkspaceAccess } from "@/domain/permissions";
import { parseInput, uuidSchema, versionSchema } from "@/domain/validation";
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

const createInput = z.object({ workspaceId: uuidSchema, preset: z.enum(DOCUMENT_PRESETS) }).strict();
export type CreateDocumentInput = z.input<typeof createInput>;

const EMPTY_COVER: DocumentCover = { title: null, subtitle: null, version: null, status: null, preparedBy: null };

/**
 * A new private document of the person's from a preset (D1, D13): named by the preset's label, the live model, the whole
 * model in scope, both levels, the preset's mappings, its sections, then the available modules' that end it.
 */
export function createDocument(ctx: CommandContext, access: WorkspaceAccess, input: unknown, kinds: Kinds): CommandResult<{ document: DocumentDefinition }> {
  const refused = createRefusal(access);
  if (refused) return fail(refused);
  const parsed = parseInput(createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.data.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const preset = presetOf(parsed.data.preset);
  const scope: DocumentScope = { projects: [], concepts: [], logical: true, dimensional: true, mappings: preset.mappings };
  const row: DocumentDefinition = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name: preset.label,
    author_id: ctx.actorId,
    shared: false,
    audience: preset.audience,
    preset: preset.code,
    source_kind: "live",
    baseline_id: null,
    scope,
    cover: { ...EMPTY_COVER },
    // a new document takes the workspace's documentation language (Q8); the ETL preset has no draft mark (the prototype's)
    style: defaultStyle({ language: access.workspace.doc_language, watermark: preset.code !== "s2t" }),
    sections: presetSections(preset, kinds.values(), access.workspace, ctx.newId),
  };
  return { ok: true, value: { document: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "document_definition", row }]) };
}

// ---- save ----

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
): CommandResult<{ document: DocumentDefinition; sectionId: string }> {
  const parsed = parseInput(addInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const id = ctx.newId();
  const r = withSections(ctx, access, doc, parsed.data, (sections) => {
    const kind = kinds.get(parsed.data.type);
    if (!kind) return domainError("invalid", SECTION_TEXTS.notInstalled);
    if (!kind.available(access.workspace)) return domainError("invalid", SECTION_TEXTS.off(kind.module ?? "Its module"));
    if (sections.length >= SECTIONS_MAX) return domainError("invalid", SECTION_TEXTS.tooMany);
    return [...sections, newSection(id, kind.type, kind.defaults())];
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
