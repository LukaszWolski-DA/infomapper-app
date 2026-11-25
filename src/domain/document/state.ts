// The model state a generated document is built from (slice 25, step 3): one snapshot of the workspace (F1) and the
// app's own indexes over it, built once per document. Every section's builder reads this and nothing else: never a
// store, never a copy of a rule. In InfoMapper's domain beside the section contract, since a module's section reads it
// too and modules never import each other (AD-33).
//
// `feeds` are what a module's mappings feed (InfoCube's dimensional mappings, `AttributeFeeds`): the composition root
// derives them from the snapshot's module rows and passes them in, as every later caller of the requirement index does
// (CLAUDE.md, slice 15d).

import type { BaselineChange } from "../baseline/compare";
import type { Uuid } from "../ids";
import { NO_FIGURE_CONTRIBUTIONS, type FigureContributions } from "./figure";
import type { CheckInput, ModuleChecks } from "../model/checks";
import { classificationIndex, type ClassificationIndex } from "../model/classifications";
import { countsAsMapped, derivationIndex, type DerivationIndex } from "../model/derivations";
import { buildRequirementIndex, type RequirementIndex } from "../model/requirement-index";
import type { AttributeFeeds, ModelLookup } from "../model/requirements";
import { stereotypeIndex, type StereotypeIndex } from "../model/stereotypes";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { Concept, DocLanguage, Entity, ModuleTable, SourceSystem, SourceTable } from "../types";

/**
 * What the modules give a document (slice 26, Q6, F12): a module's words for an entity's role and its model checks. The
 * composition root joins them (`documentStateFor`); InfoDocumenter reads them without knowing the module (AD-33).
 */
export interface DocumentContributions {
  /** Whether the dimensional level is drawn: the module that has it is on in the workspace. */
  readonly dimensionalOn: boolean;
  /** A dimensional entity's role in the document's language ("Transaction fact, factless"); null: no module's. */
  readonly entityRole: (entityId: Uuid, language: DocLanguage) => string | null;
  /** The modules' model checks (D-75) for an input, as the project home reads them. */
  readonly moduleChecks: (input: CheckInput) => ModuleChecks[];
  /** Slice 27: what the modules draw on a figure: roles, rows' feeds, their lines. */
  readonly figures: FigureContributions;
}

/** No module: no dimensional level, no role, no checks, nothing on figures. */
export const NO_CONTRIBUTIONS: DocumentContributions = { dimensionalOn: false, entityRole: () => null, moduleChecks: () => [], figures: NO_FIGURE_CONTRIBUTIONS };

/** A baseline as a document names it (slice 36): its id, name and the time it was taken. */
export interface BaselineRef {
  readonly id: Uuid;
  readonly name: string;
  readonly created_at: string;
}

/**
 * Where a document's model comes from (slice 36, D-88 as proposed): the live model, a baseline's content, or a baseline
 * that no longer exists (B3.5: nothing is built, the document says so).
 */
export type DocumentSource = { readonly kind: "live" } | ({ readonly kind: "baseline" } & BaselineRef) | { readonly kind: "gone" };

/**
 * A "Changes since …" section's comparison (slice 36, Q3), made on the server: the older and the newer state (`newer`
 * null: the live model), the changes in the document's scope; or why there is none: no older baseline (`none`), the
 * chosen baseline deleted (`gone`), or the answer still on its way (`pending`).
 */
export type SectionChanges =
  | { readonly kind: "list"; readonly older: BaselineRef; readonly newer: BaselineRef | null; readonly changes: readonly BaselineChange[] }
  | { readonly kind: "none" }
  | { readonly kind: "gone" }
  | { readonly kind: "pending" };

/** Slice 36: the comparisons a document's changes sections read, by their "Compared with" (null: the previous baseline). */
export type ChangesLookup = (against: Uuid | null) => SectionChanges;

const PENDING: ChangesLookup = () => ({ kind: "pending" });

export interface DocumentState<T extends ModuleTable = ModuleTable> {
  readonly snapshot: WorkspaceSnapshot<T>;
  /** The live model looked up once (the requirement index's own lookup, built with the feeds). */
  readonly lookup: ModelLookup;
  readonly requirements: RequirementIndex;
  readonly derivations: DerivationIndex;
  readonly stereotypes: StereotypeIndex;
  readonly feeds: AttributeFeeds;
  readonly entity: ReadonlyMap<Uuid, Entity>;
  readonly concept: ReadonlyMap<Uuid, Concept>;
  readonly table: ReadonlyMap<Uuid, SourceTable>;
  readonly system: ReadonlyMap<Uuid, SourceSystem>;
  /**
   * Whether a logical attribute counts as mapped by the app's rule (slice 18, F1): any live mapping, any status, or
   * through its calculation (`countsAsMapped`), as the cards, the Overview and the project home count it (Q-L3).
   */
  readonly mapped: (attributeId: Uuid) => boolean;
  /** Slice 26: the workspace's classifications on tables and columns (D-78), built once. */
  readonly classifications: ClassificationIndex;
  /** Slice 26: the modules' contributions. */
  readonly modules: DocumentContributions;
  /** Slice 36: where the snapshot comes from (the live model unless the caller says otherwise). */
  readonly source: DocumentSource;
  /** Slice 36: the changes sections' comparisons; without them every one is still on its way. */
  readonly changes: ChangesLookup;
}

/** The state of one document's model, from a snapshot and the modules' feeds. Pure. */
export function documentStateOf<T extends ModuleTable>(
  snapshot: WorkspaceSnapshot<T>,
  feeds: AttributeFeeds = {},
  modules: DocumentContributions = NO_CONTRIBUTIONS,
  /** Slice 36: the source and the comparisons (`documentStateFor`'s caller passes them). */
  extra: { readonly source?: DocumentSource; readonly changes?: ChangesLookup } = {},
): DocumentState<T> {
  const model = snapshot.model;
  const requirements = buildRequirementIndex(snapshot.requirements, snapshot.requirementLinks, model, feeds);
  const lookup = requirements.lookup;
  const derivations = derivationIndex(model.attributes, model.attributeInputs);
  const direct = (attributeId: Uuid) => (lookup.mappingsOfAttribute.get(attributeId) ?? []).length > 0;
  return {
    snapshot,
    lookup,
    requirements,
    derivations,
    stereotypes: stereotypeIndex(model.stereotypes),
    feeds,
    entity: new Map(model.entities.map((e) => [e.id, e])),
    concept: new Map(model.concepts.map((c) => [c.id, c])),
    table: new Map(model.sourceTables.map((t) => [t.id, t])),
    system: new Map(model.sourceSystems.map((s) => [s.id, s])),
    mapped: countsAsMapped(derivations, direct),
    classifications: classificationIndex(model.classifications, model.classificationLinks),
    modules,
    source: extra.source ?? { kind: "live" },
    changes: extra.changes ?? PENDING,
  };
}
