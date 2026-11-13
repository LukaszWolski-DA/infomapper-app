"use client";

// The editor's Style and Header and footer (slice 26, step 4; the prototype's Style panel without logos and figures):
// the document's language (Q8: a document stored with none follows the workspace's, shown as the language in effect),
// the template, the accent, colours, paper and orientation, the relationship notation, keep-rows and the switches; the
// four header and footer fields with their tokens (D6). Each choice saves its part of the style on the save chain
// (`useChoice`); each field keeps its draft (D-66) and feeds the preview as it is typed (`onType`).

import type { ReactNode } from "react";
import type { useAction } from "@/app/_components/use-action";
import { Seg, TextField, useChoice } from "@/app/_panels/fields";
import type { DocLanguage } from "@/domain/types";
import { ACCENTS, KEEP_ROWS, type StylePatch } from "../domain/style";
import type { DocumentStyle } from "../domain/types";
import { ACCENT_COLOURS } from "../ui/document-css";
import { Check } from "./section-options";

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

export const STYLE_TEXTS = {
  style: "Style",
  language: "Language of the document",
  languageHint: "Headings and labels only. Names and definitions come from the model as written.",
  languages: { en: "English", pl: "Polski", de: "Deutsch" } as Record<DocLanguage, string>,
  template: "Template",
  templates: [
    ["standard", "Standard"],
    ["formal", "Formal"],
    ["compact", "Compact"],
  ] as const,
  templateHints: {
    standard: "Sans serif, each section on a new page.",
    formal: "Serif body text for reading, ruled cover; for client deliverables.",
    compact: "Smaller type, banded tables, sections run on; for working copies.",
  } as Record<DocumentStyle["template"], string>,
  accent: "Accent colour",
  accentHint: "Black and white overrides the accent.",
  paper: "Paper",
  orientation: "Orientation",
  orientations: [
    ["portrait", "Portrait"],
    ["landscape", "Landscape"],
  ] as const,
  colours: "Colours",
  colourChoices: [
    ["colour", "Colour"],
    ["mono", "Black and white"],
  ] as const,
  notation: "Relationship notation",
  notations: [
    ["ie", "Crow's foot"],
    ["uml", "UML"],
  ] as const,
  keepRows: "Keep a table on one page up to",
  keepRowsChoices: { 0: "Never: break anywhere", 10: "10 rows", 15: "15 rows", 25: "25 rows", 40: "40 rows" } as Record<number, string>,
  keepRowsHint: "A shorter entity moves whole to the next page instead of being cut. Headings always stay with what follows them.",
  switches: [
    ["cover", "Cover page"],
    ["contents", "Contents"],
    ["numbers", "Numbered sections and subsections"],
    ["banded", "Banded table rows"],
    ["runningHeader", "Running header"],
    ["watermark", "“Draft” mark when from the live model"],
  ] as const,
  headerFooter: "Header and footer",
  fields: [
    ["header", "left", "Header, left", "{org} · {title}"],
    ["header", "right", "Header, right", "empty"],
    ["footer", "left", "Footer, left", "{workspace} · {state}"],
    ["footer", "right", "Footer, right", "{pagelabel}"],
  ] as const,
  // the prototype's hint without the logo's part (step 1's list of texts); "Running header" is above it
  fieldsHint:
    "Empty uses the grey example. Fields: {org} {title} {client} {workspace} {version} {status} {state} {date} {author}, and {page} {pages} {pagelabel} (not in the header's left part). “Running header” turns the header off.",
} as const;

