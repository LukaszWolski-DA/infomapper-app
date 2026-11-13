// Model readiness (slice 26, the prototype's `ready`, D3, D5): what is still open in the scope, each check through the
// app's own rules (definitions, the fed rule, the mapping type check, the mapping statuses, requirement coverage, and the
// model's own checks of D-75 with the modules'), and one rule of InfoDocumenter's own: a weak definition (D5). The
// model checks' groups and lines are in English for now; the section's own words are in the document's language (D3).

import { muted, statusShown, text, warn } from "@/domain/document/blocks";
import type { DocNode, DocRuns } from "@/domain/document/content";
import type { SectionBuildInput } from "@/domain/document/sections";
import { lineOf, modelChecks, type CheckInput } from "@/domain/model/checks";
import { checkMappingTypes } from "@/domain/model/type-check";
import type { LabelKey } from "./labels";
import { attributeLabel, attributesOf, fedRule, mappingColumns, scopeEntities, touchesScope, wordsIn, wordsOf } from "./parts";
import { readinessOptions, type ReadinessCheck } from "./sections";

/**
 * A weak definition (D5, the prototype's rule; ISO/IEC 11179's advice): one with fewer than four words, or one that only
 * repeats the name (both lower case, `_` read as a space, `. , ; :` left out). No definition is not weak: it is missing.
 */
export function isWeakDefinition(name: string, definition: string | null | undefined): boolean {
  const words = wordsIn(definition);
  if (!words.length) return false;
  const named = name.toLowerCase().replace(/[_\s]+/g, " ").trim();
  return words.length < 4 || words.join(" ").toLowerCase().replace(/[.,;:]/g, "") === named;
}

const CHECK_LABEL: Record<Exclude<ReadinessCheck, "modelChecks">, LabelKey> = {
  entityDefinitions: "rc_entDef",
  attributeDefinitions: "rc_attrDef",
  weakDefinitions: "rc_weak",
  notFed: "rc_notFed",
  typeProblems: "rc_type",
  notApproved: "rc_open",
  requirements: "rc_req",
};

/** One check's result: its label (a model check's group title, with High), its open items. */
interface Result {
  label: string;
  high?: boolean;
  items: string[];
}

/**
 * The checks over the scope's entities of both levels (the prototype's `readyChecks`), in the options' order; the model
 * checks after them, one per group with lines touching the scope (`modelChecks`'s scope: the project home's rule).
 */
export function readinessResults({ state, scope, options, language }: SectionBuildInput): Result[] {
  const o = readinessOptions.parse(options);
  const t = wordsOf(language);
  const entities = scopeEntities(state, scope);
  const inScope = new Set(entities.map((e) => e.id));
  const attributes = entities.flatMap((e) => attributesOf(state, e.id));
  const fed = fedRule(state);
  const label = (a: { id: string }) => attributeLabel(state, a.id);
  const mappings = attributes.flatMap((a) => state.lookup.mappingsOfAttribute.get(a.id) ?? []);
  const out: Result[] = [];
  for (const k of o.checks) {
    if (k === "modelChecks") continue;
    let items: string[] = [];
    if (k === "entityDefinitions") items = entities.filter((e) => !wordsIn(e.definition_text).length).map((e) => e.name);
    else if (k === "attributeDefinitions") items = attributes.filter((a) => !wordsIn(a.definition_text).length).map(label);
    else if (k === "weakDefinitions")
      items = [...entities.filter((e) => isWeakDefinition(e.name, e.definition_text)).map((e) => e.name), ...attributes.filter((a) => isWeakDefinition(a.name, a.definition_text)).map(label)];
    else if (k === "notFed") items = attributes.filter((a) => !fed(a.id)).map(label);
    else if (k === "typeProblems")
      items = mappings
        .filter((m) => statusShown(scope.mappings, m.status))
        .filter((m) => !checkMappingTypes(m, state.lookup.attribute.get(m.attribute_id)!, state.lookup.inputsOf.get(m.id) ?? []).ok)
        .map((m) => `${mappingColumns(state, m)} → ${label({ id: m.attribute_id })}`);
    // every mapping not approved, whatever the document's filter (the prototype's)
    else if (k === "notApproved") items = mappings.filter((m) => m.status !== "approved").map((m) => `${mappingColumns(state, m)} → ${label({ id: m.attribute_id })} (${t(m.status)})`);
    else if (k === "requirements")
      items = state.requirements.requirements
        .filter((r) => touchesScope(state, scope, r))
        .map((r) => ({ r, c: state.requirements.coverage(r.id) }))
        .filter(({ c }) => !c.done)
        .map(({ r, c }) => `${r.key} ${r.name} (${c.covered.length}/${c.total})`);
    out.push({ label: t(CHECK_LABEL[k]), items });
  }
  if (o.checks.includes("modelChecks")) {
    const model = state.snapshot.model;
    const input: CheckInput = { model, lookup: state.lookup, scope: inScope };
    for (const g of modelChecks(input, state.modules.moduleChecks(input)).groups) {
      const items = g.items.map(lineOf).map((l) => [l.name, l.detail].filter(Boolean).join(" · "));
      if (items.length) out.push({ label: g.title, high: g.high, items });
    }
  }
  return out;
}

/**
 * The section (the prototype's `ready`): the intro, a table of each check with its count or ✓ (and the model checks'
 * note), then "Every check passes." or each open check's items, up to the chosen number.
 */
export function buildReadiness(input: SectionBuildInput): DocNode[] {
  const o = readinessOptions.parse(input.options);
  const t = wordsOf(input.language);
  const results = readinessResults(input);
  const labelRuns = (r: Result): DocRuns => (r.high ? [text(r.label), text(" "), { text: t("high"), pill: true, status: "draft" }] : [text(r.label)]);
  const out: DocNode[] = [
    { kind: "paragraph", runs: [muted(t("readyIntro"))] },
    {
      kind: "table",
      style: "checks",
      columns: [
        { key: "check", label: t("chk") },
        { key: "result", label: t("result") },
      ],
      rows: results.map((r) => ({ cells: [labelRuns(r), r.items.length ? [{ ...warn(String(r.items.length)), strong: true }] : [{ text: "✓", ok: true }]] })),
    },
  ];
  if (o.checks.includes("modelChecks")) out.push({ kind: "meta", parts: [[text(t("mchkNote"))]] });
  const open = results.filter((r) => r.items.length);
  if (!open.length) {
    out.push({ kind: "paragraph", runs: [{ text: t("readyOk"), ok: true }] });
    return out;
  }
  if (o.list)
    for (const r of open) {
      out.push({ kind: "heading", level: 2, text: `${r.label}${r.high ? ` · ${t("high")}` : ""} (${r.items.length})` });
      out.push({
        kind: "list",
        columns: 2,
        items: [...r.items.slice(0, o.max).map((x) => ({ runs: [text(x)] })), ...(r.items.length > o.max ? [{ runs: [text(t("more", { n: r.items.length - o.max }))], muted: true }] : [])],
      });
    }
  return out;
}
