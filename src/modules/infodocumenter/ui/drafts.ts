// The editor's text drafts in the preview (slice 26, F1): while a text field is typed in, the preview draws the stored
// recipe with the field's text in place of its stored value, before the field saves. Pure, so the rule is tested
// without a page.
//
// A draft is keyed by the field ("name", "audience", "cover.title", …, "sec:{id}:heading", "sec:{id}:body") and holds
// the stored value it was typed over: it applies while that value is still the stored one, so a change by someone else
// meanwhile, or the draft's own save, is what shows.

import type { DocumentDefinition } from "../domain/types";

export type DraftRecipe = Pick<DocumentDefinition, "name" | "audience" | "cover" | "sections">;
export type TextDraft = { text: string; base: string };

/** The stored value of the field a draft key names; "" for a section that is gone. */
export function storedOf(doc: DraftRecipe, key: string): string {
  if (key === "name") return doc.name;
  if (key === "audience") return doc.audience ?? "";
  if (key.startsWith("cover.")) return doc.cover[key.slice(6) as keyof DraftRecipe["cover"]] ?? "";
  const [, id, field] = key.split(":");
  const s = doc.sections.find((x) => x.id === id);
  if (!s) return "";
  return field === "heading" ? (s.heading ?? "") : String(s.options[field!] ?? "");
}

/** The recipe the preview draws: the stored one with each draft typed over the value it still has. */
export function withDrafts<R extends DraftRecipe>(doc: R, drafts: ReadonlyMap<string, TextDraft>): R {
  let out = doc;
  for (const [key, d] of drafts) {
    if (storedOf(doc, key) !== d.base || d.text === d.base) continue;
    const text = d.text;
    const nullable = text.trim() ? text : null;
    if (key === "name") out = { ...out, name: text.trim() || out.name };
    else if (key === "audience") out = { ...out, audience: nullable };
    else if (key.startsWith("cover.")) out = { ...out, cover: { ...out.cover, [key.slice(6)]: nullable } };
    else {
      const [, id, field] = key.split(":");
      out = {
        ...out,
        sections: out.sections.map((s) => (s.id !== id ? s : field === "heading" ? { ...s, heading: nullable } : { ...s, options: { ...s.options, [field!]: text } })),
      };
    }
  }
  return out;
}

/** A draft for a key: its base is kept while the stored value has not moved, else the stored value now. */
export function nextDraft(doc: DraftRecipe, known: TextDraft | undefined, key: string, text: string): TextDraft {
  const stored = storedOf(doc, key);
  return { text, base: known && stored === known.base ? known.base : stored };
}
