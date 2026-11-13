// Requirements and coverage, Traceability and Data quality rules (slice 26, the prototype's `reqs`, `trace`, `dq`). Pure:
// the requirement index (its scope, its coverage by D-31's rule at both levels, D-70), the lookup's mappings and feeds,
// in the document's language. A requirement "touches the scope" when one of its entities is in it (the prototype's).

import { chip, EMPTY, lines, longTextTable, marksStatus, mono, muted, statusShown, strong, text } from "@/domain/document/blocks";
import type { DocNode, DocRuns } from "@/domain/document/content";
import type { SectionBuildInput } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import type { Requirement } from "@/domain/types";
import { attributeLabel, feedStatus, columnRuns, kindWord, priorityWord, statusRun, statusWord, touchesScope, wordsOf, type L } from "./parts";
import { qualityOptions, requirementsOptions, traceOptions, type QualityColumn, type RequirementColumn, type TraceColumn } from "./sections";

const REQUIREMENT_LABEL: Record<RequirementColumn, Parameters<L>[0]> = {
  key: "key",
  name: "name",
  kind: "kind",
  status: "status",
  priority: "prio",
  coverage: "cov",
  scope: "scope",
  description: "desc",
};

/** A coverage bar and "{ok}/{total}", or "–" without items (the prototype's). */
function coverageRuns(state: DocumentState, r: Requirement): DocRuns {
  const c = state.requirements.coverage(r.id);
  return c.total ? [{ text: ` ${c.covered.length}/${c.total}`, bar: { ok: c.covered.length, total: c.total } }] : [text("–")];
}

/**
 * The requirements (in the index's order: by kind, then by key), only those touching the scope when chosen: one block
 * each (its key and name, its properties on one line, its parent, its description, a data quality rule's expression) or
 * one table (the description and the scope long texts, D1).
 */
