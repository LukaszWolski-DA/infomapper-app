"use client";

// A document's form (slice 25, step 4; PRD section 2, D5): one page, no preview. Name, Audience, Shared with the workspace
// (owners, admins and modelers; at once, no question, D4), Model state; the title page's fields; the scope; the
// sections in their order with a switch and their options; Open document and Print. Each field saves its own part of the
// row on the save chain (`saveRow`, D-59): text fields keep their draft and mark a refusal (D-66), choices use
// `useChoice`. Read only in an archived workspace and for a shared document the person may not change, with "Duplicate
// as my document".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAction } from "@/app/_components/use-action";
import { Seg, TextArea, TextField, useChoice } from "@/app/_panels/fields";
import { useToast } from "@/ui/components/toast";
import { DOCUMENT_TEXTS, NAME_REQUIRED, type UpdateDocumentInput } from "../domain/commands";
import { RIGHTS_TEXTS } from "../domain/rights";
import { DICTIONARY_COLUMNS, DICTIONARY_ENTITY_FIELDS, S2T_COLUMNS, type DictionaryColumn, type DictionaryEntityField, type S2TColumn } from "../domain/sections";
import type { DocumentCover, DocumentScope, MappingFilter } from "../domain/types";
import { duplicateDocumentAction, setDocumentSharedAction, updateDocumentAction } from "./actions";

export interface FormSection {
  id: string;
  type: string;
  on: boolean;
  options: Record<string, unknown>;
  /** Its name in the app's language. */
  label: string;
  /** The module's name ("InfoCube"), null for InfoDocumenter's own. */
  module: string | null;
  /** A type some module registers. */
  known: boolean;
  /** Drawn in this workspace now (its module on). */
  available: boolean;
  checks: readonly { key: string; label: string }[] | null;
}

export const FORM_TEXTS = {
  archived: "This workspace is archived, so documents are read-only.",
  sharedReadOnly: "A shared document is changed by modelers, admins and owners. Duplicate it to make your own copy.",
  privateReadOnly: "Only its author changes a private document.",
  duplicate: "Duplicate as my document",
  modelState: "Live model (changes as people work)",
  off: (module: string) => `${module} is off in this workspace`,
  unknown: "This section's module is not installed.",
} as const;

const ENTITY_LABELS: Record<DictionaryEntityField, string> = {
  stereotype: "Stereotype",
  definition: "Definition",
  coverage: "Mapping coverage",
  requirements: "Requirements",
  relationships: "Relationships (after the attributes)",
};
const DICT_LABELS: Record<DictionaryColumn, string> = {
  attribute: "Attribute",
  type: "Type",
  keys: "Keys",
  nullable: "Nullable",
  pii: "Personal data",
  definition: "Definition",
  mappedFrom: "Mapped from",
  calculation: "Calculation",
  requirements: "Requirements",
};
const S2T_LABELS: Record<S2TColumn, string> = {
  target: "Target",
  targetType: "Target type",
  system: "System",
  sourceColumn: "Source column",
  sourceType: "Source type",
  rule: "Rule",
  status: "Status",
  typeCheck: "Type check",
  note: "Note",
  requirements: "Requirements",
};
const MAPPINGS: readonly (readonly [MappingFilter, string])[] = [
  ["all", "All, drafts marked"],
  ["notdraft", "Approved and in review"],
  ["approved", "Approved only"],
];
/** The section's name in the form, for InfoDocumenter's own (a module's comes with its type). */
const OWN_LABELS: Record<string, string> = { text: "Text", dict: "Data dictionary", s2t: "Source-to-target mapping" };

interface Props {
  workspaceId: string;
  document: { id: string; version: number; name: string; audience: string | null; shared: boolean; scope: DocumentScope; cover: DocumentCover };
  sections: FormSection[];
  rights: { edit: boolean; share: boolean; unshare: boolean; delete: boolean; duplicate: boolean };
  archived: boolean;
  author: string;
  /** Whether the author is still a member (F17 a: otherwise the document stays shared). */
  authorMember: boolean;
  viewHref: string;
  projects: { id: string; name: string }[];
  concepts: { id: string; name: string }[];
}

type Patch = Omit<UpdateDocumentInput, "workspaceId" | "documentId" | "expectedVersion">;

