// InfoDocumenter's figures (slice 27): the Figure section (the prototype's `figure` type: one or more figures wherever
// the section stands) and the words every figure of a document uses in its language (D11). The drawing and the page
// are InfoMapper's (`src/domain/document/figure.ts`, `figure-node.ts`, `page.ts`), shared with a module's figures.

import type { DocNode } from "@/domain/document/content";
import { ENGLISH_FIGURE_WORDS, type FigureInput, type FigureWords } from "@/domain/document/figure";
import { figureNodes, type FigureNodeWords } from "@/domain/document/figure-node";
import type { SectionBuildInput } from "@/domain/document/sections";
import type { DocLanguage } from "@/domain/types";
import { label } from "./labels";
import { figureOptions, type FigureEntry } from "./sections";

/** The preview's line in a Figure section without a figure in the document (the prototype's, the editor's language). */
export const FIGURE_PLACEHOLDER = "Add a figure in the panel on the right.";

/** The words on a figure (D11) and around it, in a document's language. */
export function figureWordsOf(language: DocLanguage): { drawing: FigureWords; node: FigureNodeWords } {
  const t = (key: Parameters<typeof label>[1], values?: Readonly<Record<string, string | number>>) => label(language, key, values);
  return {
    drawing: {
      ...ENGLISH_FIGURE_WORDS,
      in: t("figIn"),
      collapsed: t("figCollapsed"),
      kinds: { concept: t("figConcept"), source_system: t("figSource"), free: t("figFree") },
      more: (n) => t("figMore", { n }),
      relationships: (n) => (n === 1 ? t("figRel1") : t("figRelN", { n })),
    },
    node: { figure: t("fig"), part: (i, n) => t("part", { i, n }), empty: t("figEmpty"), noCanvas: t("figNoCanvas"), noFrame: t("figNoFrame") },
  };
}

/** What a section's figures are drawn from: the document's model state, scope, language, notation and page. */
export function figureInputOf(input: SectionBuildInput, words: FigureWords): FigureInput {
  const { state } = input;
  return {
    snapshot: state.snapshot,
    requirements: state.requirements,
    scope: input.scope,
    dimensionalOn: state.modules.dimensionalOn,
    modules: state.modules.figures,
    language: input.language,
    words,
    notation: input.notation,
    mono: input.page.mono,
  };
}

/** A section's figures that are on, as nodes, one after another (the prototype's `figList`). */
export function figureListNodes(input: SectionBuildInput, entries: readonly FigureEntry[]): DocNode[] {
  const words = figureWordsOf(input.language);
  const figureInput = figureInputOf(input, words.drawing);
  return entries
    .filter((f) => f.on)
    .flatMap(
      (f) =>
        figureNodes(figureInput, input.page, words.node, {
          key: f.id,
          entryId: f.id,
          spec: { canvasId: f.canvasId, frameId: f.frameId, view: f.view, rows: f.rows, lines: f.lines, status: f.status },
          size: f.size,
          orientation: f.orientation,
          caption: f.caption,
        }).nodes,
    );
}

/** The Figure section: its figures, or the hint while none is in the document. */
export function buildFigureSection(input: SectionBuildInput): DocNode[] {
  const o = figureOptions.parse(input.options);
  const nodes = figureListNodes(input, o.figures);
  return nodes.length ? nodes : [{ kind: "paragraph", runs: [{ text: FIGURE_PLACEHOLDER, muted: true }], placeholder: true }];
}