export function StylePanel({
  style,
  workspaceLanguage,
  readOnly,
  version,
  documentId,
  typed,
  save,
}: {
  style: DocumentStyle;
  /** The workspace's documentation language: what a document without its own follows (Q8). */
  workspaceLanguage: DocLanguage;
  readOnly: boolean;
  version: number;
  documentId: string;
  typed: (key: string) => (text: string) => void;
  save: (patch: StylePatch) => Answer;
}) {
  const T = STYLE_TEXTS;
  return (
    <div data-testid="panel-style">
      <H>{T.style}</H>
      <Field label={T.language} hint={T.languageHint}>
        <Choice stored={style.language ?? workspaceLanguage} save={(v) => save({ language: v })}>
          {(value, pick) => (
            <select data-testid="select-style-language" value={value} disabled={readOnly} onChange={(e) => pick(e.currentTarget.value as DocLanguage)} className={selectClass}>
              {(Object.keys(T.languages) as DocLanguage[]).map((l) => (
                <option key={l} value={l}>
                  {T.languages[l]}
                </option>
              ))}
            </select>
          )}
        </Choice>
      </Field>
      <SegField label={T.template} k="template" stored={style.template} items={T.templates} hints={T.templateHints} readOnly={readOnly} save={save} />
      <Field label={T.accent} hint={T.accentHint}>
        <Choice stored={style.accent} save={(v) => save({ accent: v })}>
          {(value, pick) => (
            <div className="flex gap-2" role="group" data-testid="choice-style-accent">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  title={a}
                  aria-label={a}
                  aria-pressed={value === a}
                  disabled={readOnly}
                  onClick={() => pick(a)}
                  className="h-[26px] w-[26px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)] aria-pressed:shadow-[0_0_0_2px_var(--im-surface),0_0_0_4px_var(--c)]"
                  style={{ background: ACCENT_COLOURS[a], ["--c" as string]: ACCENT_COLOURS[a] }}
                />
              ))}
            </div>
          )}
        </Choice>
      </Field>
      <SegField
        label={T.paper}
        k="paper"
        stored={style.paper}
        items={[
          ["A4", "A4"],
          ["A3", "A3"],
        ]}
        readOnly={readOnly}
        save={save}
      />
      <SegField label={T.orientation} k="orientation" stored={style.orientation} items={T.orientations} readOnly={readOnly} save={save} />
      <SegField label={T.colours} k="colours" stored={style.colours} items={T.colourChoices} readOnly={readOnly} save={save} />
      <SegField label={T.notation} k="notation" stored={style.notation} items={T.notations} readOnly={readOnly} save={save} />
      <Field label={T.keepRows} hint={T.keepRowsHint}>
        <Choice stored={style.keepRows} save={(v) => save({ keepRows: v })}>
          {(value, pick) => (
            <select data-testid="select-style-keepRows" value={value} disabled={readOnly} onChange={(e) => pick(Number(e.currentTarget.value) as DocumentStyle["keepRows"])} className={selectClass}>
              {KEEP_ROWS.map((n) => (
                <option key={n} value={n}>
                  {T.keepRowsChoices[n]}
                </option>
              ))}
            </select>
          )}
        </Choice>
      </Field>
      <div className="mt-1">
        {T.switches.map(([k, label]) => (
          <Check key={k} testId={`check-style-${k}`} label={label} stored={style[k]} disabled={readOnly} onSave={(v) => save({ [k]: v })} />
        ))}
      </div>

      <H>{T.headerFooter}</H>
      {T.fields.map(([part, side, label, example]) => (
        <Field key={`${part}.${side}`} label={label}>
          <TextField
            key={`${documentId}:style.${part}.${side}`}
            value={style[part][side] ?? ""}
            version={version}
            readOnly={readOnly}
            placeholder={example}
            testId={`input-style-${part}-${side}`}
            onType={typed(`style.${part}.${side}`)}
            onSave={(v) => save({ [part]: { [side]: v.trim() ? v : null } })}
          />
        </Field>
      ))}
      <p className="m-0 mt-2 text-[11.5px] text-im-ink-3">{T.fieldsHint}</p>
    </div>
  );
}

function SegField<K extends "template" | "paper" | "orientation" | "colours" | "notation">({
  label,
  k,
  stored,
  items,
  hints,
  readOnly,
  save,
}: {
  label: string;
  k: K;
  stored: DocumentStyle[K];
  items: readonly (readonly [DocumentStyle[K], string])[];
  hints?: Record<string, string>;
  readOnly: boolean;
  save: (patch: StylePatch) => Answer;
}) {
  return (
    <Choice stored={stored} save={(v) => save({ [k]: v } as StylePatch)}>
      {(value, pick) => (
        <Field label={label} hint={hints?.[value]}>
          <Seg testId={`seg-style-${k}`} value={value} options={items} disabled={readOnly} onChange={pick} />
        </Field>
      )}
    </Choice>
  );
}

function Choice<T>({ stored, save, children }: { stored: T; save: (v: T) => Answer; children: (value: T, choose: (v: T) => void) => ReactNode }) {
  const choice = useChoice(stored, save);
  return <>{children(choice.value, choice.choose)}</>;
}

const selectClass = "h-8 w-full rounded-md border border-im-line bg-im-surface px-2 text-im-ink";
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
