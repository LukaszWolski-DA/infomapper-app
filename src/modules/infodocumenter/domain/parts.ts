// The pieces InfoDocumenter's section builders share (slice 25, step 3; moved here in slice 26 when the sections grew):
// the document's words, a column's or an attribute's label, a requirement's keys, the entities in scope by level and
// concept, and the rules every section counts by (fed or mapped, a requirement in scope). Pure; every rule is the app's.

import { EMPTY, mono, muted, warn } from "@/domain/document/blocks";
import type { DocNode, DocRun, DocRuns } from "@/domain/document/content";
import type { SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import { countsAsMapped } from "@/domain/model/derivations";
import type { LabelTargetKind } from "@/domain/model/labels";
import type { Attribute, DocLanguage, Entity, Mapping, Requirement, SourceColumn } from "@/domain/types";
import { label, type LabelKey } from "./labels";

export type L = (key: LabelKey, values?: Readonly<Record<string, string | number>>) => string;
export const wordsOf = (language: DocLanguage): L => (key, values) => label(language, key, values);
export const NONE = (t: L): DocNode => ({ kind: "paragraph", runs: [muted(t("none"))] });

/** The keys of an element's own requirements, joined (the prototype's `reqKeys`: its direct links). */
export function requirementKeys(state: DocumentState, kind: LabelTargetKind, id: Uuid): DocRuns {
  const keys = state.requirements.of({ kind, id }).direct.map((r) => r.key);
  return keys.length ? [mono(keys.join(", "))] : EMPTY;
}

/** "Order.order_id": a source column with its table (the prototype's `colLabel`), marked when it left the source. */
export function columnRuns(state: DocumentState, c: SourceColumn, t: L): DocRuns {
  const table = state.table.get(c.source_table_id);
  const runs: DocRun[] = [mono(`${table?.name ?? "?"}.${c.name}`)];
  runs.push(...leftRuns(c, t));
  return runs;
}

/** A column that left the source: "missing from the source" or "retired" after its name. */
export function leftRuns(c: Pick<SourceColumn, "missing_since" | "retired_since">, t: L): DocRuns {
  if (c.missing_since !== null) return [warn(` ${t("colMissing")}`)];
  if (c.retired_since !== null) return [muted(` ${t("colRetired")}`)];
  return EMPTY;
}

/** A mapping's source columns as "Table.column" (the prototype's `colLabel`), joined. */
export const mappingColumns = (state: DocumentState, m: Pick<Mapping, "id">): string =>
  (state.lookup.inputsOf.get(m.id) ?? []).map((c) => `${state.table.get(c.source_table_id)?.name ?? "?"}.${c.name}`).join(" + ");

/** "Entity.attribute" (the prototype's `attrLabel`). */
export const attributeLabel = (state: DocumentState, attributeId: Uuid): string => {
  const a = state.lookup.attribute.get(attributeId);
  return a ? `${state.entity.get(a.entity_id)?.name ?? "?"}.${a.name}` : "?";
};

/** A feed's status: as the module gives it, else approved or in review. */
export const feedStatus = (f: { approved: boolean; status?: Mapping["status"] }): Mapping["status"] => f.status ?? (f.approved ? "approved" : "review");

export const statusRun = (status: Mapping["status"], t: L): DocRun => ({ text: t(status), pill: true, status });

export const attributesOf = (state: DocumentState, entityId: Uuid): readonly Attribute[] => state.lookup.attributesOf.get(entityId) ?? [];

/**
 * Whether an entity of the scope is drawn by its level (the prototype's `scopeOf`): a logical one while the logical
 * level is in scope; a dimensional one while that level is in scope and its module is on (slice 26, PRD item 8).
 */
export function drawnLevel(state: DocumentState, scope: SectionScope, e: Pick<Entity, "model_level">): boolean {
  return e.model_level === "logical" ? scope.logical : scope.dimensional && state.modules.dimensionalOn;
}

/** The scope's entities of both levels as drawn, in the model's order. */
export const scopeEntities = (state: DocumentState, scope: SectionScope): Entity[] =>
  state.snapshot.model.entities.filter((e) => scope.entityIds.has(e.id) && drawnLevel(state, scope, e));

/** The scope's entities by concept, in the concepts' order (the Model tab's), each list in the model's order. */
export function byConcept(state: DocumentState, entities: readonly Entity[]): Map<Uuid, Entity[]> {
  const out = new Map<Uuid, Entity[]>();
  for (const c of state.snapshot.model.concepts) out.set(c.id, []);
  for (const e of entities) out.get(e.concept_id)?.push(e);
  for (const [id, list] of out) if (!list.length) out.delete(id);
  return out;
}

/** The logical entities of the scope by concept (slice 25's dictionary; the source-to-target's targets). */
export const logicalEntities = (state: DocumentState, scope: SectionScope): Map<Uuid, Entity[]> =>
  byConcept(
    state,
    scope.logical ? state.snapshot.model.entities.filter((e) => e.model_level === "logical" && scope.entityIds.has(e.id)) : [],
  );

/**
 * Whether an attribute counts as mapped or fed by the app's rule (slice 18, F1; CLAUDE.md "a later count of mapped or fed
 * rows"): any mapping or feed, any status, or through its calculation.
 */
export function fedRule(state: DocumentState): (attributeId: Uuid) => boolean {
  const direct = (id: Uuid) => (state.lookup.mappingsOfAttribute.get(id) ?? []).length > 0 || state.lookup.feedsOf(id).length > 0;
  return countsAsMapped(state.derivations, direct);
}

/** Whether a requirement touches the scope (the prototype's "Only requirements that touch the document's scope"). */
export function touchesScope(state: DocumentState, scope: SectionScope, r: Pick<Requirement, "id">, tables = false): boolean {
  const sc = state.requirements.scope(r.id);
  for (const e of sc.entities) if (scope.entityIds.has(e)) return true;
  if (tables) for (const t of sc.tables) if (scope.tableIds.has(t)) return true;
  return false;
}

/** A requirement's kind, status and priority in the document's language (slice 26, new words). */
export const kindWord = (t: L, kind: Requirement["kind"]): string => t(`k_${kind}` as LabelKey);
export const statusWord = (t: L, status: Requirement["status"]): string => t(`st_${status}` as LabelKey);
export const priorityWord = (t: L, priority: Requirement["priority"]): string => t(`pr_${priority}` as LabelKey);

/** The plain words of a text (the prototype's `words`): a definition's length and its weak test count them. */
export const wordsIn = (value: string | null | undefined): string[] => (value ?? "").trim().split(/\s+/).filter(Boolean);