export function DocumentForm({ workspaceId, document: doc, sections, rights, archived, author, authorMember, viewHref, projects, concepts }: Props) {
  const { saveRow, run, pending } = useAction();
  const toast = useToast();
  const router = useRouter();
  const ro = !rights.edit;
  const row = { id: doc.id, version: doc.version };
  const save = (patch: Patch) => saveRow(row, (v) => updateDocumentAction({ workspaceId, documentId: doc.id, expectedVersion: v, ...patch }));
  const text = (field: string, value: string | null, patch: (v: string | null) => Patch, opts: { placeholder?: string; testId: string; required?: boolean }) => (
    <TextField
      key={`${doc.id}:${field}`}
      value={value ?? ""}
      version={doc.version}
      readOnly={ro}
      required={opts.required}
      onEmpty={opts.required ? () => toast(NAME_REQUIRED, "refusal") : undefined}
      placeholder={opts.placeholder}
      testId={opts.testId}
      onSave={(v) => save(patch(v.trim() ? v : null))}
    />
  );
  const duplicate = async () => {
    const r = await run(() => duplicateDocumentAction({ workspaceId, documentId: doc.id }), (v) => DOCUMENT_TEXTS.duplicated(v.name));
    if (r.ok) router.push(r.value.href);
  };

  const notice = archived ? FORM_TEXTS.archived : ro ? (doc.shared ? FORM_TEXTS.sharedReadOnly : FORM_TEXTS.privateReadOnly) : null;
  return (
    <div className="mt-2" data-testid="form-document">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="m-0 text-2xl font-semibold" data-testid="text-form-name">
          {doc.name}
        </h1>
        <Badge testId="badge-sharing">{doc.shared ? "Shared" : "Private"}</Badge>
        {ro && <Badge testId="badge-read-only">Read only</Badge>}
      </div>
      {notice && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-lg bg-im-warn-soft px-3.5 py-2.5" data-testid="banner-document-read-only">
          {notice}
          {rights.duplicate && (
            <button type="button" className={smallButton} data-testid="button-duplicate-mine" disabled={pending} onClick={() => void duplicate()}>
              {FORM_TEXTS.duplicate}
            </button>
          )}
        </div>
      )}

      <Box>
        <Field label="Name">{text("name", doc.name, (v) => ({ name: v ?? "" }), { testId: "input-document-name", required: true })}</Field>
        <Field label="Audience (for your own orientation)">
          {text("audience", doc.audience, (v) => ({ audience: v }), { testId: "input-document-audience", placeholder: "e.g. Business, ETL developers, Client" })}
        </Field>
        {rights.share && (
          <SharedBox
            workspaceId={workspaceId}
            row={row}
            shared={doc.shared}
            // a shared document is made private by its author only (step 4b); while the author is gone it stays shared (F17 a)
            lockedBecause={doc.shared && !rights.unshare ? (authorMember ? RIGHTS_TEXTS.onlyAuthor(author) : RIGHTS_TEXTS.authorGone(author)) : null}
          />
        )}
        <Field label="Model state">
          <div data-testid="text-model-state" className="text-im-ink-2">
            {FORM_TEXTS.modelState}
          </div>
        </Field>
      </Box>

      <H>Title page</H>
      <Box>
        <Field label="Title">{text("title", doc.cover.title, (v) => ({ cover: { title: v } }), { testId: "input-cover-title", placeholder: doc.name })}</Field>
        <Field label="Subtitle">{text("subtitle", doc.cover.subtitle, (v) => ({ cover: { subtitle: v } }), { testId: "input-cover-subtitle" })}</Field>
        <Field label="Version label">{text("version", doc.cover.version, (v) => ({ cover: { version: v } }), { testId: "input-cover-version", placeholder: "e.g. 1.0" })}</Field>
        <Field label="Status">{text("status", doc.cover.status, (v) => ({ cover: { status: v } }), { testId: "input-cover-status", placeholder: "e.g. Draft for review" })}</Field>
        <Field label="Prepared by">{text("preparedBy", doc.cover.preparedBy, (v) => ({ cover: { preparedBy: v } }), { testId: "input-cover-prepared-by", placeholder: author })}</Field>
      </Box>

      <H>Scope</H>
      <Box>
        <Field label="Projects" hint="None ticked: the whole model. Otherwise what the projects' canvases show.">
          <IdChecks testId="checks-projects" items={projects} chosen={doc.scope.projects} disabled={ro} onSave={(ids) => save({ scope: { projects: ids } })} />
        </Field>
        <Field label="Concepts" hint="None ticked: every concept.">
          <IdChecks testId="checks-concepts" items={concepts} chosen={doc.scope.concepts} disabled={ro} onSave={(ids) => save({ scope: { concepts: ids } })} />
        </Field>
        <Field label="Model levels">
          <div className="flex flex-wrap gap-4">
            <Check testId="check-level-logical" label="Logical" stored={doc.scope.logical} disabled={ro} onSave={(on) => save({ scope: { logical: on } })} />
            <Check testId="check-level-dimensional" label="Dimensional (InfoCube)" stored={doc.scope.dimensional} disabled={ro} onSave={(on) => save({ scope: { dimensional: on } })} />
          </div>
        </Field>
        <Field label="Mappings included">
          <Choice stored={doc.scope.mappings} save={(m) => save({ scope: { mappings: m } })}>
            {(value, choose) => <Seg testId="seg-mappings" value={value} options={MAPPINGS} disabled={ro} onChange={choose} />}
          </Choice>
        </Field>
      </Box>

      <H>Sections</H>
      {sections.map((s) => (
        <SectionBox key={s.id} section={s} readOnly={ro} version={doc.version} save={(patch) => save({ section: { id: s.id, ...patch } })} />
      ))}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={viewHref} data-testid="button-open-document" className={primaryLink}>
          Open document
        </Link>
        <Link href={`${viewHref}?print=1`} data-testid="button-print-document" className={secondaryLink}>
          Print
        </Link>
      </div>
    </div>
  );
}

