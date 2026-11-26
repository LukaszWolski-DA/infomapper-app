"use client";

// A section's options in the editor's right panel (slice 26, the prototype's `props` of each type, without figures): one
// spec per InfoDocumenter type, drawn by `SectionOptions` with the editor's fields (each saves its part of the section's
// options on the save chain, `useChoice`; the naming text keeps its draft, D-66, and feeds the preview with `onType`).
// A module's type draws its own check boxes (`optionChecks`) or its note (`optionNote`).

import { useMemo, type ReactNode } from "react";
import type { useAction } from "@/app/_components/use-action";
import { Seg, TextArea, useChoice } from "@/app/_panels/fields";
import { Field } from "./field";
import type { SectionOptionField } from "@/domain/document/sections";
import {
  DEFINITION_WIDTHS,
  DICTIONARY_COLUMNS,
  DICTIONARY_ENTITY_FIELDS,
  QUALITY_COLUMNS,
  READINESS_CHECKS,
  REQUIREMENT_COLUMNS,
  S2T_COLUMNS,
  SOURCE_COLUMNS,
  TRACE_COLUMNS,
} from "../domain/sections";
import { Check as UiCheck } from "@/ui/components/check";
import { Select } from "@/ui/components/select";

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

/** What the options need from the workspace (the server reads it with the page). */
export interface OptionContext {
  /** Slice 27: the document's smallest names in diagrams (Diagrams' "Document's ({pt} pt)"). */
  smallestPt?: number;
  /** Data Vault 2.0 mode: the Data Vault reading and its classifications. */
  dataVault: boolean;
  /** Whether the workspace has naming conventions (the hint says so when not). */
  hasNaming: boolean;
  /** The workspace's classifications as the register keys them, in list order (Data Vault ones only in its mode). */
  classifications: readonly { key: string; name: string; scope: "column" | "table"; own: boolean }[];
  /** Slice 36: the workspace's live baselines, newest first, for a changes section's "Compared with". */
  baselines?: readonly { id: string; name: string; created_at: string }[];
  /** Slice 36: the previous baseline of the document's own state ("Previous baseline: {name} ({time})"), or none. */
  previous?: { name: string; created_at: string } | null;
  /** Slice 36: a baseline's time in the browser's time zone ("" until it is known). */
  minute?: (iso: string) => string;
}

type Pairs = readonly (readonly [string, string])[];
type FieldSpec =
  | { kind: "check"; key: string; label: string }
  | { kind: "checks"; key: string; label?: string; items: Pairs; hint?: string }
  | { kind: "seg"; key: string; label: string; items: Pairs; hints?: Readonly<Record<string, string>> }
  | { kind: "select"; key: string; label: string; items: readonly (readonly [number, string])[]; hint?: string }
  /** Slice 36: a select of ids, "" for null (a changes section's "Compared with"); a stored id not offered shows `gone`. */
  | { kind: "choice"; key: string; label: string; items: Pairs; gone: string; hint?: string }
  | { kind: "text"; key: string; label: string; placeholder: string; hint: string }
  | { kind: "hint"; text: string }
  /** Slice 28 (finding 7): a group label above the options after it. */
  | { kind: "label"; text: string }
  /** Slice 27: a section's figure editor (`FigureEditor`, drawn by the editor). */
  | { kind: "figures"; key: string; label: string; hint?: string };
type Spec = (o: Record<string, unknown>, cx: OptionContext) => readonly (FieldSpec | false)[];

const pairs = <K extends string>(keys: readonly K[], labels: Record<K, string>): Pairs => keys.map((k) => [k, labels[k]] as const);
const COLUMNS_HINT = "Order follows this list. Headers are written in the document's language.";
/**
 * Where a section's long texts go (slice 28, findings 4, 6, 8): the label names the section's own long texts (its
 * builder's `long` columns); short choices on one line, the full sentence in the hint under them.
 */
