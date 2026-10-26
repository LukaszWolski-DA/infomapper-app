// The import wizard's state and the texts it derives (slice 7a, PRD items 20–27; prototype `W`, `canGo`, `footNote`,
// `targetName`, and the review's `impact`). Pure functions over the page's data; the dialog is `import-wizard.tsx`.

import { applyPlan } from "@/domain/import/apply";
import type { DdlTranslation } from "@/domain/import/ddl";
import { materialize } from "@/domain/import/materialize";
import type { ImportModel } from "@/domain/import/model";
import { coverageDelta, scopeModelOf, type CoverageDelta } from "@/domain/source-changes/coverage";
import type { ImportPlan, ImportTarget, MissingScope, PlanColumn } from "@/domain/import/plan";
import type { StandardRead } from "@/domain/import/standard";
import type { Requirement, RequirementLink, SourceChange, WorkspaceModel } from "@/domain/types";
import type { Vendor } from "./catalog-queries";

/** What the wizard reads from the page: the same objects the inspector gets, plus each system's last import. */
export interface ImportData {
  model: WorkspaceModel;
  requirements: readonly Requirement[];
  requirementLinks: readonly RequirementLink[];
  /** The canvases each table is on (by table id), and the canvases' names. */
  canvasesOf: Readonly<Record<string, readonly string[]>>;
  canvasNames: Readonly<Record<string, string>>;
  /** The workspace's changes to resolve (slice 7b): the plan settles open ones, and P8 compares them. */
  changes: readonly SourceChange[];
  /** When each system was last imported (ISO time), by system id. */
  lastImports: Readonly<Record<string, string>>;
}

export type Channel = "file" | "query" | "ddl";
export type Step = 1 | 2 | 3;
export type ReviewFilter = "all" | "new" | "changed" | "rename" | "missing" | "rel";

