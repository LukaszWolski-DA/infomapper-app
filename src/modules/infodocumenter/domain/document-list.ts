// The Documentation tab's list (slice 25, D10; slice 36): the documents by name, and documents of the same name newest
// first (B5.1 a, Łukasz, 25 November 2026: by `created_at`, then by id); each row's meta line, the prototype's
// "{audience} · {source} · {n} sections · {language} · A4 · by {author}", then "created {time}", which the page writes
// in the browser's time zone (`createdText`). Pure.

import type { Uuid } from "@/domain/ids";

/** Slice 36: the source in the meta line, the prototype's: "live model", "from baseline “{name}”" or "from baseline (missing)". */
export const sourceText = (baseline: string | null | undefined): string => (baseline == null ? "live model" : baseline ? `from baseline “${baseline}”` : "from baseline (missing)");

/** A row as the meta line reads it. */
export interface MetaLineRow {
  readonly audience: string | null;
  readonly sections: number;
  readonly shared: boolean;
  readonly author: string;
  /** Null for the live model; "" when its baseline is gone. */
  readonly baseline?: string | null;
}

/** "{audience} · {source} · {n} sections · {language} · A4 · by {author}" ("by …" for shared ones only). */
export const metaLine = (d: MetaLineRow, languageName: string): string =>
  [d.audience, sourceText(d.baseline), `${d.sections} section${d.sections === 1 ? "" : "s"}`, languageName, "A4", d.shared ? `by ${d.author}` : null].filter(Boolean).join(" · ");

/** B5.1 (a): the line's end, "created {yyyy-mm-dd hh:mm}" (the time in the browser's time zone, written by the page). */
export const createdText = (minute: string): string => `created ${minute}`;

/** The list's order: by name in any letter case; the same name newest first, by the time made, then by id. */
export function documentOrder(a: { name: string; created_at: string; id: Uuid }, b: { name: string; created_at: string; id: Uuid }): number {
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
}
