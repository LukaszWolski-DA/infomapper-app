// "Changes since …" (slice 36, B4.1 to B4.4, D-88 as proposed): what was added, changed and removed between a baseline
// and the document's own model state, by slice 35's comparison (`compareBaselines`, references by id) and its words in
// the document's language (`COMPARE_WORDS`). Which two states are compared is `changesPlan`'s; the comparison itself and
// the scope run on the server (step 1's Q3: the older content never reaches the browser), and the section draws the
// answer it finds in the state (`DocumentState.changes`). Pure.

import { CHANGE_KINDS, olderFirst, type BaselineChange } from "@/domain/baseline/compare";
import { COMPARE_WORDS, whatChanged } from "@/domain/baseline/words";
import { mono, muted, text } from "@/domain/document/blocks";
import type { DocNode } from "@/domain/document/content";
import type { SectionBuildInput, SectionScope } from "@/domain/document/sections";
import type { BaselineRef, DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { label } from "./labels";
import { touchesScope } from "./parts";
import type { DocumentDefinition, DocumentScope } from "./types";

/** A changes section's "Compared with" as stored (null: the previous baseline). */
export const againstOf = (options: Record<string, unknown>): Uuid | null => (typeof options.against === "string" ? options.against : null);

/** The key a section's comparison is answered under (null: the previous baseline). */
export const changesKey = (against: Uuid | null): string => against ?? "";

/**
 * What a document's comparisons depend on (step 1's Q3): its source, its scope and its changes sections' "Compared with".
 * The editor asks the server again only when this key changes, which only a saved change does (never a keystroke).
 */
export function changesRequestKey(definition: Pick<DocumentDefinition, "source_kind" | "baseline_id" | "scope" | "sections">): string {
  const against = [...new Set(definition.sections.filter((s) => s.type === "changes" && s.on).map((s) => changesKey(againstOf(s.options))))].sort();
  if (!against.length) return "";
  const { projects, concepts, logical, dimensional } = definition.scope;
  return JSON.stringify([definition.source_kind, definition.baseline_id, [...projects].sort(), [...concepts].sort(), logical, dimensional, against]);
}

/** Which two states a changes section compares (Q3), or why it compares none. */
export type ChangesPlan =
  | { readonly kind: "compare"; readonly older: BaselineRef; readonly newer: BaselineRef | null }
  | { readonly kind: "none" }
  | { readonly kind: "gone" };

/**
 * The plan for one section: the document's own state (`source`: a baseline, or null for the live model) and its "Compared
 * with" (`against`, null: the previous baseline, B4.1), over the workspace's live baselines newest first (the list's own
 * order, `newestBaselineFirst`: the time taken, then the id). The previous baseline is the next one after the source in
 * that order, for a live document the newest; a chosen one that is not live is `gone`. The older state is always the
 * start (B4.2): a chosen baseline newer than the source is the newer side.
 */
export function changesPlan(source: BaselineRef | null, against: Uuid | null, baselines: readonly BaselineRef[]): ChangesPlan {
  if (against) {
    const chosen = baselines.find((b) => b.id === against);
    if (!chosen) return { kind: "gone" };
    const [older, newer] = olderFirst<BaselineRef>(chosen, source);
    return { kind: "compare", older: older!, newer };
  }
  const at = source ? baselines.findIndex((b) => b.id === source.id) : -1;
  const previous = source ? (at < 0 ? undefined : baselines[at + 1]) : baselines[0];
  return previous ? { kind: "compare", older: previous, newer: source } : { kind: "none" };
}

/** One side of a comparison as the scope reads it: its state, its scope as `sectionScopeOf` resolves it, its snapshot. */
export interface ChangesSide {
  readonly state: DocumentState<ModuleTable>;
  readonly scope: SectionScope;
}

/** Whether the document's scope narrows anything on this side (a live project or concept of it chosen). */
const narrowed = (scope: DocumentScope, snapshot: WorkspaceSnapshot<ModuleTable>) =>
  snapshot.projects.some((p) => scope.projects.includes(p.id)) || snapshot.model.concepts.some((c) => scope.concepts.includes(c.id));

/**
 * The changes in the document's scope (B4.3, step 1's Q4): an item counts when it is in scope on either side, so an
 * entity removed from a scoped project still shows. An entity by its id and level, an attribute and a mapping (by its
 * target) by their entity, a relationship by either end, a source table by the scope's tables, a column by its table, a
 * requirement by the Requirements section's rule (`touchesScope`), or every requirement where nothing narrows the scope.
 * "Mappings included" is not applied (Łukasz's answer 3).
 */
export function changesInScope(changes: readonly BaselineChange[], scope: DocumentScope, sides: readonly [ChangesSide, ChangesSide]): BaselineChange[] {
  const read = sides.map((side) => {
    const m = side.state.snapshot.model;
    return {
      side,
      whole: !narrowed(scope, side.state.snapshot),
      entityOfAttribute: new Map(m.attributes.map((a) => [a.id, a.entity_id])),
      attributeOfMapping: new Map(m.mappings.map((x) => [x.id, x.attribute_id])),
      ends: new Map(m.relationships.map((r) => [r.id, [r.from_entity_id, r.to_entity_id] as const])),
      tableOfColumn: new Map(m.sourceColumns.map((c) => [c.id, c.source_table_id])),
      requirement: new Set(side.state.snapshot.requirements.map((r) => r.id)),
    };
  });
  type Read = (typeof read)[number];
  const entityIn = (r: Read, id: Uuid | undefined): boolean => {
    if (!id || !r.side.scope.entityIds.has(id)) return false;
    const e = r.side.state.entity.get(id);
    if (!e) return false;
    return e.model_level === "dimensional" ? r.side.scope.dimensional && r.side.state.modules.dimensionalOn : r.side.scope.logical;
  };
  const tableIn = (r: Read, id: Uuid | undefined) => !!id && r.side.scope.tableIds.has(id);
  const inScope = (c: BaselineChange, r: Read): boolean => {
    switch (c.kind) {
      case "entity":
        return entityIn(r, c.id);
      case "attribute":
        return entityIn(r, r.entityOfAttribute.get(c.id));
      case "mapping":
        return entityIn(r, r.entityOfAttribute.get(r.attributeOfMapping.get(c.id) ?? ""));
      case "relationship": {
        const ends = r.ends.get(c.id);
        return !!ends && (entityIn(r, ends[0]) || entityIn(r, ends[1]));
      }
      case "source_table":
        return tableIn(r, c.id);
      case "source_column":
        return tableIn(r, r.tableOfColumn.get(c.id));
      case "requirement":
        return r.requirement.has(c.id) && (r.whole || touchesScope(r.side.state, r.side.scope, { id: c.id }, true));
    }
  };
  return changes.filter((c) => read.some((r) => inScope(c, r)));
}

/** The section's heading (Łukasz's answer 4): it names the older state, or "…" while there is none. */
export function changesHeading({ state, options, language }: Pick<SectionBuildInput, "state" | "options" | "language">): string {
  const r = state.changes(againstOf(options));
  return label(language, "t_changes", { n: r.kind === "list" ? `“${r.older.name}”` : "…" });
}

/** The section's body: one table per group (Added, Changed, Removed, empty ones left out), or the line saying why none. */
export function buildChanges({ state, options, language }: SectionBuildInput): DocNode[] {
  const t = (key: Parameters<typeof label>[1]) => label(language, key);
  const r = state.changes(againstOf(options));
  const line = (runs: ReturnType<typeof text>[]): DocNode[] => [{ kind: "paragraph", runs }];
  if (r.kind === "pending") return line([muted("…")]);
  if (r.kind === "none") return line([text(t("noBase"))]);
  if (r.kind === "gone") return line([text(t("blGone"))]);
  if (!r.changes.length) return line([text(t("noChanges"))]);
  return changesTables(r.changes, language);
}

/** The groups as headings and tables (Kind, Item, What changed), the prototype's `diffWhat` per row. */
export function changesTables(changes: readonly BaselineChange[], language: DocLanguage): DocNode[] {
  const words = COMPARE_WORDS[language];
  const out: DocNode[] = [];
  for (const group of CHANGE_KINDS) {
    const list = changes.filter((c) => c.change === group);
    if (!list.length) continue;
    out.push(
      { kind: "heading", level: 2, text: `${words.groups[group]} (${list.length})` },
      {
        kind: "table",
        columns: [
          { key: "kind", label: label(language, "kind") },
          { key: "item", label: label(language, "item") },
          { key: "what", label: label(language, "what") },
        ],
        rows: list.map((c) => ({ cells: [[text(words.kinds[c.kind])], [mono(c.label)], c.fields.length ? [text(whatChanged(c, words))] : []] })),
      },
    );
  }
  return out;
}
