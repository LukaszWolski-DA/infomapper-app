// What a module gives a card (slice 15a, AD-33): a dimensional entity's role and a row's feed. Types only, in the domain
// since slice 27 (F1): the cards are drawn by the canvas and by the documents' figures; `src/ui/modules.ts` re-exports them.

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
  /**
   * Slice 15c (P17, F19, C10): the Overview's word after "{n} of {m}" ("fed") and its tooltip ("Attributes fed from the
   * logical model"); the entity panel's attribute list's title ("Attributes and their logical feed") and the text of a
   * row without a feed ("no feed"). The counts are `ModuleView.rowFeeds`'.
   */
  feed?: { word: string; title: string; list: string; none: string };
}

/**
 * A row's state when a module counts it (slice 15c, C12): how many of the module's lines reach it (its dot, the
 * coverage bar, the Mapped / Not mapped filter) and the dot's tooltip ("from Customer.segment_code", "Not fed from the
 * logical model").
 */
export interface RowFeed {
  n: number;
  title: string;
  /** The entity panel's list (slice 15c, C10): what feeds the row ("Customer.segment_code", "ƒ 3 attributes"); empty without. */
  list: string;
}

