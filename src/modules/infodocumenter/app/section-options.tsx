"use client";

// A section's options in the editor's right panel (slice 26, the prototype's `props` of each type, without figures): one
// spec per InfoDocumenter type, drawn by `SectionOptions` with the editor's fields (each saves its part of the section's
// options on the save chain, `useChoice`; the naming text keeps its draft, D-66, and feeds the preview with `onType`).
// A module's type draws its own check boxes (`optionChecks`) or its note (`optionNote`).

import { useMemo, type ReactNode } from "react";
import type { useAction } from "@/app/_components/use-action";
import { Seg, TextArea, useChoice } from "@/app/_panels/fields";
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

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

/** What the options need from the workspace (the server reads it with the page). */
export interface OptionContext {
  /** Data Vault 2.0 mode: the Data Vault reading and its classifications. */
  dataVault: boolean;
  /** Whether the workspace has naming conventions (the hint says so when not). */
  hasNaming: boolean;
  /** The workspace's classifications as the register keys them, in list order (Data Vault ones only in its mode). */
  classifications: readonly { key: string; name: string; scope: "column" | "table"; own: boolean }[];
}

type Pairs = readonly (readonly [string, string])[];
type Field =
  | { kind: "check"; key: string; label: string }
  | { kind: "checks"; key: string; label?: string; items: Pairs; hint?: string }
  | { kind: "seg"; key: string; label: string; items: Pairs; hints?: Readonly<Record<string, string>> }
  | { kind: "select"; key: string; label: string; items: readonly (readonly [number, string])[]; hint?: string }
  | { kind: "text"; key: string; label: string; placeholder: string; hint: string }
  | { kind: "hint"; text: string };
type Spec = (o: Record<string, unknown>, cx: OptionContext) => readonly (Field | false)[];

const pairs = <K extends string>(keys: readonly K[], labels: Record<K, string>): Pairs => keys.map((k) => [k, labels[k]] as const);
const COLUMNS_HINT = "Order follows this list. Headers are written in the document's language.";
const LONG_TEXTS: Field = {
  kind: "seg",
  key: "longTexts",
  label: "Long texts (definitions, descriptions, rules, notes)",
  items: [
    ["row", "Under each row"],
    ["after", "After the table, numbered"],
    ["column", "As a column"],
  ],
  hints: {
    row: "The row keeps the short properties; each long text gets the full width underneath.",
    after: "The row carries a number; the texts follow the table as numbered notes.",
    column: "In their own column. Long texts make rows tall.",
  },
};

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

