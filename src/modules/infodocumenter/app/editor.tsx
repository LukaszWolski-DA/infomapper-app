"use client";

// A document's editor (slice 26, PRD section 2; it replaces slice 25's form at `/w/{ws}/d/{id}`): the prototype's top
// bar ("← Documentation", the name, Shared or Private, Read only, the layout's status, the preview's mode and zoom,
// Print / PDF), the sections on the left ("Document", then each section with its switch, up, down and remove, and
// "+ Add section"), the preview in the middle, the options of what is selected on the right.
//
// Every change saves as slice 25's form did: each field its own part of the row on the save chain (`saveRow`, D-59),
// text fields with their draft and their mark (D-66), choices with `useChoice`; the sections' add, remove and move are
// saves of the row too. Outside undo (D-80).
//
// The preview (D7): the page reads the workspace's snapshot once when it opens (`documentSnapshotAction`) and builds the
// content tree here, from the stored recipe with the text fields' drafts applied (`useDraft`'s `onType`), about 500 ms
// after the last keystroke; any other change at once, when its save's page arrives. No cache: each change rebuilds the
// tree (P6). The selection is the section's id or "doc".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAction } from "@/app/_components/use-action";
import { DOCUMENT_SECTION_TYPES, documentStateFor } from "@/app/_lib/document-sections";
import { Seg, TextArea, TextField, useChoice } from "@/app/_panels/fields";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { DOCUMENT_TEXTS, NAME_REQUIRED, type UpdateDocumentInput } from "../domain/commands";
import { buildDocument, type DocumentTree } from "../domain/document";
import { RIGHTS_TEXTS } from "../domain/rights";
import type { DocumentDefinition, MappingFilter } from "../domain/types";
import {
  addDocumentSectionAction,
  documentSnapshotAction,
  duplicateDocumentAction,
  moveDocumentSectionAction,
  removeDocumentSectionAction,
  setDocumentSharedAction,
  updateDocumentAction,
} from "./actions";
import { nextDraft, withDrafts, type TextDraft } from "../ui/drafts";
import { hasSpec, SectionOptions, type OptionContext } from "./section-options";
import { StylePanel } from "./style-panel";
import { DocumentPreview, LAYOUT_THRESHOLD_MS, PREVIEW_TEXTS, type PreviewHandle, type PreviewMode, type PreviewZoom } from "./preview";

/** A registered section type as the editor lists it (the server computes it for the workspace). */
export interface EditorSectionType {
  type: string;
  /** Its name in the editor (English, the app's language). */
  name: string;
  description: string;
  /** The module's name ("InfoCube"), null for InfoDocumenter's own. */
  module: string | null;
  /** Drawn in this workspace now (its module on). */
  available: boolean;
  /** The default heading in the document's language (the Heading field's placeholder). */
  heading: string;
  checks: readonly { key: string; label: string }[] | null;
  /** A line in place of options (a module's type with none to set). */
  note: string | null;
}

export const EDITOR_TEXTS = {
  archived: "This workspace is archived, so documents are read-only.",
  sharedReadOnly: "A shared document is changed by modelers, admins and owners. Duplicate it to make your own copy.",
  privateReadOnly: "Only its author changes a private document.",
  duplicate: "Duplicate as my document",
  modelState: "Live model (changes as people work)",
  off: (module: string) => `${module} is off in this workspace`,
  offLine: (module: string) => `${module} is off in this workspace.`,
  unknown: "This section's module is not installed.",
  back: "← Documentation",
  backTitle: "Back to the Documentation tab",
  print: "Print / PDF",
  documentLine: "Model state, scope, style, cover",
  sections: "Sections",
  addSection: "+ Add section",
  rowTitle: "Double-click to edit",
  headingHint: "Empty: the default heading in the document's language.",
  newPage: "Start on a new page",
  compactRunsOn: "The Compact template runs sections on.",
  whoSees: "Who sees this document",
} as const;

/** InfoDocumenter's own types by their names in the editor (a module's comes with its type). */
const OWN_NAMES: Record<string, string> = { text: "Text", dict: "Data dictionary", s2t: "Source-to-target mapping" };
export const sectionName = (type: string, label: string): string => OWN_NAMES[type] ?? label;

const MAPPINGS: readonly (readonly [MappingFilter, string])[] = [
  ["all", "All, drafts marked"],
  ["notdraft", "Approved and in review"],
  ["approved", "Approved only"],
];