const longTexts = (which: string): FieldSpec => ({
  kind: "seg",
  key: "longTexts",
  label: `Long texts (${which})`,
  items: [
    ["row", "Under row"],
    ["after", "Numbered"],
    ["column", "Column"],
  ],
  hints: {
    row: "Under each row: the row keeps the short properties; each long text gets the full width underneath.",
    after: "After the table, numbered: the row carries a number; the texts follow the table as numbered notes.",
    column: "As a column: long texts make rows tall.",
  },
});

export const OPTION_TEXTS = {
  dictionaryColumns: {
    attribute: "Attribute",
    type: "Type",
    keys: "Keys",
    nullable: "Nullable",
    pii: "Personal data",
    definition: "Definition",
    mappedFrom: "Mapped from",
    calculation: "Calculation",
    requirements: "Requirements",
  },
  entityFields: {
    stereotype: "Stereotype",
    definition: "Definition",
    coverage: "Mapping coverage",
    requirements: "Requirements",
    relationships: "Relationships (after the attributes)",
  },
  s2tColumns: {
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
  },
  sourceColumns: { column: "Column", type: "Type", keys: "Keys", classifications: "Classifications", usedBy: "Used by", note: "Note" },
  requirementColumns: { key: "Key", name: "Name", kind: "Kind", status: "Status", priority: "Priority", coverage: "Coverage", scope: "Scope", description: "Description" },
  traceColumns: { mappedFrom: "Mapped from", feeds: "Feeds", covered: "Covered" },
  qualityColumns: { key: "Key", name: "Name", rule: "Rule", onFailure: "On failure", status: "Status", owner: "Owner", appliesTo: "Applies to", description: "Description" },
  readiness: {
    entityDefinitions: "Entities without a definition",
    attributeDefinitions: "Attributes without a definition",
    weakDefinitions: "Definitions that repeat the name or have fewer than four words",
    notFed: "Attributes with no mapping or feed",
    typeProblems: "Mappings with a type problem",
    notApproved: "Mappings not approved yet",
    requirements: "Requirements not fully covered",
    modelChecks: "The model's own checks (D-75): duplicates, copied keys, facts, feeds, unknown members…",
  },
  own: "own",
} as const;

/** Slice 36: the changes section's words in the editor (the prototype's). */
export const CHANGES_OPTION_TEXTS = {
  label: "Compared with",
  previous: (name: string, time: string) => `Previous baseline: ${name} (${time})`,
  noPrevious: "Previous baseline (none yet)",
  gone: "Baseline no longer exists",
  hint: "Compares that baseline with the document's own model state; the older one is always the starting point.",
} as const;