export interface WizardState {
  step: Step;
  mode: "existing" | "new";
  systemId: string | null;
  newName: string;
  channel: Channel;
  vendor: Vendor;
  /** The text read, and what it is called (the file's name, “pasted query result”, the script's name). */
  text: string;
  sourceLabel: string;
  read: StandardRead | null;
  ddl: { text: string; name: string; database: string; schema: string; translation: DdlTranslation | null };
  scope: ReadonlySet<string>;
  compare: MissingScope;
  renames: ReadonlyMap<string, string>;
  filter: ReviewFilter;
  /** P8: the server refused because the system changed; the review shows this until the next import. */
  stale: string | null;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const lower = (s: string) => s.toLowerCase();

export const systemTaken = (model: WorkspaceModel, name: string) => model.sourceSystems.some((s) => lower(s.name) === lower(name.trim()));

/** The title's target: the system, or the new name (prototype `targetName`). */
export function targetName(s: WizardState, model: WorkspaceModel): string {
  if (s.mode === "new") return s.newName.trim() || "the new system";
  return model.sourceSystems.find((x) => x.id === s.systemId)?.name ?? "";
}

export function targetOf(s: WizardState): ImportTarget | null {
  if (s.mode === "existing") return s.systemId ? { systemId: s.systemId } : null;
  return s.newName.trim() ? { newName: s.newName.trim() } : null;
}

const readOk = (s: WizardState) => !!s.read && !s.read.errors.length && s.read.tables.length > 0;

/** Whether a step can be shown (prototype `canGo`). */
export function canGo(step: Step, s: WizardState, model: WorkspaceModel, plan: ImportPlan | null): boolean {
  if (step === 1) return true;
  const target = s.mode === "existing" ? !!s.systemId : !!s.newName.trim() && !systemTaken(model, s.newName);
  if (!target || !readOk(s)) return false;
  if (step === 2) return true;
  const leftOut = new Set(plan?.leftOut.map((l) => l.key) ?? []);
  return [...s.scope].some((k) => !leftOut.has(k));
}

/** The footer's note (prototype `footNote`). */
export function footNote(s: WizardState, model: WorkspaceModel): string {
  if (s.step === 1) {
    if (s.mode === "new" && s.newName.trim() && systemTaken(model, s.newName)) {
      return `A system named ${s.newName.trim()} already exists. Pick it under “An existing system”.`;
    }
    if (!s.read) return s.channel === "ddl" ? "Paste or drop a script, then read it." : "Choose a file, or paste a query result.";
    if (s.read.errors.length) return "Fix the file to continue.";
    return `Read ${plural(s.read.tables.length, "table")} and ${plural(s.read.columnCount, "column")} from ${s.read.fileName}.`;
  }
  if (s.step === 2) return `${plural(s.scope.size, "table")} of ${s.read?.tables.length ?? 0} selected.`;
  return "Nothing is written until you import. The import is one undo step.";
}

const STATUS_WORD = { draft: "draft", review: "in review", approved: "approved" } as const;

/** One line per mapping a column feeds, for the review's impact (PRD item 25). */
export interface ImpactLine {
  label: string;
  status: string;
  /** “; the mapping stays, on a column that is gone”, “; goes back to review: …”… in order. */
  notes: { text: string; warn?: boolean; code?: string }[];
  requirementKeys: string[];
}

/**
 * Requirements whose coverage the import changes (slice 7b, item 9, Q3): the requirement index on the model before and
 * on the model as the plan leaves it, over the whole plan (not only what the review renders). Ids of new rows do not
 * matter for coverage, so the review makes its own.
 */
export function planCoverage(model: ImportModel, plan: ImportPlan, data: Pick<ImportData, "requirements" | "requirementLinks">): CoverageDelta[] {
  if (!data.requirements.some((r) => r.deleted_at === null)) return [];
  const now = new Date().toISOString();
  let n = 0;
  const applied = applyPlan(model, plan, { actorId: "review", now, newId: () => `review-${++n}` });
  if (!applied.ok) return [];
  const after = materialize(model, applied.changes, { workspaceId: "review", actorId: "review", now });
  return coverageDelta(data.requirements, data.requirementLinks, scopeModelOf(model), scopeModelOf(after));
}

/** Lookups the review's impact needs, built once per model. */
export function impactIndex(data: Pick<ImportData, "model" | "requirements" | "requirementLinks">) {
  const attribute = new Map(data.model.attributes.map((a) => [a.id, a]));
  const entity = new Map(data.model.entities.map((e) => [e.id, e]));
  const mapping = new Map(data.model.mappings.map((m) => [m.id, m]));
  const keyOf = new Map(data.requirements.filter((r) => r.deleted_at === null).map((r) => [r.id, r.key]));
  // an attribute's requirements: linked to it, or to a mapping that fills it (its panel's Requirements section)
  const keysOfAttribute = new Map<string, Set<string>>();
  const addKey = (attributeId: string, requirementId: string) => {
    const key = keyOf.get(requirementId);
    if (key) (keysOfAttribute.get(attributeId) ?? keysOfAttribute.set(attributeId, new Set()).get(attributeId)!).add(key);
  };
  for (const k of data.requirementLinks) {
    if (k.deleted_at !== null) continue;
    if (k.attribute_id) addKey(k.attribute_id, k.requirement_id);
    else if (k.mapping_id) {
      const m = mapping.get(k.mapping_id);
      if (m) addKey(m.attribute_id, k.requirement_id);
    }
  }
  return { attribute, entity, mapping, keysOfAttribute };
}

export function impactOf(c: PlanColumn, plan: ImportPlan, ix: ReturnType<typeof impactIndex>): ImpactLine[] {
  const columnId = c.existing?.id;
  if (!columnId) return [];
  return c.mappingIds.flatMap((id) => {
    const m = ix.mapping.get(id);
    const a = m ? ix.attribute.get(m.attribute_id) : undefined;
    if (!m || !a) return [];
    const impact = plan.mappings.find((x) => x.mappingId === id);
    const notes: ImpactLine["notes"] = [];
    if (c.status === "missing") notes.push({ text: "the mapping stays, on a column that is gone" });
    else if (c.status === "rename") notes.push({ text: "the mapping stays" });
    const conflict = impact?.conflicts.find((x) => x.columnId === columnId);
    if (impact?.sendsBack) notes.push({ text: `goes back to review: ${impact.reasons.join("; ")}`, warn: true });
    else if (conflict) notes.push({ text: `type conflict: ${conflict.short}`, warn: true });
    else if (impact?.fitsAgain.includes(columnId)) notes.push({ text: "fits again, the mapping can be approved" });
    if (impact?.ruleAfter && !impact.sendsBack) notes.push({ text: "its rule now reads ", code: impact.ruleAfter });
    return [
      {
        label: `${ix.entity.get(a.entity_id)?.name ?? "?"}.${a.name}`,
        status: STATUS_WORD[m.status],
        notes,
        requirementKeys: [...(ix.keysOfAttribute.get(a.id) ?? [])].sort(),
      },
    ];
  });
}

/** The review's filter counts (prototype `stepReview`'s `n`). */
export function reviewCounts(plan: ImportPlan) {
  const all = plan.tables.flatMap((t) => t.columns);
  const n = {
    tablesNew: plan.tables.filter((t) => t.status === "new").length,
    new: all.filter((c) => c.status === "new").length,
    changed: all.filter((c) => c.status === "changed" || c.status === "back").length + plan.tables.filter((t) => t.meta.length).length,
    rename: plan.renames.length,
    missing: all.filter((c) => c.status === "missing").length,
    rel: plan.relationships.filter((r) => r.status !== "unchanged" && r.status !== "still_missing").length,
  };
  return { ...n, all: n.new + n.changed + n.rename + n.missing + n.rel };
}

/** Whether a column's row shows under a filter (prototype `showCol`). */
export function shownUnder(filter: ReviewFilter, c: PlanColumn): boolean {
  if (c.status === "unchanged" || c.status === "still_missing") return false;
  switch (filter) {
    case "all":
      return true;
    case "new":
      return c.status === "new" && !c.renameKey;
    case "changed":
      return c.status === "changed" || c.status === "back";
    case "rename":
      return !!c.renameKey || c.status === "rename";
    case "missing":
      return c.status === "missing";
    case "rel":
      return false;
  }
}

/** `2026-10-22` from an ISO time. */
export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
