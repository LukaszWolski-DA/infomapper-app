// Definitions and notes are plain text until the rich-text editor arrives (AD-30). They are still stored as the
// pair the data model asks for (AD-17): `*_html` holds the text as escaped paragraphs, `*_text` the text itself.

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
