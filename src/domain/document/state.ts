// The model state a generated document is built from (slice 25, step 3): one snapshot of the workspace (F1) and the
// app's own indexes over it, built once per document. Every section's builder reads this and nothing else: never a
// store, never a copy of a rule. In InfoMapper's domain beside the section contract, since a module's section reads it
// too and modules never import each other (AD-33).
//
// `feeds` are what a module's mappings feed (InfoCube's dimensional mappings, `AttributeFeeds`): the composition root
// derives them from the snapshot's module rows and passes them in, as every later caller of the requirement index does
// (CLAUDE.md, slice 15d).

import type { Uuid } from "../ids";
import { countsAsMapped, derivationIndex, type DerivationIndex } from "../model/derivations";
import { buildRequirementIndex, type RequirementIndex } from "../model/requirement-index";
import type { AttributeFeeds, ModelLookup } from "../model/requirements";
import { stereotypeIndex, type StereotypeIndex } from "../model/stereotypes";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { Concept, Entity, ModuleTable, SourceSystem, SourceTable } from "../types";

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
}

/** The state of one document's model, from a snapshot and the modules' feeds. Pure. */
export function documentStateOf<T extends ModuleTable>(snapshot: WorkspaceSnapshot<T>, feeds: AttributeFeeds = {}): DocumentState<T> {
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
  };
}