const SPECS: Record<string, Spec> = {
  // slice 36 (B4.1): empty means the previous baseline, named; or any live baseline, newest first
  changes: (_o, cx) => {
    const minute = cx.minute ?? (() => "");
    const previous = cx.previous ? CHANGES_OPTION_TEXTS.previous(cx.previous.name, minute(cx.previous.created_at)) : CHANGES_OPTION_TEXTS.noPrevious;
    return [
      {
        kind: "choice",
        key: "against",
        label: CHANGES_OPTION_TEXTS.label,
        items: [["", previous], ...(cx.baselines ?? []).map((b) => [b.id, `${b.name} (${minute(b.created_at)})`] as const)],
        gone: CHANGES_OPTION_TEXTS.gone,
        hint: CHANGES_OPTION_TEXTS.hint,
      },
    ];
  },
  overview: () => [
    { kind: "figures", key: "figures", label: "Figures (e.g. the logical data model)" },
    {
      kind: "seg",
      key: "figuresAt",
      label: "Where the figures go",
      items: [
        ["end", "Below the content"],
        ["start", "After the description"],
      ],
      // slice 28 (F5): short choices on one line, the full sentence in the hint
      hints: { end: "Below the section's content.", start: "Right after the description, before the counts and concepts." },
    },
    { kind: "check", key: "stats", label: "Counts of entities, tables, mappings and requirements" },
    { kind: "check", key: "concepts", label: "Concepts with their entities" },
  ],
  dict: (o) => [
    { kind: "checks", key: "columns", label: "Attribute properties", items: pairs(DICTIONARY_COLUMNS, OPTION_TEXTS.dictionaryColumns), hint: COLUMNS_HINT },
    {
      kind: "seg",
      key: "layout",
      label: "Layout",
      // slice 28 (findings 4, 8): the long texts' words, and the dictionary's blocks
      items: [
        ["below", "Under row"],
        ["column", "Column"],
        ["cards", "Blocks"],
      ],
      hints: {
        below: "Definition under each row: the row keeps the short properties; the definition gets the full width underneath. Long text cannot widen the table.",
        column: "Definition as a column: every column has a fixed width; long words and links wrap. Best for short definitions.",
        cards: "One block per attribute: properties on one line, the definition as a paragraph. Reads well for the business.",
      },
    },
    o.layout === "column" && { kind: "select", key: "definitionWidth", label: "Width of the definition column", items: DEFINITION_WIDTHS.map((w) => [w, `${w} %`] as const) },
    {
      kind: "select",
      key: "longDefinitions",
      label: "Long definitions",
      items: [
        [0, "Always in place"],
        [300, "Over 300 characters: to the end of the section"],
        [600, "Over 600 characters: to the end of the section"],
      ],
      hint: "A moved definition leaves a numbered reference in its place.",
    },
    { kind: "checks", key: "entity", label: "Above each entity's table", items: pairs(DICTIONARY_ENTITY_FIELDS, OPTION_TEXTS.entityFields) },
    { kind: "check", key: "byConcept", label: "Group by concept" },
    o.byConcept !== false && { kind: "check", key: "conceptPage", label: "Each concept on a new page" },
    o.byConcept !== false && { kind: "check", key: "conceptFigures", label: "Figure of the concept's frame at its start (from the first canvas that has one)" },
  ],
  // slice 27, step 3 (D5): the figures, the legend, the notation and the size its figures warn under
  diagrams: (_o, cx) => [
    {
      kind: "figures",
      key: "figures",
      label: "Figures",
      hint: "Untick a figure to leave it out; add a canvas or one of its frames below. Size: a figure is never cut unless you choose a size “in parts”.",
    },
    { kind: "check", key: "legend", label: "Legend under the figures" },
    {
      kind: "seg",
      key: "notation",
      label: "Notation",
      items: [
        ["doc", "Document's"],
        ["ie", "Crow's foot"],
        ["uml", "UML"],
      ],
    },
    {
      kind: "select",
      key: "warnPt",
      label: "Warn when names are smaller than",
      items: [[0, `Document's (${cx.smallestPt ?? 6} pt)`], [5, "5 pt"], [6, "6 pt"], [7, "7 pt"], [8, "8 pt"]],
    },
  ],
  s2t: () => [
    { kind: "checks", key: "columns", label: "Columns", items: pairs(S2T_COLUMNS, OPTION_TEXTS.s2tColumns), hint: COLUMNS_HINT },
    longTexts("rule, note"),
    {
      kind: "seg",
      key: "group",
      label: "Grouping",
      items: [
        ["entity", "By target entity"],
        ["system", "By source system"],
      ],
    },
    { kind: "check", key: "unmapped", label: "List attributes that have no mapping" },
  ],
  sources: (_o, cx) => [
    { kind: "label", text: "For each table" },
    { kind: "check", key: "tableClassifications", label: "Its classifications" },
    { kind: "check", key: "tableNote", label: "The modeller's note" },
    cx.dataVault ? { kind: "check", key: "dataVault", label: "Data Vault reading (hub, links, satellites)" } : { kind: "hint", text: "The Data Vault reading appears when the workspace is in Data Vault 2.0 mode." },
    { kind: "checks", key: "columns", label: "Column properties", items: pairs(SOURCE_COLUMNS, OPTION_TEXTS.sourceColumns), hint: COLUMNS_HINT },
    longTexts("column notes"),
  ],
  classreg: (_o, cx) => {
    const of = (scope: "column" | "table"): Pairs => cx.classifications.filter((c) => c.scope === scope).map((c) => [c.key, c.own ? `${c.name} (${OPTION_TEXTS.own})` : c.name] as const);
    return [
      { kind: "checks", key: "classifications", label: "Column classifications", items: of("column") },
      { kind: "checks", key: "classifications", label: "Table classifications", items: of("table") },
      { kind: "check", key: "attributes", label: "With personal data: also the logical attributes marked as personal data" },
      longTexts("notes"),
    ];
  },
  reqs: (o) => [
    {
      kind: "seg",
      key: "layout",
      label: "Layout",
      items: [
        ["list", "One block per requirement"],
        ["table", "One table"],
      ],
      hints: { list: "Key and name as a heading, the properties on one line, the description in full underneath.", table: "Compact; long descriptions make tall rows." },
    },
    { kind: "checks", key: "columns", label: "Properties", items: pairs(REQUIREMENT_COLUMNS, OPTION_TEXTS.requirementColumns), hint: COLUMNS_HINT },
    o.layout === "table" && longTexts("description, scope"),
    { kind: "check", key: "onlyScope", label: "Only requirements that touch the document's scope" },
  ],
  ready: () => [
    {
      kind: "checks",
      key: "checks",
      label: "Checks",
      items: pairs(READINESS_CHECKS, OPTION_TEXTS.readiness),
      hint: "The definition check follows ISO/IEC 11179's advice: a definition says what the thing is, in more words than its name.",
    },
    { kind: "check", key: "list", label: "List the open items under the summary" },
    { kind: "select", key: "max", label: "Items listed per check", items: [5, 10, 25, 100].map((n) => [n, String(n)] as const) },
  ],
  conv: (_o, cx) => [
    { kind: "check", key: "notation", label: "Relationship notation (follows the document's notation)" },
    { kind: "check", key: "statuses", label: "Mapping statuses" },
    { kind: "check", key: "marks", label: "Marks in diagrams and tables" },
    { kind: "check", key: "stereotypes", label: "Entity stereotypes in use" },
    { kind: "check", key: "classifications", label: "Classifications used in the sources (with the workspace's own)" },
    { kind: "check", key: "types", label: "Physical to logical types found in the sources" },
    {
      kind: "text",
      key: "naming",
      label: "Naming conventions for this document only (optional)",
      placeholder: "Added after the workspace's rules",
      hint: `The workspace's naming rules, classification names and definitions and stereotype definitions come from Metadata conventions on the workspace home${cx.hasNaming ? "" : " (no naming rules there yet)"}.`,
    },
  ],
  trace: () => [
    { kind: "checks", key: "columns", label: "Columns after the attribute", items: pairs(TRACE_COLUMNS, OPTION_TEXTS.traceColumns) },
    { kind: "check", key: "descriptions", label: "Requirement descriptions" },
    {
      kind: "seg",
      key: "layout",
      label: "Layout",
      items: [
        ["byRequirement", "One table per requirement"],
        ["matrix", "One matrix"],
      ],
    },
    { kind: "check", key: "onlyScope", label: "Only requirements that touch the document's scope" },
  ],
  dq: () => [
    { kind: "checks", key: "columns", label: "Columns", items: pairs(QUALITY_COLUMNS, OPTION_TEXTS.qualityColumns), hint: COLUMNS_HINT },
    longTexts("rule, description"),
    { kind: "check", key: "onlyScope", label: "Only rules that touch the document's scope" },
  ],
};

