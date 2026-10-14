// Plain text stored as the pair the data model asks for (AD-17): `*_html` holds the text as escaped paragraphs,
// `*_text` the text itself. Notes and mapping notes are plain text (AD-30); definitions and descriptions are rich text
// since slice 4a (`rich-text.ts`), and those written before it were stored this way.

export interface RichTextPair {
  html: string | null;
  text: string | null;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Blank lines separate paragraphs, single line breaks become `<br>`. Empty text gives nulls. */
export function plainTextPair(value: string | null | undefined): RichTextPair {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return { html: null, text: null };
  const html = text
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
  return { html, text };
}

/**
 * The HTML a panel shows for a stored pair (slice 4a): the `*_html` the server wrote (sanitized, or escaped paragraphs
 * from plain text), or, when a row has only its plain text, that text as escaped paragraphs, never as HTML.
 */
export const shownHtml = (html: string | null | undefined, text: string | null | undefined): string | null =>
  html?.trim() ? html : plainTextPair(text).html;