const SPECS: Record<string, Spec> = {
  overview: () => [
    { kind: "check", key: "stats", label: "Counts of entities, tables, mappings and requirements" },
    { kind: "check", key: "concepts", label: "Concepts with their entities" },
  ],
  dict: (o) => [
    { kind: "checks", key: "columns", label: "Attribute properties", items: pairs(DICTIONARY_COLUMNS, OPTION_TEXTS.dictionaryColumns), hint: COLUMNS_HINT },
    {
      kind: "seg",
      key: "layout",
      label: "Layout",
      items: [
        ["below", "Definition under each row"],
        ["column", "Definition as a column"],
        ["cards", "One block per attribute"],
      ],
      hints: {
        below: "The row keeps the short properties; the definition gets the full width underneath. Long text cannot widen the table.",
        column: "Every column has a fixed width; long words and links wrap. Best for short definitions.",
        cards: "Each attribute is a small block: properties on one line, the definition as a paragraph. Reads well for the business.",
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
  ],
  s2t: () => [
    { kind: "checks", key: "columns", label: "Columns", items: pairs(S2T_COLUMNS, OPTION_TEXTS.s2tColumns), hint: COLUMNS_HINT },
    LONG_TEXTS,
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
    { kind: "check", key: "tableClassifications", label: "Its classifications" },
    { kind: "check", key: "tableNote", label: "The modeller's note" },
    cx.dataVault ? { kind: "check", key: "dataVault", label: "Data Vault reading (hub, links, satellites)" } : { kind: "hint", text: "The Data Vault reading appears when the workspace is in Data Vault 2.0 mode." },
    { kind: "checks", key: "columns", label: "Column properties", items: pairs(SOURCE_COLUMNS, OPTION_TEXTS.sourceColumns), hint: COLUMNS_HINT },
    LONG_TEXTS,
  ],
  classreg: (_o, cx) => {
    const of = (scope: "column" | "table"): Pairs => cx.classifications.filter((c) => c.scope === scope).map((c) => [c.key, c.own ? `${c.name} (${OPTION_TEXTS.own})` : c.name] as const);
    return [
      { kind: "checks", key: "classifications", label: "Column classifications", items: of("column") },
      { kind: "checks", key: "classifications", label: "Table classifications", items: of("table") },
      { kind: "check", key: "attributes", label: "With personal data: also the logical attributes marked as personal data" },
      LONG_TEXTS,
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
    o.layout === "table" && LONG_TEXTS,
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
    LONG_TEXTS,
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
  typed: (key: string) => (text: string) => void;
  save: (patch: Record<string, unknown>) => Answer;
}) {
  const { sectionId, type, options: o, readOnly, version, context, typed, save } = props;
  const fields = (SPECS[type]?.(o, context) ?? []).filter((f): f is Field => !!f);
  return (
    <div data-testid="section-options">
      {fields.map((f, i) => {
        const id = `${type}-${f.kind === "hint" ? i : f.key}`;
        switch (f.kind) {
          case "check":
            return <Check key={`${id}-${i}`} testId={`check-${type}-${f.key}`} label={f.label} stored={!!o[f.key]} disabled={readOnly} onSave={(v) => save({ [f.key]: v })} />;
          case "checks":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                <ListChecks
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
              </Field>
            );
          case "seg":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hints?.[String(o[f.key])]}>
                <Choice stored={String(o[f.key])} save={(v) => save({ [f.key]: v })}>
                  {(value, pick) => <Seg testId={`seg-${type}-${f.key}`} value={value} options={f.items} disabled={readOnly} onChange={pick} />}
                </Choice>
              </Field>
            );
          case "select":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                <Choice stored={Number(o[f.key])} save={(v) => save({ [f.key]: v })}>
                  {(value, pick) => (
                    <select
                      data-testid={`select-${type}-${f.key}`}
                      value={value}
                      disabled={readOnly}
                      onChange={(e) => pick(Number(e.currentTarget.value))}
                      className="h-8 w-full rounded-md border border-im-line bg-im-surface px-2 text-im-ink"
                    >
                      {f.items.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  )}
                </Choice>
              </Field>
            );
          case "text":
            return (
              <Field key={`${id}-${i}`} label={f.label} hint={f.hint}>
                <TextArea
                  key={`${sectionId}:${f.key}`}
                  value={String(o[f.key] ?? "")}
                  version={version}
                  readOnly={readOnly}
                  rows={4}
                  placeholder={f.placeholder}
                  data-testid={`input-${type}-${f.key}`}
                  onType={typed(`sec:${sectionId}:${f.key}`)}
                  onSave={(v) => save({ [f.key]: v })}
                />
              </Field>
            );
          case "hint":
            return (
              <p key={`${id}-${i}`} className="m-0 mt-3 text-[11.5px] text-im-ink-3">
                {f.text}
              </p>
            );
        }
      })}
    </div>
  );
}

function Choice<T>({ stored, save, children }: { stored: T; save: (v: T) => Answer; children: (value: T, choose: (v: T) => void) => ReactNode }) {
  const choice = useChoice(stored, save);
  return <>{children(choice.value, choice.choose)}</>;
}

export function Check({ label, stored, onSave, disabled, testId }: { label: string; stored: boolean; onSave: (v: boolean) => Answer; disabled?: boolean; testId: string }) {
  const choice = useChoice(stored, onSave);
  return (
    <label className="mt-2 flex items-center gap-2">
      <input type="checkbox" data-testid={testId} checked={choice.value} disabled={disabled} onChange={(e) => choice.choose(e.currentTarget.checked)} />
      {label}
    </label>
  );
}

/** A subset of a fixed list, kept in the list's order; `mine`: the list's own keys (a list split in two saves the rest). */
function ListChecks({ all, stored, onSave, disabled, testId }: { all: Pairs; stored: readonly string[]; onSave: (chosen: string[], mine: string[]) => Answer; disabled?: boolean; testId: string }) {
  const keys = all.map(([k]) => k);
  // the stored list as one object while it stays the same: `useChoice` shows a choice made on that object (D-66)
  const shownKey = JSON.stringify(stored.filter((k) => keys.includes(k)));
  const shown = useMemo(() => JSON.parse(shownKey) as string[], [shownKey]);
  const choice = useChoice<readonly string[]>(shown, (v) => onSave([...v], keys));
  return (
    <div className="grid grid-cols-2 gap-1" data-testid={testId}>
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

function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="de-wrap mt-3">
      {label && <div className="mb-1 text-[11.5px] text-im-ink-3">{label}</div>}
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-im-ink-3">{hint}</div>}
    </div>
  );
}