export interface EditorProps {
  workspaceId: string;
  document: Pick<DocumentDefinition, "id" | "version" | "name" | "audience" | "shared" | "scope" | "cover" | "style" | "sections" | "author_id">;
  types: EditorSectionType[];
  rights: { edit: boolean; share: boolean; unshare: boolean; delete: boolean; duplicate: boolean };
  archived: boolean;
  author: string;
  /** Whether the author is still a member (F17 a: otherwise the document stays shared). */
  authorMember: boolean;
  projects: { id: string; name: string }[];
  concepts: { id: string; name: string }[];
  /** The day the live model is read ("Live model on {d}"). */
  date: string;
  /** The test hook for Auto's threshold (`window.__imDocLayoutMs`), only where the test hooks are on. */
  testHooks: boolean;
  /** Whether the dimensional level is drawn (its module on): "Model levels" shows only then (the prototype's). */
  dimensional: boolean;
  /** What the sections' options need from the workspace. */
  optionContext: OptionContext;
  /** The workspace's documentation language: what a document without its own follows (Q8). */
  workspaceLanguage: DocLanguage;
}

type Patch = Omit<UpdateDocumentInput, "workspaceId" | "documentId" | "expectedVersion">;
type Recipe = EditorProps["document"];
/** The recipe's parts the document is built from, as one string: the same string means the same document. */
const recipeKey = (r: Recipe) => JSON.stringify([r.name, r.audience, r.scope, r.cover, r.style, r.sections, r.author_id]);

const MODE_KEY = "infomapper:document-preview";
const readMode = (): PreviewMode => {
  try {
    const v = sessionStorage.getItem(MODE_KEY);
    return v === "exact" || v === "quick" ? v : "auto";
  } catch {
    return "auto";
  }
};

/** The refresh after the last keystroke (P4). */
export const TYPING_PAUSE_MS = 500;