/** Whether InfoDocumenter draws a type's options from a spec here (Text and a module's type are drawn by the editor). */
export const hasSpec = (type: string): boolean => type in SPECS;

export function SectionOptions(props: {
  sectionId: string;
  type: string;
  options: Record<string, unknown>;
  readOnly: boolean;
  version: number;
  context: OptionContext;
  /** Slice 28: the hints of the options that show nothing, by option key (`domain/hints.ts`). */
  hints?: Readonly<Record<string, string>>;
  typed: (key: string) => (text: string) => void;
  save: (patch: Record<string, unknown>) => Answer;
  /** Slice 27: a figure editor for an options key, with its label and hint. */
  figureEditor: (key: string, label: string, hint?: string) => ReactNode;
}) {
  const { sectionId, type, options: o, readOnly, version, context, typed, save, figureEditor, hints = {} } = props;
  const fields = (SPECS[type]?.(o, context) ?? []).filter((f): f is FieldSpec => !!f);
  return (
    <div data-testid="section-options">
      {fields.map((f, i) => {
        const id = `${type}-${f.kind === "hint" || f.kind === "label" ? i : f.key}`;
        switch (f.kind) {
          case "check":
            return (
              <div key={`${id}-${i}`}>
                <Check version={version} testId={`check-${type}-${f.key}`} label={f.label} stored={!!o[f.key]} disabled={readOnly} onSave={(v) => save({ [f.key]: v })} />
                {hints[f.key] && <OptionHint testId={`hint-${type}-${f.key}`} text={hints[f.key]!} />}
              </div>
            );
          case "label":
            return (
              <div key={`${id}-${i}`} className="mb-1 mt-3 text-[11.5px] text-im-ink-3" data-testid={`label-${type}`}>
                {f.text}
              </div>
            );
          case "checks":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                {(ids) => (
                <>
                <ListChecks version={version}
                  labelledBy={ids.labelId}
                  testId={`checks-${type}-${f.key}`}
                  all={f.items}
                  // a list split in two (the register's column and table classifications) saves the whole list
                  stored={(o[f.key] as string[] | undefined) ?? []}
                  disabled={readOnly}
                  onSave={(chosen, mine) => {
                    const others = ((o[f.key] as string[] | undefined) ?? []).filter((k) => !mine.includes(k));
                    return save({ [f.key]: [...others, ...chosen] });
                  }}
                />
                {hints[f.key] && <OptionHint testId={`hint-${type}-${f.key}`} text={hints[f.key]!} />}
                </>
                )}
              </Field>
            );
          case "seg":
            return (
              <Choice version={version} key={`${id}-${i}`} stored={String(o[f.key])} save={(v) => save({ [f.key]: v })}>
                {(value, pick) => (
                  <Field label={f.label} hint={f.hints?.[value]}>
                    {(ids) => <Seg testId={`seg-${type}-${f.key}`} labelledBy={ids.labelId} describedBy={ids.hintId} value={value} options={f.items} disabled={readOnly} onChange={pick} />}
                  </Field>
                )}
              </Choice>
            );
          case "select":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                {(ids) => (
                <Choice version={version} stored={Number(o[f.key])} save={(v) => save({ [f.key]: v })}>
                  {(value, pick) => (
                    <Select
                      id={ids.id}
                      aria-describedby={ids.hintId}
                      data-testid={`select-${type}-${f.key}`}
                      value={value}
                      disabled={readOnly}
                      onChange={(e) => pick(Number(e.currentTarget.value))}
                      className="px-2"
                    >
                      {f.items.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  )}
                </Choice>
                )}
              </Field>
            );
          case "choice":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                {(ids) => (
                  <Choice version={version} stored={typeof o[f.key] === "string" ? (o[f.key] as string) : ""} save={(v) => save({ [f.key]: v || null })}>
                    {(value, pick) => (
                      <Select
                        id={ids.id}
                        aria-describedby={ids.hintId}
                        data-testid={`select-${type}-${f.key}`}
                        value={value}
                        disabled={readOnly}
                        onChange={(e) => pick(e.currentTarget.value)}
                        className="px-2"
                      >
                        {value && !f.items.some(([v]) => v === value) && (
                          <option value={value} disabled>
                            {f.gone}
                          </option>
                        )}
                        {f.items.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Choice>
                )}
              </Field>
            );
          case "text":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                {(ids) => (
                <TextArea
                  key={`${sectionId}:${f.key}`}
                  id={ids.id}
                  aria-describedby={ids.hintId}
                  value={String(o[f.key] ?? "")}
                  version={version}
                  readOnly={readOnly}
                  rows={4}
                  placeholder={f.placeholder}
                  data-testid={`input-${type}-${f.key}`}
                  onType={typed(`sec:${sectionId}:${f.key}`)}
                  onSave={(v) => save({ [f.key]: v })}
                />
                )}
              </Field>
            );
          case "hint":
            return (
              <p key={`${id}-${i}`} className="m-0 mt-3 text-[11.5px] text-im-ink-3">
                {f.text}
              </p>
            );
          case "figures":
            return <div key={`${id}-${i}`}>{figureEditor(f.key, f.label, f.hint)}</div>;
        }
      })}
    </div>
  );
}

