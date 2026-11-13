// A document's style (slice 26, F9) and the recipe's upgrade (F10, F11): the shape every recipe has since slice 26, its
// defaults, its schema for a save, and the pure upgrade of a row stored before (`TableRules.upgrade`, run by the local
// adapter on load; no change to the local file's format, AD-33).

import { z } from "zod";
import { DOC_LANGUAGES } from "@/domain/types";
import type { DocumentFrameFields, DocumentSection, DocumentStyle } from "./types";

/** The most sections a document holds (D10). */
export const SECTIONS_MAX = 50;
/** The longest header or footer field (as the other short texts). */
export const FRAME_FIELD_MAX = 200;

export const TEMPLATES = ["standard", "formal", "compact"] as const;
export const ACCENTS = ["indigo", "teal", "graphite", "burgundy"] as const;
export const KEEP_ROWS = [0, 10, 15, 25, 40] as const;

/** The prototype's `newDef` without figures, logos and baselines; the language is the workspace's (null). */
export const STYLE_DEFAULTS: DocumentStyle = {
  language: null,
  template: "standard",
  accent: "indigo",
  colours: "colour",
  paper: "A4",
  orientation: "portrait",
  notation: "ie",
  keepRows: 15,
  cover: true,
  contents: true,
  numbers: true,
  banded: false,
  runningHeader: true,
  watermark: true,
  header: { left: null, right: null },
  footer: { left: null, right: null },
};

export const defaultStyle = (patch: Partial<DocumentStyle> = {}): DocumentStyle => ({ ...structuredClone(STYLE_DEFAULTS), ...patch });

const frameText = z
  .string()
  .trim()
  .max(FRAME_FIELD_MAX, "This text is too long.")
  .nullable()
  .transform((v) => (v ? v : null));
const frame = z.object({ left: frameText, right: frameText }).partial().strict();

/** A save's style patch: any of its fields; a header's or a footer's part alone. */
export const stylePatch = z
  .object({
    language: z.enum(DOC_LANGUAGES).nullable(),
    template: z.enum(TEMPLATES),
    accent: z.enum(ACCENTS),
    colours: z.enum(["colour", "mono"]),
    paper: z.enum(["A4", "A3"]),
    orientation: z.enum(["portrait", "landscape"]),
    notation: z.enum(["ie", "uml"]),
    keepRows: z.number().refine((n): n is DocumentStyle["keepRows"] => (KEEP_ROWS as readonly number[]).includes(n), "Choose one of the row counts."),
    cover: z.boolean(),
    contents: z.boolean(),
    numbers: z.boolean(),
    banded: z.boolean(),
    runningHeader: z.boolean(),
    watermark: z.boolean(),
    header: frame,
    footer: frame,
  })
  .partial()
  .strict();
export type StylePatch = z.input<typeof stylePatch>;

/** The style with a patch applied: a header's or a footer's part keeps the other. */
export function patchedStyle(style: DocumentStyle, patch: z.output<typeof stylePatch>): DocumentStyle {
  const { header, footer, ...rest } = patch;
  const merge = (a: DocumentFrameFields, b: Partial<DocumentFrameFields> | undefined): DocumentFrameFields => ({ ...a, ...b });
  return { ...style, ...(rest as Partial<DocumentStyle>), header: merge(style.header, header), footer: merge(style.footer, footer) };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A section entry in slice 26's shape: `heading` and `newPage` added, Text's `options.heading` moved to the entry. */
export function upgradeSection(s: Record<string, unknown>): DocumentSection {
  const options = isObject(s.options) ? { ...s.options } : {};
  let heading = (s.heading as string | null | undefined) ?? null;
  if (s.type === "text" && "heading" in options) {
    heading ??= (options.heading as string | null) ?? null;
    delete options.heading;
  }
  return { id: s.id as string, type: s.type as string, on: s.on !== false, heading, newPage: (s.newPage as boolean | undefined) ?? true, options };
}

const sectionUpToDate = (s: unknown) => isObject(s) && "heading" in s && "newPage" in s && !(s.type === "text" && isObject(s.options) && "heading" in s.options);

/**
 * A `document_definition` row in slice 26's shape, or null when it is so already (pure, idempotent): `style` with the
 * defaults and the language null (the workspace's, Q8), a missing style field its default, the entries upgraded.
 */
export function upgradeDocument(row: Record<string, unknown>): Record<string, unknown> | null {
  const style = row.style;
  const styleOk = isObject(style) && Object.keys(STYLE_DEFAULTS).every((k) => k in style);
  const sections = Array.isArray(row.sections) ? row.sections : [];
  if (styleOk && sections.every(sectionUpToDate)) return null;
  const given = isObject(style) ? style : {};
  return {
    ...row,
    style: {
      ...defaultStyle(),
      ...given,
      header: { ...STYLE_DEFAULTS.header, ...(isObject(given.header) ? given.header : {}) },
      footer: { ...STYLE_DEFAULTS.footer, ...(isObject(given.footer) ? given.footer : {}) },
    },
    sections: sections.map((s) => (sectionUpToDate(s) ? s : upgradeSection(isObject(s) ? s : {}))),
  };
}