export function DocumentEditor(props: EditorProps) {
  const { workspaceId, document: doc, types, rights, archived, author, authorMember, projects, concepts, date, testHooks, dimensional, optionContext, workspaceLanguage } = props;
  const { saveRow, run, pending } = useAction();
  const toast = useToast();
  const router = useRouter();
  const ro = !rights.edit;
  const row = { id: doc.id, version: doc.version };
  const save = (patch: Patch) => saveRow(row, (v) => updateDocumentAction({ workspaceId, documentId: doc.id, expectedVersion: v, ...patch }));
  const typeOf = useMemo(() => new Map(types.map((t) => [t.type, t])), [types]);

  // ---- the selection, the preview's mode and zoom ----
  const [selected, setSelected] = useState<string>("doc");
  const [mode, setModeState] = useState<PreviewMode>("auto");
  const [zoom, setZoom] = useState<PreviewZoom>("fit");
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const preview = useRef<PreviewHandle>(null);
  useEffect(() => {
    // the session's mode (F2), read after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is read once the page is interactive
    setModeState(readMode());
  }, []);
  const setMode = (m: PreviewMode) => {
    setModeState(m);
    try {
      sessionStorage.setItem(MODE_KEY, m);
    } catch {
      // a private window: the mode lasts for the page
    }
  };
  const threshold = useCallback(() => {
    const hook = testHooks ? (window as unknown as { __imDocLayoutMs?: number }).__imDocLayoutMs : undefined;
    return typeof hook === "number" ? hook : LAYOUT_THRESHOLD_MS;
  }, [testHooks]);

  // ---- the model, read once (D7) ----
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot<ModuleTable> | null>(null);
  useEffect(() => {
    let gone = false;
    void documentSnapshotAction({ workspaceId, documentId: doc.id }).then((r) => {
      if (gone) return;
      if (r.ok) setSnapshot(r.value);
      else toast(r.message, "refusal");
    });
    return () => {
      gone = true;
    };
    // once per document: later model changes come with a new page (reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, doc.id]);
  // the document state (the app's indexes over the snapshot), once per snapshot; timed for the reference figures (D7)
  const [state, setDocState] = useState<{ state: ReturnType<typeof documentStateFor>; ms: number } | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const started = performance.now();
    const s = documentStateFor(snapshot);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is built once the snapshot came, timed
    setDocState({ state: s, ms: performance.now() - started });
  }, [snapshot]);

  // ---- the drafts and the recipe the preview draws ----
  const drafts = useRef(new Map<string, TextDraft>());
  const docNow = useRef(doc);
  useEffect(() => {
    docNow.current = doc;
  }, [doc]);
  /** The recipe drawn: a new object only when what it draws changed (`recipeKey`). */
  const [drawn, setDrawn] = useState<Recipe>(doc);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redraw = useCallback(() => {
    const next = withDrafts(docNow.current, drafts.current);
    setDrawn((before) => (recipeKey(before) === recipeKey(next) ? before : next));
  }, []);
  // a stored change (a save's page, a choice, a section added): at once
  useEffect(redraw, [doc, redraw]);
  useEffect(() => () => void (pause.current && clearTimeout(pause.current)), []);
  /** A text field's text changed: the preview follows about 500 ms after the last keystroke. */
  const typed = (key: string) => (text: string) => {
    drafts.current.set(key, nextDraft(docNow.current, drafts.current.get(key), key, text));
    if (pause.current) clearTimeout(pause.current);
    pause.current = setTimeout(redraw, TYPING_PAUSE_MS);
  };

  // the tree: rebuilt on each change of what is drawn (no cache, P6); its build time for the reference figures
  const [built, setBuilt] = useState<{ tree: DocumentTree; ms: number; n: number } | null>(null);
  useEffect(() => {
    if (!state) return;
    const started = performance.now();
    const tree = buildDocument({ definition: drawn, state: state.state, types: DOCUMENT_SECTION_TYPES, date });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tree is built from the recipe drawn, timed (reference figure)
    setBuilt((before) => ({ tree, ms: performance.now() - started, n: (before?.n ?? 0) + 1 }));
  }, [state, drawn, date]);

  // the notes on sections skipped while their module is off, one per module (the prototype's)
  const skipped = useMemo(() => {
    const byModule = new Map<string, string[]>();
    for (const s of doc.sections) {
      const t = typeOf.get(s.type);
      if (!s.on || !t || t.available || !t.module) continue;
      byModule.set(t.module, [...(byModule.get(t.module) ?? []), s.heading?.trim() || sectionName(t.type, t.name)]);
    }
    return [...byModule].map(([module, labels]) => PREVIEW_TEXTS.skipped(module, labels));
  }, [doc.sections, typeOf]);

  // ---- the selection and the sync (P5, D9) ----
  const selectedSection = doc.sections.find((s) => s.id === selected) ?? null;
  /** The sections the page last showed: a selected one that leaves them was removed (an added one is not there yet). */
  const shownIds = useRef(new Set(doc.sections.map((s) => s.id)));
  useEffect(() => {
    const ids = new Set(doc.sections.map((s) => s.id));
    const removed = selected !== "doc" && shownIds.current.has(selected) && !ids.has(selected);
    shownIds.current = ids;
    // a removed section's selection goes back to "Document"
    if (removed) setSelected("doc");
  }, [doc.sections, selected]);
  const focusHeading = useRef(false);
  const [focusTick, setFocusTick] = useState(0);
  const choose = (sec: string, scroll: boolean) => {
    setSelected(sec);
    if (scroll) preview.current?.scrollTo(sec);
  };
  /** A double-click: select, scroll, and the section's Heading takes the focus (D9). */
  const open = (sec: string) => {
    choose(sec, true);
    if (sec === "doc") return;
    focusHeading.current = true;
    // a render even when the section was selected already, so the heading takes the focus
    setFocusTick((n) => n + 1);
  };
  const headingRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!focusHeading.current || !headingRef.current) return;
    void focusTick;
    focusHeading.current = false;
    const el = headingRef.current;
    el.focus();
    el.classList.add("de-flash");
    setTimeout(() => el.classList.remove("de-flash"), 900);
  });

  // ---- the sections' writes ----
  const addSection = async (type: string) => {
    setAddOpen(false);
    const r = await saveRow(row, (v) => addDocumentSectionAction({ workspaceId, documentId: doc.id, expectedVersion: v, type }));
    if (r.ok) {
      setSelected(r.value.sectionId);
      // the new section is in the next page; the preview scrolls to it once it is drawn
      setTimeout(() => preview.current?.scrollTo(r.value.sectionId), 600);
    }
  };
  const removeSection = (sectionId: string) => void saveRow(row, (v) => removeDocumentSectionAction({ workspaceId, documentId: doc.id, expectedVersion: v, sectionId }));
  const moveSection = (sectionId: string, direction: "up" | "down") =>
    void saveRow(row, (v) => moveDocumentSectionAction({ workspaceId, documentId: doc.id, expectedVersion: v, sectionId, direction }));

  const duplicate = async () => {
    const r = await run(() => duplicateDocumentAction({ workspaceId, documentId: doc.id }), (v) => DOCUMENT_TEXTS.duplicated(v.name));
    if (r.ok) router.push(r.value.href);
  };

  const text = (key: string, value: string | null, patch: (v: string | null) => Patch, opts: { placeholder?: string; testId: string; required?: boolean; inputRef?: (el: HTMLInputElement | null) => void }) => (
    <TextField
      key={`${doc.id}:${key}`}
      value={value ?? ""}
      version={doc.version}
      readOnly={ro}
      required={opts.required}
      onEmpty={opts.required ? () => toast(NAME_REQUIRED, "refusal") : undefined}
      placeholder={opts.placeholder}
      testId={opts.testId}
      inputRef={opts.inputRef}
      onType={typed(key)}
      onSave={(v) => save(patch(v.trim() ? v : null))}
    />
  );

  const notice = archived ? EDITOR_TEXTS.archived : ro ? (doc.shared ? EDITOR_TEXTS.sharedReadOnly : EDITOR_TEXTS.privateReadOnly) : null;
  const tabHref = `/w/${workspaceId}?tab=docs`;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] bg-im-canvas" data-testid="page-document-editor" data-version={doc.version}>
      <style>{EDITOR_CSS}</style>
      {/* the top bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-im-line bg-im-surface px-3.5 py-2" data-testid="editor-top">
        <Link href={tabHref} data-testid="link-documentation" title={EDITOR_TEXTS.backTitle} className={smallLink}>
          {EDITOR_TEXTS.back}
        </Link>
        <div className="w-[min(340px,40vw)]">{text("name", doc.name, (v) => ({ name: v ?? "" }), { testId: "input-document-name", required: true })}</div>
        <Badge testId="badge-sharing">{doc.shared ? "Shared" : "Private"}</Badge>
        {ro && <Badge testId="badge-read-only">Read only</Badge>}
        <span className="flex-1" />
        <span data-testid="text-pages" className="text-[12px] text-im-ink-3" role="status">
          {status}
        </span>
        <select
          aria-label="Preview pages"
          title={PREVIEW_TEXTS.modeTitle}
          data-testid="select-preview-mode"
          value={mode}
          onChange={(e) => setMode(e.currentTarget.value as PreviewMode)}
          className={selectClass}
        >
          {PREVIEW_TEXTS.modes.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Preview zoom" data-testid="select-preview-zoom" value={zoom} onChange={(e) => setZoom(e.currentTarget.value as PreviewZoom)} className={selectClass}>
          {PREVIEW_TEXTS.zooms.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className={smallButton} data-testid="button-print" disabled={!built} onClick={() => preview.current?.print()}>
          {EDITOR_TEXTS.print}
        </button>
      </div>
      {notice ? (
        <div className="flex flex-wrap items-center gap-2.5 bg-im-warn-soft px-3.5 py-2" data-testid="banner-document-read-only">
          {notice}
          {rights.duplicate && (
            <button type="button" className={smallButton} data-testid="button-duplicate-mine" disabled={pending} onClick={() => void duplicate()}>
              {EDITOR_TEXTS.duplicate}
            </button>
          )}
        </div>
      ) : (
        <div />
      )}

      <div className="de-body grid min-h-0 grid-cols-[250px_minmax(0,1fr)_330px]">
        {/* the left: Document and the sections */}
        <nav className="min-h-0 overflow-auto border-r border-im-line bg-im-surface p-2.5" data-testid="editor-left">
          <button
            type="button"
            data-testid="row-editor-document"
            aria-current={selected === "doc" || undefined}
            onClick={() => choose("doc", true)}
            className={`${rowClass} block w-full text-left`}
          >
            <b className="block text-[13px]">Document</b>
            <span className="text-[11.5px] text-im-ink-3">{EDITOR_TEXTS.documentLine}</span>
          </button>
          <h3 className="mb-1 mt-3.5 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-im-ink-3">{EDITOR_TEXTS.sections}</h3>
          {doc.sections.map((s, i) => (
            <SectionRow
              key={s.id}
              section={s}
              type={typeOf.get(s.type) ?? null}
              first={i === 0}
              last={i === doc.sections.length - 1}
              selected={selected === s.id}
              readOnly={ro}
              version={doc.version}
              onSelect={() => choose(s.id, true)}
              onOpen={() => open(s.id)}
              onSwitch={(on) => save({ section: { id: s.id, on } })}
              onMove={(d) => moveSection(s.id, d)}
              onRemove={() => removeSection(s.id)}
            />
          ))}
          {!ro && (
            <div className="mt-2">
              <button type="button" className={`${smallButton} w-full`} data-testid="button-add-section" aria-expanded={addOpen} onClick={() => setAddOpen((o) => !o)}>
                {EDITOR_TEXTS.addSection}
              </button>
              {addOpen && (
                <div className="mt-1.5 flex flex-col gap-1" data-testid="list-add-section">
                  {types.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      data-testid="button-add-section-type"
                      data-type={t.type}
                      disabled={!t.available || pending}
                      onClick={() => void addSection(t.type)}
                      className="rounded-md border border-im-line bg-im-surface px-2.5 py-1.5 text-left hover:bg-im-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <b className="text-[12.5px]">{sectionName(t.type, t.name)}</b>
                      {t.module && <Chip>{t.module}</Chip>}
                      <span className="block text-[11.5px] text-im-ink-3">{t.available || !t.module ? t.description : EDITOR_TEXTS.offLine(t.module)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* the middle: the preview */}
        <DocumentPreview
          ref={preview}
          tree={built?.tree ?? null}
          mode={mode}
          zoom={zoom}
          threshold={threshold}
          selected={selected}
          onSelect={(sec) => choose(sec, false)}
          onOpen={open}
          skipped={skipped}
          onStatus={setStatus}
        />
        {/* the tree's builds and the last one's time (reference figures, D7; S26-03 counts the refreshes) */}
        <span hidden data-testid="text-build-ms" data-ms={built ? built.ms.toFixed(1) : undefined} data-builds={built?.n ?? 0} data-state-ms={state ? state.ms.toFixed(1) : undefined} />

        {/* the right: what is selected */}
        <aside className="min-h-0 overflow-auto border-l border-im-line bg-im-surface px-4 pb-6" data-testid="editor-right">
          {selectedSection ? (
            <SectionPanel
              key={selectedSection.id}
              section={selectedSection}
              type={typeOf.get(selectedSection.type) ?? null}
              readOnly={ro}
              version={doc.version}
              headingRef={(el) => {
                headingRef.current = el;
              }}
              typed={typed}
              context={optionContext}
              compact={doc.style.template === "compact"}
              save={(patch) => save({ section: { id: selectedSection.id, ...patch } })}
            />
          ) : (
            <div data-testid="panel-document">
              <H>Model state</H>
              <div data-testid="text-model-state" className="text-im-ink-2">
                {EDITOR_TEXTS.modelState}
              </div>

              <H>Scope</H>
              <Field label="Projects" hint="None ticked: the whole model. Otherwise what the projects' canvases show.">
                <IdChecks testId="checks-projects" items={projects} chosen={doc.scope.projects} disabled={ro} onSave={(ids) => save({ scope: { projects: ids } })} />
              </Field>
              <Field label="Concepts" hint="None ticked: every concept.">
                <IdChecks testId="checks-concepts" items={concepts} chosen={doc.scope.concepts} disabled={ro} onSave={(ids) => save({ scope: { concepts: ids } })} />
              </Field>
              {/* only while the dimensional level is drawn (the prototype's; Łukasz's answer to step 2) */}
              {dimensional && (
                <Field label="Model levels">
                  <div className="flex flex-wrap gap-4">
                    <Check testId="check-level-logical" label="Logical" stored={doc.scope.logical} disabled={ro} onSave={(on) => save({ scope: { logical: on } })} />
                    <Check testId="check-level-dimensional" label="Dimensional (InfoCube)" stored={doc.scope.dimensional} disabled={ro} onSave={(on) => save({ scope: { dimensional: on } })} />
                  </div>
                </Field>
              )}
              <Field label="Mappings included">
                <Choice stored={doc.scope.mappings} save={(m) => save({ scope: { mappings: m } })}>
                  {(value, pick) => <Seg testId="seg-mappings" value={value} options={MAPPINGS} disabled={ro} onChange={pick} />}
                </Choice>
              </Field>

              <H>Sharing</H>
              <SharedChoice
                workspaceId={workspaceId}
                row={row}
                shared={doc.shared}
                mayShare={rights.share}
                // a shared document is made private by its author only (slice 25 step 4b); while the author is gone it stays shared (F17 a)
                lockedBecause={doc.shared && !rights.unshare ? (authorMember ? RIGHTS_TEXTS.onlyAuthor(author) : RIGHTS_TEXTS.authorGone(author)) : null}
              />
              <Field label="Audience (for your own orientation)">
                {text("audience", doc.audience, (v) => ({ audience: v }), { testId: "input-document-audience", placeholder: "e.g. Business, ETL developers, Client" })}
              </Field>

              <StylePanel
                style={doc.style}
                workspaceLanguage={workspaceLanguage}
                readOnly={ro}
                version={doc.version}
                documentId={doc.id}
                typed={typed}
                save={(patch) => save({ style: patch })}
              />

              <H>Cover</H>
              <Field label="Title">{text("cover.title", doc.cover.title, (v) => ({ cover: { title: v } }), { testId: "input-cover-title", placeholder: doc.name })}</Field>
              <Field label="Subtitle">{text("cover.subtitle", doc.cover.subtitle, (v) => ({ cover: { subtitle: v } }), { testId: "input-cover-subtitle" })}</Field>
              <Field label="Version label">{text("cover.version", doc.cover.version, (v) => ({ cover: { version: v } }), { testId: "input-cover-version", placeholder: "e.g. 1.0" })}</Field>
              <Field label="Status">{text("cover.status", doc.cover.status, (v) => ({ cover: { status: v } }), { testId: "input-cover-status", placeholder: "e.g. Draft for review" })}</Field>
              <Field label="Prepared by">
                {text("cover.preparedBy", doc.cover.preparedBy, (v) => ({ cover: { preparedBy: v } }), { testId: "input-cover-prepared-by", placeholder: author })}
              </Field>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

/** A section's row on the left: its switch, its name (a module's chip, "off"), up, down, remove. */
function SectionRow({
  section: s,
  type,
  first,
  last,
  selected,
  readOnly,
  onSelect,
  onOpen,
  onSwitch,
  onMove,
  onRemove,
}: {
  section: Recipe["sections"][number];
  type: EditorSectionType | null;
  first: boolean;
  last: boolean;
  selected: boolean;
  readOnly: boolean;
  version: number;
  onSelect: () => void;
  onOpen: () => void;
  onSwitch: (on: boolean) => Answer;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
}) {
  const name = s.heading?.trim() || (type ? sectionName(type.type, type.name) : s.type);
  const typeName = type ? sectionName(type.type, type.name) : s.type;
  const off = !!type && !type.available;
  const choice = useChoice(s.on, onSwitch);
  return (
    <div
      className={`de-sec ${rowClass} group flex items-center gap-1.5 ${!choice.value || off ? "off" : ""}`}
      aria-current={selected || undefined}
      data-testid="editor-section"
      data-section={s.type}
      data-section-id={s.id}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <input
        type="checkbox"
        aria-label={`Include ${typeName}`}
        data-testid="check-section-on"
        checked={choice.value}
        disabled={readOnly}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => choice.choose(e.currentTarget.checked)}
      />
      <span className="de-name min-w-0 flex-1 truncate text-[12.5px]" title={EDITOR_TEXTS.rowTitle} data-testid="text-section-name">
        {name}
      </span>
      {type?.module && <Chip>{type.module}</Chip>}
      {off && (
        <span className="rounded bg-im-warn-soft px-1.5 text-[11px] text-im-warn" title={EDITOR_TEXTS.off(type.module ?? "")} data-testid="tag-section-off">
          off
        </span>
      )}
      {!type && (
        <span className="text-[11px] text-im-ink-3" title={EDITOR_TEXTS.unknown}>
          ?
        </span>
      )}
      {!readOnly && (
        <span className="de-btns flex gap-0.5">
          <IconButton label="Move up" testId="button-section-up" disabled={first} onClick={() => onMove("up")}>
            ↑
          </IconButton>
          <IconButton label="Move down" testId="button-section-down" disabled={last} onClick={() => onMove("down")}>
            ↓
          </IconButton>
          <IconButton label="Remove" testId="button-section-remove" onClick={onRemove}>
            ✕
          </IconButton>
        </span>
      )}
    </div>
  );
}

/** A section's options on the right: its heading, "Start on a new page", then its type's options. */
function SectionPanel({
  section: s,
  type,
  readOnly,
  version,
  headingRef,
  typed,
  save,
  context,
  compact,
}: {
  /** The Compact template runs sections on: "Start on a new page" is disabled (the prototype's). */
  compact: boolean;
  section: Recipe["sections"][number];
  type: EditorSectionType | null;
  readOnly: boolean;
  version: number;
  context: OptionContext;
  headingRef: (el: HTMLInputElement | null) => void;
  typed: (key: string) => (text: string) => void;
  save: (patch: { on?: boolean; heading?: string | null; newPage?: boolean; options?: Record<string, unknown> }) => Answer;
}) {
  const o = s.options;
  const opt = (patch: Record<string, unknown>) => save({ options: patch });
  let body: ReactNode = null;
  if (!type) body = <p className="m-0 mt-3 text-im-ink-3">{EDITOR_TEXTS.unknown}</p>;
  else if (s.type === "text")
    body = (
      <Field label="Text">
        <TextArea
          key={`${s.id}:body`}
          value={(o.body as string) ?? ""}
          version={version}
          readOnly={readOnly}
          rows={12}
          data-testid="input-text-body"
          onType={typed(`sec:${s.id}:body`)}
          onSave={(v) => opt({ body: v })}
        />
      </Field>
    );
  else if (hasSpec(s.type))
    body = <SectionOptions sectionId={s.id} type={s.type} options={o} readOnly={readOnly} version={version} context={context} typed={typed} save={opt} />;
  else if (type.checks)
    body = (
      <div className="mt-3 grid gap-1">
        {type.checks.map((c) => (
          <Check key={c.key} testId={`check-${s.type}-${c.key}`} label={c.label} stored={!!o[c.key]} disabled={readOnly} onSave={(v) => opt({ [c.key]: v })} />
        ))}
      </div>
    );
  else if (type.note) body = <p className="m-0 mt-3 text-[11.5px] text-im-ink-3">{type.note}</p>;
  const name = type ? sectionName(type.type, type.name) : s.type;
  return (
    <div data-testid="panel-section" data-section={s.type}>
      <h3 className="mb-0 mt-4 flex items-center gap-1.5 text-[14px] font-semibold">
        {name}
        {type?.module && <Chip>{type.module}</Chip>}
      </h3>
      {type && <p className="m-0 mt-1 text-[11.5px] text-im-ink-3">{type.description}</p>}
      <Field label="Heading" hint={EDITOR_TEXTS.headingHint}>
        <TextField
          key={`${s.id}:heading`}
          value={s.heading ?? ""}
          version={version}
          readOnly={readOnly}
          placeholder={type?.heading ?? ""}
          testId="input-section-heading"
          inputRef={headingRef}
          onType={typed(`sec:${s.id}:heading`)}
          onSave={(v) => save({ heading: v.trim() ? v : null })}
        />
      </Field>
      <div className="mt-3">
        <Check testId="check-section-new-page" label={EDITOR_TEXTS.newPage} stored={s.newPage} disabled={readOnly || compact} onSave={(v) => save({ newPage: v })} />
        {compact && <div className="mt-1 text-[11.5px] text-im-ink-3">{EDITOR_TEXTS.compactRunsOn}</div>}
      </div>
      {body}
    </div>
  );
}

/**
 * "Who sees this document": Private or Shared with the workspace, at once (D4). Shown to everyone; only owners, admins
 * and modelers change it, the others read "Only modelers, admins and owners share documents."; a shared document is
 * made private by its author only (slice 25 step 4b), with the reason under it; a refusal stays under it too.
 */
function SharedChoice({
  workspaceId,
  row,
  shared,
  mayShare,
  lockedBecause,
}: {
  workspaceId: string;
  row: { id: string; version: number };
  shared: boolean;
  mayShare: boolean;
  lockedBecause: string | null;
}) {
  const { saveRow } = useAction();
  const [refusal, setRefusal] = useState<string | null>(null);
  const choice = useChoice(shared, async (next: boolean) => {
    setRefusal(null);
    const answer = await saveRow(row, (v) => setDocumentSharedAction({ workspaceId, documentId: row.id, expectedVersion: v, shared: next }), undefined, { quiet: true });
    if (!answer.ok && answer.message) setRefusal(answer.message);
    return answer;
  });
  return (
    <Field label={EDITOR_TEXTS.whoSees}>
      <Seg
        testId="seg-shared"
        value={choice.value ? "shared" : "private"}
        options={[
          ["private", "Private"],
          ["shared", "Shared with the workspace"],
        ]}
        disabled={!mayShare || !!lockedBecause}
        onChange={(v) => choice.choose(v === "shared")}
      />
      {!mayShare && <p className="m-0 mt-1.5 text-[12px] text-im-ink-3">{RIGHTS_TEXTS.share}</p>}
      {mayShare && lockedBecause && (
        <p className="m-0 mt-1.5 text-[12px] text-im-ink-3" data-testid="text-shared-locked">
          {lockedBecause}
        </p>
      )}
      {refusal && (
        <p className="m-0 mt-1.5 text-[12px] text-im-warn" role="alert" data-testid="text-shared-refusal">
          {refusal}
        </p>
      )}
    </Field>
  );
}

function Choice<T>({ stored, save, children }: { stored: T; save: (v: T) => Answer; children: (value: T, choose: (v: T) => void) => ReactNode }) {
  const choice = useChoice(stored, save);
  return <>{children(choice.value, choice.choose)}</>;
}

function Check({ label, stored, onSave, disabled, testId }: { label: string; stored: boolean; onSave: (v: boolean) => Answer; disabled?: boolean; testId: string }) {
  const choice = useChoice(stored, onSave);
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" data-testid={testId} checked={choice.value} disabled={disabled} onChange={(e) => choice.choose(e.currentTarget.checked)} />
      {label}
    </label>
  );
}

function IdChecks({ items, chosen, onSave, disabled, testId }: { items: { id: string; name: string }[]; chosen: string[]; onSave: (v: string[]) => Answer; disabled?: boolean; testId: string }) {
  const live = new Set(items.map((i) => i.id));
  // ids deleted since stay in the recipe and are ignored (F7): the boxes show the live ones, as one object while they
  // stay the same (`useChoice` shows a choice made on that object)
  const shownKey = JSON.stringify(chosen.filter((id) => live.has(id)));
  const shown = useMemo(() => JSON.parse(shownKey) as string[], [shownKey]);
  const choice = useChoice<readonly string[]>(shown, (v) => onSave([...v]));
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
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

function IconButton({ label, testId, disabled, onClick, children }: { label: string; testId: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="grid h-[22px] w-[22px] place-items-center rounded text-[12px] text-im-ink-2 hover:bg-im-hover disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const Chip = ({ children }: { children: ReactNode }) => <span className="ml-1 rounded bg-im-hover px-1.5 text-[11px] font-normal text-im-ink-2">{children}</span>;
const H = ({ children }: { children: ReactNode }) => <h3 className="mb-0 mt-5 text-[13px] font-semibold text-im-ink">{children}</h3>;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="de-wrap mt-3">
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

const smallButton = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:opacity-50";
const smallLink = "inline-flex h-[26px] items-center rounded-md px-[9px] text-[12.5px] text-im-ink-2 hover:bg-im-hover hover:text-im-ink";
const selectClass = "h-[26px] rounded-md border border-im-line bg-im-surface px-1.5 text-xs text-im-ink";
const rowClass = "cursor-pointer rounded-md px-2 py-1.5 hover:bg-im-hover aria-[current]:bg-im-logical-soft";

/** The prototype's row and panel details: faint buttons until hover or selection, an off section struck through, the flash. */
const EDITOR_CSS = `
.de-sec .de-btns{opacity:.15}
.de-sec:hover .de-btns,.de-sec[aria-current] .de-btns{opacity:1}
.de-sec.off .de-name{text-decoration:line-through;color:var(--im-ink-3)}
.de-flash{animation:de-flash .9s ease-out}
@keyframes de-flash{0%{box-shadow:0 0 0 3px var(--im-logical)}100%{box-shadow:0 0 0 0 transparent}}
.de-wrap [role=group]{display:flex;flex-wrap:wrap}
@media (max-width:1100px){.de-body{grid-template-columns:220px minmax(0,1fr)!important}.de-body>aside{grid-column:1/-1;border-left:0;border-top:1px solid var(--im-line)}}
@media (max-width:720px){.de-body{grid-template-columns:minmax(0,1fr)!important}}
`;