/** The sizes and orientations a placed figure is drawn at (the figure editor's, `FIGURE_TEXTS`). */
export interface PlacedSizeTexts {
  sizes: readonly (readonly [string, string])[];
  orientations: readonly (readonly [string, string])[];
}

/**
 * A module's options from its plain fields (slice 27, step 3, `SectionOptionField`): check boxes, segments, selects,
 * group labels, hints, a figure editor, a placed figure's size and orientation and the section's placed figures' lines
 * ("Fact Sales: 1 figure · names 7.4 pt · upright"); each field shown while its `when` holds.
 */
export function ModuleOptions(props: {
  type: string;
  fields: readonly SectionOptionField[];
  options: Record<string, unknown>;
  readOnly: boolean;
  /** The document's version, which the options' saves write (fix/choice-after-undo). */
  version: number;
  save: (patch: Record<string, unknown>) => Answer;
  figureEditor: (key: string, label: string, hint?: string) => ReactNode;
  placedLines: readonly { label: string; summary: string }[];
  sizeTexts: PlacedSizeTexts;
}) {
  const { type, fields, options: o, readOnly, version, save, figureEditor, placedLines, sizeTexts } = props;
  const shown = fields.filter((f) => (f.when ?? []).every((w) => o[w.key] === w.is));
  return (
    <div data-testid="section-options">
      {shown.map((f, i) => {
        switch (f.kind) {
          case "check":
            return <Check version={version} key={i} testId={`check-${type}-${f.key}`} label={f.label} stored={!!o[f.key]} disabled={readOnly} onSave={(v) => save({ [f.key]: v })} />;
          case "label":
            return (
              <div key={i} className="mb-1 mt-3 text-[11.5px] text-im-ink-3">
                {f.text}
              </div>
            );
          case "hint":
            return (
              <p key={i} className="m-0 mt-1 text-[11.5px] text-im-ink-3">
                {f.text}
              </p>
            );
          case "seg":
            return (
              <Field key={i} label={f.label}>
                {(ids) => (
                <Choice version={version} stored={String(o[f.key])} save={(v) => save({ [f.key]: v })}>
                  {(value, pick) => <Seg testId={`seg-${type}-${f.key}`} labelledBy={ids.labelId} value={value} options={f.items} disabled={readOnly} onChange={pick} />}
                </Choice>
                )}
              </Field>
            );
          case "select":
            return (
              <Field key={i} label={f.label} hint={f.hint}>
                {(ids) => (
                <Choice version={version} stored={Number(o[f.key])} save={(v) => save({ [f.key]: v })}>
                  {(value, pick) => (
                    <Select
                      id={ids.id}
                      aria-describedby={ids.hintId}
                      data-testid={`select-${type}-${f.key}`}
                      value={value}
                      disabled={readOnly}
                      onChange={(e) => pick(Number(e.currentTarget.value))}
                      className="px-2"
                    >
                      {f.items.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  )}
                </Choice>
                )}
              </Field>
            );
          case "figureSize":
            // slice 28 (F2): the size on its own row, as wide as the panel; the orientation under it
            return (
              <Field key={i} label={f.label}>
                {(ids) => (
                <div className="flex flex-col gap-1.5" role="group" aria-labelledby={ids.labelId}>
                  {(
                    [
                      [f.size, sizeTexts.sizes, "Size"],
                      [f.orientation, sizeTexts.orientations, "Orientation"],
                    ] as const
                  ).map(([key, items, name]) => (
                    <Choice version={version} key={key} stored={String(o[key])} save={(v) => save({ [key]: v })}>
                      {(value, pick) => (
                        <Select
                          aria-label={name}
                          data-testid={`select-${type}-${key}`}
                          value={value}
                          disabled={readOnly}
                          onChange={(e) => pick(e.currentTarget.value)}
                          className="min-w-0 px-2"
                        >
                          {items.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Choice>
                  ))}
                </div>
                )}
              </Field>
            );
          case "figureLines":
            return (
              <div key={i} data-testid="placed-figure-lines">
                {placedLines.map((l, k) => (
                  <div key={k} className="mt-1 text-[11.5px] text-im-ink-3" data-testid="text-placed-figure">
                    <b>{l.label}</b>: {l.summary}
                  </div>
                ))}
              </div>
            );
          case "figures":
            return <div key={i}>{figureEditor(f.key, f.label, f.hint)}</div>;
        }
      })}
    </div>
  );
}

/** `version`: the document's, which every option's save writes (fix/choice-after-undo). */
function Choice<T>({ stored, save, version, children }: { stored: T; save: (v: T) => Answer; version: number; children: (value: T, choose: (v: T) => void) => ReactNode }) {
  const choice = useChoice(stored, save, version);
  return <>{children(choice.value, choice.choose)}</>;
}

export function Check({ label, stored, onSave, version, disabled, testId }: { label: string; stored: boolean; onSave: (v: boolean) => Answer; version: number; disabled?: boolean; testId: string }) {
  const choice = useChoice(stored, onSave, version);
  return <UiCheck label={label} className="mt-2" data-testid={testId} checked={choice.value} disabled={disabled} onChange={(e) => choice.choose(e.currentTarget.checked)} />;
}

/** A subset of a fixed list, kept in the list's order; `mine`: the list's own keys (a list split in two saves the rest). */
function ListChecks({
  all,
  stored,
  onSave,
  version,
  disabled,
  testId,
  labelledBy,
}: {
  all: Pairs;
  stored: readonly string[];
  onSave: (chosen: string[], mine: string[]) => Answer;
  version: number;
  disabled?: boolean;
  testId: string;
  labelledBy?: string;
}) {
  const keys = all.map(([k]) => k);
  // the stored list as one object while it stays the same: `useChoice` shows a choice made on that object (D-66)
  const shownKey = JSON.stringify(stored.filter((k) => keys.includes(k)));
  const shown = useMemo(() => JSON.parse(shownKey) as string[], [shownKey]);
  const choice = useChoice<readonly string[]>(shown, (v) => onSave([...v], keys), version);
  return (
    <div className="grid grid-cols-2 gap-1" role="group" aria-labelledby={labelledBy} data-testid={testId}>
      {all.map(([k, label]) => (
        <label key={k} className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid={`${testId}-${k}`}
            checked={choice.value.includes(k)}
            disabled={disabled}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              choice.choose(keys.filter((x) => (x === k ? on : choice.value.includes(x))));
            }}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

/** Slice 28 (item 2, Q-B): why an option that is on shows nothing in this document. */
function OptionHint({ text, testId }: { text: string; testId: string }) {
  return (
    <div className="mt-1 rounded bg-im-hover px-2 py-1 text-[11.5px] text-im-ink-2" role="note" data-testid={testId}>
      {text}
    </div>
  );
}
