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
}

/** A cell, a paragraph or a meta part: its runs in order. */
export type DocRuns = readonly DocRun[];

export interface DocColumn {
  readonly key: string;
  readonly label: string;
  /** A share of the table's width, in per cent; the renderer shares what is left among the columns without one. */
  readonly width?: number;
}

export interface DocRow {
  readonly cells: readonly DocRuns[];
  /** Full-width text under the row (a definition, a rule, a note: one layout for long texts, D9). */
  readonly below?: readonly DocRuns[];
}

export type DocNode =
  /** Level 1 is a section's heading, numbered and listed in the contents; levels 2 to 4 are within a section. */
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3 | 4; readonly text: string; readonly anchor?: string }
  | { readonly kind: "paragraph"; readonly runs: DocRuns }
  /** One line of parts joined by the renderer (" · "), e.g. a stereotype and a coverage line above a table. */
  | { readonly kind: "meta"; readonly parts: readonly DocRuns[] }
  | { readonly kind: "table"; readonly columns: readonly DocColumn[]; readonly rows: readonly DocRow[] }
  /** A line about the document itself: a section skipped while its module is off, or unknown. */
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "pageBreak" };

export type DocNodeKind = DocNode["kind"];
