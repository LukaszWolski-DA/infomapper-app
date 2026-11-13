// The neutral content tree of a generated document (slice 25, R2-3c, step 1's F8): headings, paragraphs, tables and
// cells, built by pure functions from the model and laid out by a renderer (HTML now; Markdown, Word or a server-side
// PDF later are other renderers of the same tree). In InfoMapper's domain, not InfoDocumenter's: a module's section
// (InfoCube's Dimensional model) builds these nodes too, and modules never import each other (AD-33).
//
// Plain data only: no HTML, no styles. A renderer decides how a node looks.

/** A piece of text with how it is meant: code-like (a name, a type), quieter, a warning, a status pill. */
export interface DocRun {
  readonly text: string;
  readonly mono?: boolean;
  readonly muted?: boolean;
  readonly warn?: boolean;
  readonly strong?: boolean;
  /** Drawn as a pill (a mapping's status in a document that shows drafts). */
  readonly pill?: boolean;
  /** A mapping's status drawn as a pill: its tone (the prototype's `.dst.draft`, `.review`, `.approved`). */
  readonly status?: "draft" | "review" | "approved";
  /** Starts a new line within its cell or paragraph (a second mapping of one attribute, a line of a Text body). */
  readonly lineBreak?: boolean;
  /** Slice 26 (F6): a small tag, the text in a box: a classification's code, "PII", "BK", a requirement's key. */
  readonly chip?: "plain" | "pii" | "bk" | "key";
  /** Slice 26: a mark in a circle (the conventions' "ƒ" and "!"), the text inside. */
  readonly circle?: "map" | "warn";
  /** Slice 26: a concept's colour as a small square before the text. */
  readonly swatch?: string;
  /** Slice 26: a coverage bar, the share covered; the text after it ("3/4"). */
  readonly bar?: { readonly ok: number; readonly total: number };
  /** Slice 26: a relationship end drawn in a notation (the conventions' table); no text. */
  readonly end?: { readonly notation: "ie" | "uml"; readonly min: 0 | 1; readonly many: boolean };
  /** Slice 26: a mapping line in its status's dash (the conventions' table); no text. */
  readonly line?: "draft" | "review" | "approved";
  /** Slice 26: the row's fed and not-fed dots (the conventions' table); no text. */
  readonly dots?: boolean;
  /** Slice 26: a passed check's tick, in the colour of a passed check. */
  readonly ok?: boolean;
  /** Slice 26: a moved text's reference ("→ note 2", "→ 1, 2"). */
  readonly ref?: boolean;
}

/** A cell, a paragraph or a meta part: its runs in order. */
export type DocRuns = readonly DocRun[];

export interface DocColumn {
  readonly key: string;
  readonly label: string;
  /** A share of the table's width, in per cent; the renderer shares what is left among the columns without one. */
  readonly width?: number;
  /** Slice 26: the header written upwards (the bus matrix's dimensions). */
  readonly vertical?: boolean;
}

export interface DocRow {
  readonly cells: readonly DocRuns[];
  /** Full-width text under the row (a definition, a rule, a note: one layout for long texts, D9). */
  readonly below?: readonly DocRuns[];
}

export type DocNode =
  /** Level 1 is a section's heading, numbered and listed in the contents; levels 2 to 4 are within a section. */
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3 | 4; readonly text: string; readonly anchor?: string; /** Slice 26: a concept's colour before it. */ readonly swatch?: string }
  | { readonly kind: "paragraph"; readonly runs: DocRuns }
  /** One line of parts joined by the renderer (" · "), e.g. a stereotype and a coverage line above a table. */
  | { readonly kind: "meta"; readonly parts: readonly DocRuns[] }
  | {
      readonly kind: "table";
      readonly columns: readonly DocColumn[];
      readonly rows: readonly DocRow[];
      /**
       * Slice 26: how it is drawn: `narrow` (as wide as its content), `fixed` (the columns' widths kept, long words
       * wrap), `checks` (readiness: the result right-aligned), `legend` (the conventions: a mark, then words), `matrix`
       * (the bus matrix: centred cells).
       */
      readonly style?: "narrow" | "fixed" | "checks" | "legend" | "matrix";
    }
  /**
   * Slice 26 (F6): a list. `ordered`: numbered (the notes after a table, "Definitions in full"); `columns`: in two
   * columns (readiness's items); `label` per item: a word in front of it ("Rule:").
   */
  | { readonly kind: "list"; readonly ordered?: boolean; readonly columns?: 2; /** No markers (the overview's concepts). */ readonly plain?: boolean; readonly items: readonly { readonly label?: DocRuns; readonly runs: DocRuns; readonly muted?: boolean }[] }
  /**
   * Slice 26: one block per item, its title, its properties on one line, its text, then labelled lines: the dictionary's
   * "One block per attribute" (`attribute`) and the requirements' "One block per requirement" (`requirement`).
   */
  | {
      readonly kind: "cards";
      readonly variant: "attribute" | "requirement";
      readonly cards: readonly { readonly title: DocRuns; readonly props: readonly DocRuns[]; readonly text?: DocRuns; readonly lines: readonly { readonly label: string; readonly runs: DocRuns }[] }[];
    }
  /**
   * Slice 26: a run of nodes kept together: an entity's block (its heading, meta, table), which moves whole to the next
   * page when `keep` (step 4: up to the style's rows); `mark` gives its heading the concept's colour on the left.
   */
  | { readonly kind: "group"; readonly nodes: readonly DocNode[]; readonly keep?: boolean; readonly mark?: string }
  /** A line about the document itself: a section skipped while its module is off, or unknown. */
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "pageBreak" };

export type DocNodeKind = DocNode["kind"];
