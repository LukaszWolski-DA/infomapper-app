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
  /**
   * Slice 34 (F2): the row's long texts by the table's `long` columns, aligned with them (empty runs where none), beside
   * `below`, which drops a single long column's label. Only on a table with `long`; the HTML never reads it.
   */
  readonly longCells?: readonly DocRuns[];
  /**
   * Slice 34 (Łukasz's acceptance of step 3): the row's cells with every value in its own column, aligned with `cells`,
   * where `cells` puts a placeholder over another column (Source-to-target's unmapped attribute: "Not mapped" in "Target
   * type" in the PDF). Only on such a row; the HTML never reads it.
   */
  readonly alignedCells?: readonly DocRuns[];
}

export type DocNode =
  /** Level 1 is a section's heading, numbered and listed in the contents; levels 2 to 4 are within a section. */
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3 | 4; readonly text: string; readonly anchor?: string; /** Slice 26: a concept's colour before it. */ readonly swatch?: string; /** Slice 26: its number ("2.3") when the document numbers its sections. */ readonly number?: string }
  /** Slice 27: `placeholder`, a section's hint while it has nothing to show ("Add a figure in the panel on the right."), drawn in a dashed box. */
  | { readonly kind: "paragraph"; readonly runs: DocRuns; readonly placeholder?: true }
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
      /**
       * Slice 34 (F2): the long-text columns whose texts the rows carry under them (`below`), in order; a renderer that
       * keeps a row whole (Markdown) draws them as columns at the table's end from each row's `longCells`.
       */
      readonly long?: readonly DocColumn[];
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
  /**
   * Slice 27 (F3): a figure, drawn from the model as an SVG (`figure.ts`) and placed as an image, whole or in parts
   * (`page.ts`). Numbered in document order by `buildDocument` (F6); its first part carries the anchor `fg-{number}`.
   */
  | { readonly kind: "figure"; readonly figure: DocFigure }
  /**
   * Slice 27, step 3: the legend under Diagrams' figures (the prototype's `legend`): its title and one line per mark,
   * each a drawn sample (`LegendMark`) and its words; `mono` for black and white.
   */
  | { readonly kind: "legend"; readonly title: string; readonly mono: boolean; readonly items: readonly { readonly mark: LegendMark; readonly text: string }[] }
  /** A line about the document itself: a section skipped while its module is off, or unknown. */
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "pageBreak" };

export type DocNodeKind = DocNode["kind"];

/** A legend's sample: a relationship in crow's foot or UML, mappings by status, the ƒ rule, a dimensional mapping, a source key, the row's dots. */
export type LegendMark = "rel-ie" | "rel-uml" | "map-ok" | "map-review" | "map-draft" | "map-warn" | "map-rule" | "cube" | "src" | "dots";

/** One part of a figure: its region of the SVG (canvas pixels) and its size on the page (millimetres). */
export interface DocFigurePart {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly wmm: number;
  readonly hmm: number;
}

/** A figure in the content tree (slice 27, F3): plain data; the SVG text is escaped by its builder. */
export interface DocFigure {
  /** Unique in the document: `{section id}:{figure id}` (one image source per figure). */
  readonly key: string;
  /** The figure's id in its section's options (the editor's line under it). */
  readonly entryId: string;
  /** "Figure {number}"; 0 until `buildDocument` numbers the document's figures. */
  readonly number: number;
  /** "Figure" in the document's language, and the caption after the number. */
  readonly word: string;
  readonly caption: string;
  readonly svg: string;
  /** IBM Plex's faces the SVG uses (`FigureFace`): the page embeds those files (Q2). */
  readonly faces: readonly string[];
  /** Turned −90° on a portrait page ("Landscape, turned"). */
  readonly rot: boolean;
  readonly parts: readonly DocFigurePart[];
  /** Each part's "part {i} of {n}" in the document's language; empty for a whole figure. */
  readonly partTexts: readonly string[];
  /** The editor's line (the prototype's `sumFig`), in the app's language. */
  readonly summary: string;
  /** Slice 27, step 3: a placed figure's name before its line in the editor ("Fact Sales"); a stored figure has none. */
  readonly label?: string;
  /** Slice 34 (F1): what the figure drew, as plain data from the same pass as its SVG; the HTML never reads it. */
  readonly content?: FigureContent;
}

/**
 * What one figure drew (slice 34, F1), for a renderer that writes it as text (Markdown's Mermaid block and its list):
 * the cards with their shown names and rows, the frames, and the lines of the kinds drawn. Ids are the cards' (canvas
 * item) ids; names are as the figure shows them (names or aliases).
 */
export interface FigureContent {
  readonly cards: readonly FigureContentCard[];
  readonly frames: readonly FigureContentFrame[];
  /** Relationships between entity cards (a bundle into a collapsed frame as its single relationships). */
  readonly relationships: readonly FigureContentRelationship[];
  /** Foreign keys between source table cards. */
  readonly sourceKeys: readonly { readonly from: string; readonly to: string; readonly columns: readonly { readonly from: string; readonly to: string }[] }[];
  readonly mappings: readonly FigureContentMapping[];
  /** A module's lines between entity rows (InfoCube's dimensional mappings). */
  readonly moduleLines: readonly { readonly inputs: readonly string[]; readonly target: string; readonly status: "draft" | "review" | "approved" | null; readonly chip?: string }[];
  /** Requirement cards and the elements their trace lines reach on the figure. */
  readonly requirements: readonly { readonly key: string; readonly name: string; readonly traces: readonly string[] }[];
}

export interface FigureContentCard {
  readonly id: string;
  readonly kind: "ent" | "src";
  /** The header's name (name or alias). */
  readonly name: string;
  /** A fact's or a dimension's role text (`Fact · Transaction`); absent for a logical entity and a table. */
  readonly role?: string;
  /** Its rows as the figure shows them; none when the card is collapsed or a member of a collapsed frame. */
  readonly rows: readonly FigureContentRow[];
  /** A member of a collapsed frame: drawn inside the frame's block, not as a card. */
  readonly inBlock: boolean;
}

export interface FigureContentRow {
  readonly name: string;
  /** The shown type (`String(100)`, `varchar(20)`). */
  readonly type: string;
  readonly pk: boolean;
  readonly fk: boolean;
  readonly pii: boolean;
  readonly bk: boolean;
  readonly calc: boolean;
}

export interface FigureContentFrame {
  readonly name: string;
  readonly kind: "concept" | "source_system" | "free";
  readonly collapsed: boolean;
  /** Its cards' ids, in the figure's order. */
  readonly members: readonly string[];
}

export interface FigureContentRelationship {
  readonly from: string;
  readonly to: string;
  readonly fromMin: 0 | 1;
  readonly fromMany: boolean;
  readonly toMin: 0 | 1;
  readonly toMany: boolean;
  /** The pill's text: the roles, else the verb phrase; null without. */
  readonly label: string | null;
}

export interface FigureContentMapping {
  /** `table.column` per input on the figure, in rule order. */
  readonly inputs: readonly string[];
  /** `Entity.attribute`. */
  readonly target: string;
  /** Null when the figure does not show statuses. */
  readonly status: "draft" | "review" | "approved" | null;
  readonly transform: boolean;
  readonly rule: string | null;
  readonly warn: boolean;
}
