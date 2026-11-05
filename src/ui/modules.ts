// What a module hands InfoMapper's pages (slice 15a, AD-33, acceptance doc Q3): plain data and server actions, built
// by the composition root (`src/compose/`) on the server. InfoMapper's layers draw it without knowing the module: a
// card's role in place of its stereotype (E7), a tab of the left panel (E6), the entities it creates from the tab and
// the canvas's toolbox (E18), the rows of a delete preview (E13). Without a module everything here is empty.

import type { Uuid } from "@/domain/ids";

/**
 * A dimensional entity's role (D-67), where a logical entity's stereotype stands: its text, its tooltip, the card's
 * classes (the module's CSS draws the mark and a fact's edge) and the mark's class in the header.
 */
export interface EntityRole {
  text: string;
  title: string;
  /** Classes on the card (`dimn fact`). */
  card: string;
  /** Classes on the header's first span (`cube`): the mark before the text. */
  mark: string;
  /**
   * What the coverage bar counts on this card, when the module counts its rows (slice 15c, P17): "fed from the logical
   * model" ("{n} of {m} attributes fed from the logical model"); absent: InfoMapper's "mapped".
   */
  coverage?: string;
}

/**
 * A row's state when a module counts it (slice 15c, C12): how many of the module's lines reach it (its dot, the
 * coverage bar, the Mapped / Not mapped filter) and the dot's tooltip ("from Customer.segment_code", "Not fed from the
 * logical model").
 */
export interface RowFeed {
  n: number;
  title: string;
}

/** One group of a module's tab: its entities by concept, each with its own right-side text (`grain set`, `SCD 1`). */
export interface ModuleTabSection {
  key: string;
  title: string;
  /** Classes of the group head's mark. */
  mark: string;
  /** "No facts yet." */
  empty: string;
  /** What to add to `empty` for those who may create (" Use New fact above."). */
  emptyCreate: string;
  /** The entities in this group, in the model's order, with the item's right side. */
  entities: { id: Uuid; meta: string }[];
}

/** A tab of the left panel (B-1): its name, its tooltip, its groups and the creates shown at its top. */
export interface ModuleTab {
  id: string;
  name: string;
  title: string;
  sections: ModuleTabSection[];
  /** The creates' keys shown at the tab's top, in order (`fact`, `dimension`). */
  creates: string[];
}

/** What a create action takes: InfoMapper's `createEntityAction` input. */
export interface EntityCreateInput {
  conceptId: string;
  placement: { canvasId: string; x: number; y: number; height?: number; frames?: { frameId: string; expectedVersion: number }[] };
}

/** The answer of a create action, shaped as `ActionResult`. */
export type EntityCreateResult =
  | { ok: true; value: { entityId: string; canvasItemId: string | null; name: string } }
  | { ok: false; code?: string; message: string };

/** An entity a module creates (B-2): the tab's button, the toolbox's item, and the server action. */
export interface EntityCreate {
  key: string;
  /** The tab's button: "New fact". */
  button: string;
  /** The toolbox's item: "New fact here". */
  here: string;
  testId: string;
  action: (workspaceId: string, input: EntityCreateInput) => Promise<EntityCreateResult>;
}

/**
 * What an attribute's delete takes along in a module (slice 15b, R4), for its second click (`armedDeleteText`): `also`
 * what is deleted with it ("1 measure"), `then` what it changes elsewhere ("the link to Dim Date as Ship date is
 * deleted; the relationship stays").
 */
export interface AttributeDelete {
  also: string[];
  then: string[];
}

/** Everything the modules give a canvas page; empty without a module (or with it off). */
export interface ModuleView {
  /** Each dimensional entity's role, by entity id. */
  roles: Record<Uuid, EntityRole>;
  tabs: ModuleTab[];
  creates: EntityCreate[];
  /** Classes on an attribute's row on cards, by attribute id (slice 15b: a measure's `meas add`; R5, no element). */
  rowMarks: Record<Uuid, string>;
  /** An attribute's delete with module rows asks the second click (slice 15b, R4), by attribute id. */
  attributeDeletes: Record<Uuid, AttributeDelete>;
  /** The rows a module counts on cards (slice 15c: every dimensional attribute), by attribute id. */
  rowFeeds: Record<Uuid, RowFeed>;
  /**
   * Each module's own rows for its panel sections (`src/compose/panels.ts`), by module: plain rows without
   * `created_*` and `updated_*` (O8). InfoMapper never reads them.
   */
  data: Readonly<Record<string, unknown>>;
}

export const NO_MODULES: ModuleView = { roles: {}, tabs: [], creates: [], rowMarks: {}, attributeDeletes: {}, rowFeeds: {}, data: {} };

/** A row of a delete preview that a module adds (X-1): what, and what happens to it. */
export type DependentRow = [what: string, happens: string];