/**
 * "Shared with the workspace": at once, both ways (D4). Disabled on a shared document for everyone but its author, with
 * the reason under it (step 4b); a refusal stays under it too.
 */
function SharedBox({ workspaceId, row, shared, lockedBecause }: { workspaceId: string; row: { id: string; version: number }; shared: boolean; lockedBecause: string | null }) {
  const { saveRow } = useAction();
  const [refusal, setRefusal] = useState<string | null>(null);
  const choice = useChoice(shared, async (next: boolean) => {
    setRefusal(null);
    const answer = await saveRow(row, (v) => setDocumentSharedAction({ workspaceId, documentId: row.id, expectedVersion: v, shared: next }), undefined, { quiet: true });
    if (!answer.ok && answer.message) setRefusal(answer.message);
    return answer;
  });
  return (
    <div className="mt-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" data-testid="check-shared" checked={choice.value} disabled={!!lockedBecause} onChange={(e) => choice.choose(e.currentTarget.checked)} /> Shared
        with the workspace
      </label>
      {lockedBecause && (
        <p className="m-0 mt-1.5 text-[12px] text-im-ink-3" data-testid="text-shared-locked">
          {lockedBecause}
        </p>
      )}
      {refusal && (
        <p className="m-0 mt-1.5 text-[12px] text-im-warn" role="alert" data-testid="text-shared-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

function Choice<T>({ stored, save, children }: { stored: T; save: (v: T) => Answer; children: (value: T, choose: (v: T) => void) => ReactNode }) {
  const choice = useChoice(stored, save);
  return <>{children(choice.value, choice.choose)}</>;
}

function Check({ label, stored, onSave, disabled, testId, title }: { label: string; stored: boolean; onSave: (v: boolean) => Answer; disabled?: boolean; testId: string; title?: string }) {
  const choice = useChoice(stored, onSave);
  return (
    <label className="flex items-center gap-2" title={title}>
      <input type="checkbox" data-testid={testId} checked={choice.value} disabled={disabled} onChange={(e) => choice.choose(e.currentTarget.checked)} />
      {label}
    </label>
  );
}

/** A subset of a fixed list, kept in the list's order. */
function ListChecks<K extends string>({ all, labels, stored, onSave, disabled, testId }: { all: readonly K[]; labels: Record<K, string>; stored: readonly K[]; onSave: (v: K[]) => Answer; disabled?: boolean; testId: string }) {
  const choice = useChoice<readonly K[]>(stored, (v) => onSave([...v]));
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1" data-testid={testId}>
      {all.map((k) => (
        <label key={k} className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid={`${testId}-${k}`}
            checked={choice.value.includes(k)}
            disabled={disabled}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              choice.choose(all.filter((x) => (x === k ? on : choice.value.includes(x))));
            }}
          />
          {labels[k]}
        </label>
      ))}
    </div>
  );
}

function IdChecks({ items, chosen, onSave, disabled, testId }: { items: { id: string; name: string }[]; chosen: string[]; onSave: (v: string[]) => Answer; disabled?: boolean; testId: string }) {
  const live = new Set(items.map((i) => i.id));
  // ids deleted since stay in the recipe and are ignored (F7): the boxes show the live ones
  const choice = useChoice<readonly string[]>(chosen.filter((id) => live.has(id)), (v) => onSave([...v]));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" data-testid={testId}>
      {items.map((i) => (
        <label key={i.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid={`${testId}-item`}
            data-name={i.name}
            checked={choice.value.includes(i.id)}
            disabled={disabled}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              choice.choose(items.map((x) => x.id).filter((id) => (id === i.id ? on : choice.value.includes(id))));
            }}
          />
          {i.name}
        </label>
      ))}
    </div>
  );
}