export function buildRequirements({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = requirementsOptions.parse(options);
  const t = wordsOf(language);
  const rs = state.requirements.requirements.filter((r) => !o.onlyScope || touchesScope(state, scope, r, true));
  if (!rs.length) return [{ kind: "paragraph", runs: [muted(t("none"))] }];
  const value = (k: RequirementColumn, r: Requirement): DocRuns => {
    switch (k) {
      case "key":
        return [strong(r.key)];
      case "name":
        return [text(r.name)];
      case "kind":
        return [text(kindWord(t, r.kind))];
      case "status":
        return [text(statusWord(t, r.status))];
      case "priority":
        return [text(priorityWord(t, r.priority))];
      case "coverage":
        return coverageRuns(state, r);
      case "scope":
        return [text([...state.requirements.scope(r.id).entities].map((id) => state.entity.get(id)?.name ?? "?").join(", "))];
      case "description":
        return r.description_text?.trim() ? [text(r.description_text)] : EMPTY;
    }
  };
  if (o.layout === "table")
    return longTextTable(
      o.columns.map((k) => ({ key: k, label: t(REQUIREMENT_LABEL[k]), long: k === "description" || k === "scope" })),
      rs.map((r) => o.columns.map((k) => value(k, r))),
      o.longTexts,
      t("none"),
    );
  return [
    {
      kind: "cards",
      variant: "requirement",
      cards: rs.map((r) => {
        const parent = r.parent_id ? state.requirements.byId.get(r.parent_id) : undefined;
        const props = o.columns
          .filter((k) => k !== "key" && k !== "name" && k !== "description")
          .map((k) => ({ k, runs: value(k, r) }))
          .filter((x) => x.runs.length && !(x.runs.length === 1 && x.runs[0]!.text === "–"))
          .map((x) => [muted(`${t(REQUIREMENT_LABEL[x.k])}: `), ...x.runs]);
        const extra = [
          ...(parent ? [{ label: "↳", runs: [text(`${parent.key} ${parent.name}`)] }] : []),
          ...(r.kind === "dq_rule" && r.expression?.trim() ? [{ label: "", runs: [mono(r.expression)] }] : []),
        ];
        return {
          title: [...(o.columns.includes("key") ? [chip(r.key, "key"), text(" ")] : []), ...(o.columns.includes("name") ? [text(r.name)] : [])],
          props,
          ...(o.columns.includes("description") && r.description_text?.trim() ? { text: [text(r.description_text)] } : {}),
          lines: extra,
        };
      }),
    },
  ];
}

const TRACE_LABEL: Record<TraceColumn, Parameters<L>[0]> = { mappedFrom: "mappedFrom", feeds: "feeds", covered: "covered" };

/**
 * From each requirement (non-functional ones left out; only those touching the scope when chosen) to the attributes in
 * its scope and in the document's: where each is mapped from (a dimensional one: its feeds' inputs with their source
 * columns), the dimensional attributes it feeds, whether it is covered; one table per requirement or one matrix.
 */
export function buildTrace({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = traceOptions.parse(options);
  const t = wordsOf(language);
  const dimensionalInScope = state.modules.dimensionalOn && scope.dimensional && [...scope.entityIds].some((id) => state.entity.get(id)?.model_level === "dimensional");
  const columns = o.columns.filter((k) => k !== "feeds" || dimensionalInScope);
  const head = [t("attribute"), ...columns.map((k) => t(TRACE_LABEL[k]))];
  const rs = state.requirements.requirements.filter((r) => r.kind !== "non_functional" && (!o.onlyScope || touchesScope(state, scope, r)));
  if (!rs.length) return [{ kind: "paragraph", runs: [muted(t("none"))] }];
  const feedsInto = feedTargets(state);
  const shownColumns = (attributeId: Uuid) =>
    (state.lookup.mappingsOfAttribute.get(attributeId) ?? []).filter((m) => statusShown(scope.mappings, m.status));
  const rowsOf = (r: Requirement): DocRuns[][] =>
    [...state.requirements.scope(r.id).attributes]
      .filter((id) => scope.entityIds.has(state.lookup.attribute.get(id)?.entity_id ?? ""))
      .sort((a, b) => (state.lookup.attributeOrder.get(a) ?? 0) - (state.lookup.attributeOrder.get(b) ?? 0))
      .map((id) => {
        const cells: DocRuns[] = [[mono(attributeLabel(state, id))]];
        for (const k of columns) {
          if (k === "mappedFrom") {
            if (state.lookup.isDimensional(id)) {
              const feeds = state.lookup.feedsOf(id).filter((f) => statusShown(scope.mappings, feedStatus(f)));
              cells.push(
                feeds.length
                  ? lines(
                      feeds.flatMap((f) =>
                        f.inputs.map((input) => [mono(attributeLabel(state, input)), ...shownColumns(input).flatMap((m) => (state.lookup.inputsOf.get(m.id) ?? []).flatMap((c) => [text(" ← "), ...columnRuns(state, c, t)]))]),
                      ),
                    )
                  : [muted(t("notMapped"))],
              );
            } else {
              const ms = shownColumns(id);
              const inputs = state.lookup.calculationInputs(id);
              cells.push(
                ms.length
                  ? lines(ms.map((m) => [...(state.lookup.inputsOf.get(m.id) ?? []).flatMap((c, i) => (i ? [text(" + "), ...columnRuns(state, c, t)] : columnRuns(state, c, t))), ...(marksStatus(scope.mappings) && m.status !== "approved" ? [text(" "), statusRun(m.status, t)] : [])]))
                  : inputs.length
                    ? [text(`= ${inputs.map((x) => state.lookup.attribute.get(x)?.name ?? "?").join(", ")}`)]
                    : [muted(t("notMapped"))],
              );
            }
          } else if (k === "feeds") cells.push(state.lookup.isDimensional(id) ? EMPTY : lines((feedsInto.get(id) ?? []).filter((x) => scope.entityIds.has(state.lookup.attribute.get(x)?.entity_id ?? "")).map((x) => [mono(attributeLabel(state, x))])));
          else cells.push(state.lookup.coverageOf(id) === "covered" ? [{ text: "✓", ok: true }] : [{ text: "–", warn: true }]);
        }
        return cells;
      });
  const table = (labels: string[], rows: DocRuns[][]): DocNode => ({ kind: "table", columns: labels.map((label, i) => ({ key: `c${i}`, label })), rows: rows.map((cells) => ({ cells })) });
  if (o.layout === "matrix") {
    const rows = rs.flatMap((r) => rowsOf(r).map((cells, i) => [i ? EMPTY : [strong(r.key), text(` ${r.name}`)], ...cells]));
    return [table([t("req"), ...head], rows)];
  }
  return rs.map((r): DocNode => {
    const c = state.requirements.coverage(r.id);
    const rows = rowsOf(r);
    const nodes: DocNode[] = [
      { kind: "heading", level: 3, text: `${r.key} ${r.name}` },
      { kind: "meta", parts: [[text(kindWord(t, r.kind))], ...(c.total ? [[text(`${c.covered.length}/${c.total} ${t("covered").toLowerCase()}`)]] : [])] },
    ];
    if (o.descriptions && r.description_text?.trim()) nodes.push({ kind: "paragraph", runs: [text(r.description_text)] });
    nodes.push(rows.length ? table(head, rows) : { kind: "paragraph", runs: [muted(t("noTrace"))] });
    return { kind: "group", nodes };
  });
}

/** The dimensional attributes each logical attribute feeds (the feeds read backwards). */
function feedTargets(state: DocumentState): Map<Uuid, Uuid[]> {
  const out = new Map<Uuid, Uuid[]>();
  for (const [target, feeds] of Object.entries(state.feeds))
    for (const f of feeds) for (const input of f.inputs) (out.get(input) ?? out.set(input, []).get(input)!).push(target);
  return out;
}

const QUALITY_LABEL: Record<QualityColumn, Parameters<L>[0]> = {
  key: "key",
  name: "name",
  rule: "rule",
  onFailure: "severity",
  status: "status",
  owner: "owner",
  appliesTo: "appliesTo",
  description: "desc",
};

/**
 * The data quality rules (requirements of that kind; only those touching the scope when chosen): one table, the rule and
 * the description long texts (D1); what a rule applies to: its attributes, else its entities.
 */
export function buildQuality({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = qualityOptions.parse(options);
  const t = wordsOf(language);
  const rs = state.requirements.requirements.filter((r) => r.kind === "dq_rule" && (!o.onlyScope || touchesScope(state, scope, r)));
  if (!rs.length) return [{ kind: "paragraph", runs: [muted(t("noDq"))] }];
  const value = (k: QualityColumn, r: Requirement): DocRuns => {
    switch (k) {
      case "key":
        return [strong(r.key)];
      case "name":
        return [text(r.name)];
      case "rule":
        return r.expression?.trim() ? [mono(r.expression)] : EMPTY;
      case "onFailure":
        return r.severity ? [text(t(r.severity === "block" ? "sev_block" : "sev_warn"))] : EMPTY;
      case "status":
        return [text(statusWord(t, r.status))];
      case "owner":
        return r.owner_name?.trim() ? [text(r.owner_name)] : EMPTY;
      case "appliesTo": {
        const sc = state.requirements.scope(r.id);
        const attributes = [...sc.attributes].filter((id) => !sc.feeding?.has(id));
        return attributes.length ? lines(attributes.map((id) => [mono(attributeLabel(state, id))])) : [text([...sc.entities].map((id) => state.entity.get(id)?.name ?? "?").join(", "))];
      }
      case "description":
        return r.description_text?.trim() ? [text(r.description_text)] : EMPTY;
    }
  };
  return longTextTable(
    o.columns.map((k) => ({ key: k, label: t(QUALITY_LABEL[k]), long: k === "description" || k === "rule" })),
    rs.map((r) => o.columns.map((k) => value(k, r))),
    o.longTexts,
    t("noDq"),
  );
}
