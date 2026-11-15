// InfoDocumenter's figures (slice 27): the words every figure of a document uses in its language (D11), the kit a
// section draws its figures with (`SectionBuildInput.figures`), the Figure section (one or more figures wherever the
// section stands) and, since step 3, Diagrams (its figures, the canvases' names before them, the legend), the figures of
// Model overview and the concept frames of the Data dictionary. The drawing and the page are InfoMapper's
// (`src/domain/document/figure.ts`, `figure-node.ts`, `page.ts`), shared with a module's figures.

import type { DocNode, LegendMark } from "@/domain/document/content";
import { ENGLISH_FIGURE_WORDS, type FigureInput, type FigureWords } from "@/domain/document/figure";
import { newFigure } from "@/domain/document/figure-entry";
import { sectionFigures, type FigureNodeWords } from "@/domain/document/figure-node";
import type { FigurePage, SectionBuildInput, SectionFigures, SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import { byTabOrder } from "@/domain/model/workspace-model";
import type { Canvas, DocLanguage, ModuleTable, Project, ProjectCanvas } from "@/domain/types";
import { label } from "./labels";
import { diagramsOptions, figureOptions } from "./sections";

/** The preview's line in a Figure section without a figure in the document (the prototype's, the editor's language). */
export const FIGURE_PLACEHOLDER = "Add a figure in the panel on the right.";
/** Diagrams' line without a figure in the document. */
export const DIAGRAMS_PLACEHOLDER = "Tick or add a figure in the panel on the right.";

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
export function figureInputOf(
  input: { state: DocumentState<ModuleTable>; scope: SectionScope; language: DocLanguage; notation: "ie" | "uml"; page: FigurePage },
  words: FigureWords,
): FigureInput {
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

/** The kit a section draws figures with (`SectionBuildInput.figures`), in the document's words. */
export function documentFigures(input: { state: DocumentState<ModuleTable>; scope: SectionScope; language: DocLanguage; notation: "ie" | "uml"; page: FigurePage }): SectionFigures {
  // made when a section first draws a figure: a document without figures reads nothing for them
  let kit: SectionFigures | null = null;
  const get = () => {
    if (!kit) {
      const words = figureWordsOf(input.language);
      kit = sectionFigures(figureInputOf(input, words.drawing), input.page, words.node);
    }
    return kit;
  };
  return { list: (entries, o) => (entries.some((f) => f.on) ? get().list(entries, o) : []), placed: (f) => get().placed(f) };
}

/** The Figure section: its figures, or the hint while none is in the document. */
export function buildFigureSection(input: SectionBuildInput): DocNode[] {
  const o = figureOptions.parse(input.options);
  const nodes = input.figures.list(o.figures);
  return nodes.length ? nodes : [{ kind: "paragraph", runs: [{ text: FIGURE_PLACEHOLDER, muted: true }], placeholder: true }];
}

/**
 * Diagrams (the prototype's `diagrams`): its figures that are on, each canvas's name as a subsection before its first
 * figure, in its own notation when it has one; the legend under them while it is on, or the hint while no figure is in
 * the document.
 */
export function buildDiagramsSection(input: SectionBuildInput): DocNode[] {
  const o = diagramsOptions.parse(input.options);
  if (!o.figures.some((f) => f.on)) return [{ kind: "paragraph", runs: [{ text: DIAGRAMS_PLACEHOLDER, muted: true }], placeholder: true }];
  const notation = o.notation === "doc" ? input.notation : o.notation;
  const nodes = input.figures.list(o.figures, { notation, canvasHeadings: true, ...(o.warnPt ? { warnPt: o.warnPt } : {}) });
  if (o.legend) nodes.push(legendNode(input.language, notation, input.page.mono, input.state.modules.dimensionalOn));
  return nodes;
}

/**
 * The legend under Diagrams' figures (the prototype's `legend` with every line kind and the status marks): the
 * relationship in the section's notation, the mappings by status and the ƒ rule, the dimensional mapping while that level
 * is drawn, the source key, the rows' dots.
 */
export function legendNode(language: DocLanguage, notation: "ie" | "uml", mono: boolean, dimensional: boolean): DocNode {
  const t = (key: Parameters<typeof label>[1]) => label(language, key);
  const items: { mark: LegendMark; text: string }[] = [
    notation === "uml" ? { mark: "rel-uml", text: t("lg_relUml") } : { mark: "rel-ie", text: t("lg_rel") },
    { mark: "map-ok", text: t("lg_ok") },
    { mark: "map-review", text: t("lg_rev") },
    { mark: "map-draft", text: t("lg_dr") },
    { mark: "map-warn", text: t("lg_warn") },
    { mark: "map-rule", text: t("lg_f") },
    ...(dimensional ? [{ mark: "cube" as const, text: t("lg_cube") }] : []),
    { mark: "src", text: t("lg_src") },
    { mark: "dots", text: t("lg_dot") },
  ];
  return { kind: "legend", title: t("legend"), mono, items };
}

/**
 * The scope's canvases for Diagrams' figures (D9): the chosen projects', or every live project's, each project's
 * canvases in its tab order, a canvas shared by two projects once; the projects in the order they were made. Slice 27,
 * step 4 (Łukasz): with no project chosen ("the whole model"), then the canvases in no project, in the order they were
 * made (a canvas in no project has no tab).
 */
export function diagramCanvases(
  projects: readonly Pick<Project, "id" | "created_at">[],
  links: readonly ProjectCanvas[],
  chosen: readonly Uuid[],
  canvases: readonly Pick<Canvas, "id" | "created_at">[] = [],
): Uuid[] {
  const picked = new Set(chosen.filter((id) => projects.some((p) => p.id === id)));
  const out: Uuid[] = [];
  for (const p of [...projects].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (picked.size && !picked.has(p.id)) continue;
    for (const l of links.filter((x) => x.project_id === p.id).sort(byTabOrder)) if (!out.includes(l.canvas_id)) out.push(l.canvas_id);
  }
  if (!picked.size) for (const c of [...canvases].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (!out.includes(c.id)) out.push(c.id);
  return out;
}

/** Diagrams' figures when the section is made (D9): one whole canvas each, with the preset's look. */
export function diagramFigures(canvasIds: readonly Uuid[], newId: () => Uuid, look?: Parameters<typeof newFigure>[3]) {
  return canvasIds.map((c) => newFigure(newId(), c, null, look));
}

/** A concept's frame as a figure (the Dictionary's "Figure of the concept's frame at its start"): the first canvas of the scope's with one. */
export function conceptFrameFigure(input: SectionBuildInput, conceptId: Uuid): DocNode[] {
  const { snapshot } = input.state;
  const order = diagramCanvases(snapshot.projects, snapshot.projectCanvases, [], snapshot.canvases).filter((id) => input.scope.canvasIds.has(id));
  for (const canvasId of order) {
    const frame = snapshot.frames.filter((f) => f.canvas_id === canvasId && f.kind === "concept" && f.concept_id === conceptId).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    if (frame) return input.figures.list([{ ...newFigure(`cf:${conceptId}`, canvasId, frame.id) }]);
  }
  return [];
}