function SectionBox({ section: s, readOnly, version, save }: { section: FormSection; readOnly: boolean; version: number; save: (patch: { on?: boolean; options?: Record<string, unknown> }) => Answer }) {
  const label = OWN_LABELS[s.type] ?? s.label;
  const o = s.options;
  const opt = (patch: Record<string, unknown>) => save({ options: patch });
  let body: ReactNode = null;
  if (!s.known) body = <p className="m-0 text-im-ink-3">{FORM_TEXTS.unknown}</p>;
  else if (s.type === "text")
    body = (
      <>
        <Field label="Heading">
          <TextField
            value={(o.heading as string | null) ?? ""}
            version={version}
            readOnly={readOnly}
            placeholder="Introduction"
            testId="input-text-heading"
            onSave={(v) => opt({ heading: v.trim() ? v : null })}
          />
        </Field>
        <Field label="Text">
          <TextArea value={(o.body as string) ?? ""} version={version} readOnly={readOnly} rows={6} data-testid="input-text-body" onSave={(v) => opt({ body: v })} />
        </Field>
      </>
    );
  else if (s.type === "dict")
    body = (
      <>
        <Field label="Above each entity">
          <ListChecks testId="checks-dict-entity" all={DICTIONARY_ENTITY_FIELDS} labels={ENTITY_LABELS} stored={o.entity as DictionaryEntityField[]} disabled={readOnly} onSave={(v) => opt({ entity: v })} />
        </Field>
        <Field label="Columns">
          <ListChecks testId="checks-dict-columns" all={DICTIONARY_COLUMNS} labels={DICT_LABELS} stored={o.columns as DictionaryColumn[]} disabled={readOnly} onSave={(v) => opt({ columns: v })} />
        </Field>
      </>
    );
  else if (s.type === "s2t")
    body = (
      <>
        <Field label="Columns">
          <ListChecks testId="checks-s2t-columns" all={S2T_COLUMNS} labels={S2T_LABELS} stored={o.columns as S2TColumn[]} disabled={readOnly} onSave={(v) => opt({ columns: v })} />
        </Field>
        <Field label="Group by">
          <Choice stored={o.group as "entity" | "system"} save={(g) => opt({ group: g })}>
            {(value, choose) => (
              <Seg
                testId="seg-s2t-group"
                value={value}
                options={[
                  ["entity", "By target entity"],
                  ["system", "By source system"],
                ]}
                disabled={readOnly}
                onChange={choose}
              />
            )}
          </Choice>
        </Field>
        <div className="mt-3">
          <Check testId="check-s2t-unmapped" label="List attributes that have no mapping" stored={!!o.unmapped} disabled={readOnly} onSave={(v) => opt({ unmapped: v })} />
        </div>
      </>
    );
  else if (s.checks)
    body = (
      <div className="grid gap-1">
        {s.checks.map((c) => (
          <Check key={c.key} testId={`check-${s.type}-${c.key}`} label={c.label} stored={!!o[c.key]} disabled={readOnly} onSave={(v) => opt({ [c.key]: v })} />
        ))}
      </div>
    );
  return (
    <section className="mb-3 rounded-[10px] bg-im-surface px-4 py-3 shadow-[0_0_0_1px_var(--im-line)]" data-testid="form-section" data-section={s.type}>
      <div className="flex items-center gap-2">
        <Check testId="check-section-on" label="" stored={s.on} disabled={readOnly} onSave={(on) => save({ on })} title={`Include ${label}`} />
        <b className="text-[13.5px] font-semibold">{label}</b>
        {s.module && <span className="rounded bg-im-hover px-1.5 text-[11px] text-im-ink-2">{s.module}</span>}
        {s.known && !s.available && (
          <span className="rounded bg-im-warn-soft px-1.5 text-[11px] text-im-warn" title={FORM_TEXTS.off(s.module ?? "")} data-testid="tag-section-off">
            off
          </span>
        )}
      </div>
      {body}
    </section>
  );
}

const smallButton = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:opacity-50";
const primaryLink = "inline-flex h-8 items-center rounded-md border border-im-logical bg-im-logical px-3 font-medium text-im-surface";
const secondaryLink = "inline-flex h-8 items-center rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover";

const Box = ({ children }: { children: ReactNode }) => <div className="mt-3 rounded-[10px] bg-im-surface px-4 pb-4 pt-1 shadow-[0_0_0_1px_var(--im-line)]">{children}</div>;
const H = ({ children }: { children: ReactNode }) => <h3 className="mb-0 mt-6 text-[13px] font-semibold text-im-ink-2">{children}</h3>;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11.5px] text-im-ink-3">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-im-ink-3">{hint}</div>}
    </div>
  );
}

function Badge({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className="inline-flex h-[22px] items-center rounded-[11px] bg-im-hover px-[9px] text-[11.5px] font-medium text-im-ink-2">
      {children}
    </span>
  );
}

