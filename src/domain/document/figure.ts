// A figure of a canvas or of one of its frames (slice 27, C2, F1, F3): an SVG drawn by a pure function from the canvas's
// stored rows with the canvas's own rules (`src/domain/canvas`: the cards, their rows and heights, the lines and their
// routes, the frames and their blocks, the requirement cards and their trace lines), in canvas pixels. Never a
// screenshot: a document draws it again each time it is built. The prototype's `diagramFigures`, `drawGroup`,
// `rowsSVG`, `entSVG`, `srcSVG`, `blockSVG` and `reqSVG`, with these differences (Łukasz's answers, 14 November 2026):
// - no working layer (C4): no notes (D2), no labels' marks, no selection or highlights; requirement cards and their
//   trace lines are drawn "As on the canvas" (D2), as SVG rather than HTML;
// - what is outside the document's scope is left out (D3);
// - "As on the canvas" follows the canvas's hidden relationship kinds, not its layer switch (D6); "Dimensional" lines only
//   while the dimensional level is drawn (D7);
// - the words on a card ("in {concept}", a role, a block's kind) are the document's language (D11), given by the caller.
//
// Fonts: the SVG asks for 'IBM Plex Sans' and 'IBM Plex Mono' by name and lists the faces it uses (`faces`); the page
// that shows it embeds IBM Plex's unmodified files for those faces (Q2), since an SVG shown through `<img>` sees none of
// the page's fonts. Every model text is escaped here.

import { applyNames, buildCards, shownText, visibleRows, type CardData, type CardRow } from "@/domain/canvas/card-data";
import { buildFrames, frameShape, memberCounts, type FrameData } from "@/domain/canvas/frame-data";
import { arrowHead, BODY_PAD, cardHeight, cardWidth, HEAD_H, ieMarker, multText, relGeom, ROW_H, umlMarker, type Placed, type Pt, type Rect } from "@/domain/canvas/geometry";
import { buildLines, pillText, type CanvasLines, type ModuleLineData } from "@/domain/canvas/line-data";
import { blockRowY, bundleGeom, bundleLines, mapGeom, moduleGeom, traceGeom, type TraceCardPlace } from "@/domain/canvas/line-geometry";
import type { EntityRole, RowFeed } from "@/domain/canvas/module-marks";
import { buildRequirementCards, REQ_CARD, requirementCardHeight, type RequirementCardData } from "@/domain/canvas/requirement-card-data";
import { monoWidth, sansWidth } from "@/domain/canvas/text-fit";
import { buildTraces } from "@/domain/canvas/trace-data";
import type { Uuid } from "@/domain/ids";
import { isHidden } from "@/domain/model/canvas-look";
import { BLOCK } from "@/domain/model/frames";
import { liveMembership } from "@/domain/model/live";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { CanvasItem, DocLanguage, MappingStatus, ModuleTable, WorkspaceModel } from "@/domain/types";
import { statusShown } from "./blocks";
import type { SectionScope } from "./sections";

/** "Rows as on canvas", "Keys only", "All rows", "Headers only" (the prototype's `rows`: canvas, keys, all, none). */
export const FIGURE_ROWS = ["canvas", "keys", "all", "none"] as const;
export type FigureRows = (typeof FIGURE_ROWS)[number];
/** "As on the canvas" or "Adjusted" (the prototype's `fid`: canvas, custom). */
export const FIGURE_VIEWS = ["canvas", "custom"] as const;
export type FigureView = (typeof FIGURE_VIEWS)[number];

/** The line kinds "Adjusted" draws: relationships, mappings, source FKs, dimensional mappings. */
export interface FigureLines {
  readonly rel: boolean;
  readonly map: boolean;
  readonly src: boolean;
  readonly cube: boolean;
}

/** What one figure draws (the stored figure's drawing part; its size, orientation and caption are the page's). */
export interface FigureSpec {
  readonly canvasId: Uuid;
  /** One frame of the canvas, or null for the whole canvas. */
  readonly frameId: Uuid | null;
  readonly view: FigureView;
  /** "Adjusted" only. */
  readonly rows: FigureRows;
  readonly lines: FigureLines;
  readonly status: boolean;
}

/** A face of IBM Plex the SVG uses: its family and weight. */
export type FigureFace = "sans-400" | "sans-500" | "sans-600" | "mono-400" | "mono-500";
export const FIGURE_FACES: readonly FigureFace[] = ["sans-400", "sans-500", "sans-600", "mono-400", "mono-500"];

/**
 * What a module gives a figure (slice 27, AD-33): its entities' roles in the document's language (where a stereotype
 * stands), its rows' feeds (a dimensional row's dot) and its lines between the cards drawn (InfoCube's dimensional
 * mappings, of the shown statuses). The composition root joins them; none without a module.
 */
export interface FigureContributions {
  readonly roles: (language: DocLanguage) => Readonly<Record<Uuid, EntityRole>>;
  readonly rowFeeds: (shown: (status: MappingStatus) => boolean) => Readonly<Record<Uuid, RowFeed>>;
  readonly lines: (model: WorkspaceModel, cards: readonly CardData[], shown: (status: MappingStatus) => boolean) => ModuleLineData[];
}

export const NO_FIGURE_CONTRIBUTIONS: FigureContributions = { roles: () => ({}), rowFeeds: () => ({}), lines: () => [] };

/** The words on a figure in the document's language (D11): the caller's labels. */
export interface FigureWords {
  /** "in" before a concept's name on an entity card. */
  readonly in: string;
  /** A collapsed frame's block: "{kind} · collapsed". */
  readonly collapsed: string;
  readonly kinds: { readonly concept: string; readonly source_system: string; readonly free: string };
  /** "and {n} more" under a block's sixth member. */
  readonly more: (n: number) => string;
  /** A bundle of relationships into a collapsed frame: "{n} relationship(s)". */
  readonly relationships: (n: number) => string;
}

export const ENGLISH_FIGURE_WORDS: FigureWords = {
  in: "in",
  collapsed: "collapsed",
  kinds: { concept: "Concept", source_system: "Source system", free: "Free area" },
  more: (n) => `and ${n} more`,
  relationships: (n) => `${n} relationship${n === 1 ? "" : "s"}`,
};

export interface FigureInput {
  readonly snapshot: Pick<WorkspaceSnapshot<ModuleTable>, "model" | "canvases" | "frames" | "canvasItems" | "labels" | "labelLinks">;
  readonly requirements: RequirementIndex;
  readonly scope: Pick<SectionScope, "entityIds" | "tableIds" | "logical" | "dimensional" | "mappings">;
  /** Whether the dimensional level is drawn (its module is on, D7). */
  readonly dimensionalOn: boolean;
  readonly modules: FigureContributions;
  readonly language: DocLanguage;
  readonly words: FigureWords;
  readonly notation: "ie" | "uml";
  /** The style's black and white (F5: the prototype's `PAL.mono`). */
  readonly mono: boolean;
}

export type FigureDrawing =
  /** The canvas or the frame was deleted since (D11's "(canvas no longer exists)", "(frame no longer exists)"). */
  | { readonly kind: "gone"; readonly what: "canvas" | "frame" }
  /** Nothing of it is in the document's scope ("Nothing from this canvas is in the document's scope."). */
  | { readonly kind: "empty" }
  | {
      readonly kind: "drawn";
      /** The SVG, its `viewBox` the box below (canvas pixels). */
      readonly svg: string;
      readonly box: Rect;
      /** What is drawn (cards, frames, blocks, requirement cards): a part with none of them is left out (Q4). */
      readonly rects: readonly Rect[];
      readonly faces: readonly FigureFace[];
      /** How many cards are drawn (blocks and requirement cards not counted). */
      readonly cards: number;
    };

/** The prototype's figure palette (`PAL`): colour, and black and white. */
export const FIGURE_PALETTE = {
  colour: { ink: "#18212C", ink2: "#4A5767", ink3: "#7C8998", line: "#D6DCE3", bg: "#FFFFFF", logical: "#3346C4", physical: "#A0660F", physSoft: "#F6ECDA", map: "#0B8A72", warn: "#C2410C", warnSoft: "#FCEADD", rel: "#556273", lab: "#F4F6F8", req: "#534AB7", reqSoft: "#ECEAF8", gap: "#D6DCE3", part: "#8FCFC1" },
  mono: { ink: "#111111", ink2: "#333333", ink3: "#6B6B6B", line: "#BDBDBD", bg: "#FFFFFF", logical: "#111111", physical: "#555555", physSoft: "#EDEDED", map: "#333333", warn: "#111111", warnSoft: "#E6E6E6", rel: "#444444", lab: "#F2F2F2", req: "#333333", reqSoft: "#EEEEEE", gap: "#D6D6D6", part: "#9A9A9A" },
} as const;
type Palette = (typeof FIGURE_PALETTE)["colour" | "mono"];

/** The figure's margin around what it draws, in canvas pixels (the prototype's `pad`). */
export const FIGURE_PAD = 20;
/** A frame's name strip above it (the prototype's 26 px). */
export const FRAME_NAME_H = 26;

/**
 * A figure's box around what it draws (cards, expanded frames with their name strip, blocks, requirement cards), with
 * its margin; null when nothing is drawn. Slice 27, step 4: the canvas's page outline takes the same box (Q6: it counts
 * what a figure "As on the canvas" draws, never notes).
 */
export function figureBoxOf(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: Math.floor(x0 - FIGURE_PAD), y: Math.floor(y0 - FIGURE_PAD), w: Math.ceil(x1 - x0 + 2 * FIGURE_PAD), h: Math.ceil(y1 - y0 + 2 * FIGURE_PAD) };
}
/** A frame's rounded corners (canvas.css `.frame`). */
const FRAME_RX = 16;

/** Text, attribute and element-safe: `&`, `<`, `>`, `"` and `'`. */
export const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/** A text cut with an ellipsis to fit `px` at `size` (IBM Plex's estimated widths, the canvas's `text-fit.ts`). */
export function fitText(text: string, px: number, size: number, mono = false): string {
  const width = (s: string) => (mono ? monoWidth(s, size) : sansWidth(s, size));
  if (width(text) <= px) return text;
  const chars = [...text];
  let lo = 0, hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (width(chars.slice(0, mid).join("") + "…") <= px) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, Math.max(1, lo)).join("") + "…";
}

const NO_LIVE_REMOVE = () => ({ direct: false, what: "", others: 0 });

/**
 * A figure's drawing: the canvas's cards in scope (as on the canvas, or adjusted), its frames, lines and requirement
 * cards, or why there is none. Pure: the snapshot's rows and the requirement index only.
 */
export function figureDrawing(input: FigureInput, spec: FigureSpec): FigureDrawing {
  const { snapshot, scope } = input;
  const canvas = snapshot.canvases.find((c) => c.id === spec.canvasId);
  if (!canvas) return { kind: "gone", what: "canvas" };
  const frameRows = snapshot.frames.filter((f) => f.canvas_id === canvas.id);
  if (spec.frameId && !frameRows.some((f) => f.id === spec.frameId)) return { kind: "gone", what: "frame" };
  const asOnCanvas = spec.view === "canvas";
  const P: Palette = input.mono ? FIGURE_PALETTE.mono : FIGURE_PALETTE.colour;

  // the document's mappings only (its filter), so the dots, the counts and the lines follow the scope
  const base = snapshot.model;
  const shownStatus = (status: MappingStatus) => statusShown(scope.mappings, status);
  const mappings = base.mappings.filter((m) => shownStatus(m.status));
  const mappingIds = new Set(mappings.map((m) => m.id));
  const model: WorkspaceModel = { ...base, mappings, mappingInputs: base.mappingInputs.filter((i) => mappingIds.has(i.mapping_id)) };

  // the cards in scope (D3: the others are left out); a dimensional card only while that level is drawn
  const entity = new Map(model.entities.map((e) => [e.id, e]));
  const inScope = (item: CanvasItem): boolean => {
    if (item.entity_id) {
      const e = entity.get(item.entity_id);
      if (!e || !scope.entityIds.has(e.id)) return false;
      return e.model_level === "dimensional" ? scope.dimensional && input.dimensionalOn : scope.logical;
    }
    if (item.source_table_id) return scope.tableIds.has(item.source_table_id);
    return false;
  };
  const items = snapshot.canvasItems.filter((i) => i.canvas_id === canvas.id && i.deleted_at === null);
  let cardItems = items.filter(inScope).filter((i) => !spec.frameId || i.frame_id === spec.frameId);
  if (!asOnCanvas) {
    cardItems = cardItems.map((i) => {
      if (spec.rows === "none") return { ...i, collapsed: true };
      if (spec.rows === "keys") return { ...i, collapsed: false, row_filter: "keys" };
      if (spec.rows === "all") return { ...i, collapsed: false, row_filter: "all" };
      return i;
    });
  }

  // a live label canvas draws its `labeled` rows as it shows them (C4); never a label's mark
  const liveLabel = canvas.live_label_id ? snapshot.labels.find((l) => l.id === canvas.live_label_id && l.deleted_at === null) : undefined;
  const live = liveLabel ? { labelName: liveLabel.name, relevantRows: liveMembership(liveLabel.id, { ...model, links: snapshot.labelLinks }).relevantRows, removeOf: NO_LIVE_REMOVE } : null;
  const roles = input.modules.roles(input.language);
  const cards = buildCards(model, cardItems, undefined, live, [], canvas, roles, {}, input.modules.rowFeeds(shownStatus)).map((c) => applyNames(c, canvas));
  if (!cards.length) return { kind: "empty" };

  // frames: the one asked for, or those holding a drawn card; "Adjusted" and a frame's figure draw them expanded
  const counts = memberCounts(cards);
  const frames: FrameData[] = buildFrames(frameRows)
    .filter((f) => (spec.frameId ? f.id === spec.frameId : (counts.get(f.id) ?? 0) > 0))
    .map((f) => (asOnCanvas && !spec.frameId ? f : { ...f, collapsed: false }));
  const collapsed = new Map(frames.filter((f) => f.collapsed).map((f) => [f.id, f]));
  const collapsedFrameOf = (cardId: string) => {
    const f = cards.find((c) => c.id === cardId)?.frameId;
    return f && collapsed.has(f) ? f : null;
  };
  const hiddenIn = new Map(cards.filter((c) => c.frameId && collapsed.has(c.frameId)).map((c) => [c.id, c.frameId!]));
  const drawn = cards.filter((c) => !hiddenIn.has(c.id));
  const placedById = new Map(drawn.map((c) => [c.id, { x: c.x, y: c.y, card: c } satisfies Placed]));
  const placed = (id: string) => placedById.get(id) ?? null;
  const blocks = new Map([...collapsed.values()].map((f) => [f.id, frameShape(f, counts)]));

  // the lines: as on the canvas (its hidden kinds, D6) or the kinds chosen; dimensional only while that level is drawn
  const kinds: FigureLines = asOnCanvas
    ? { rel: !isHidden(canvas.look, "hideEntityRelationships"), src: !isHidden(canvas.look, "hideSourceRelationships"), map: true, cube: true }
    : spec.lines;
  const status = asOnCanvas || spec.status;
  const all: CanvasLines = buildLines(model, cards);
  const moduleLines = kinds.cube && input.dimensionalOn ? input.modules.lines(model, cards, shownStatus) : [];
  const lines = bundleLines({ ...all, ...(moduleLines.length ? { modules: moduleLines } : {}) }, collapsedFrameOf);

  // requirement cards and their trace lines (D2): "As on the canvas" of a whole canvas only (the prototype's)
  const reqCards: RequirementCardData[] = asOnCanvas && !spec.frameId ? buildRequirementCards(items, input.requirements) : [];
  const faces = new Set<FigureFace>(["sans-400", "sans-600"]);
  const rects: Rect[] = [];
  const grow = (r: Rect) => rects.push(r);

  // ---- frames and blocks ----
  let body = "";
  const conceptColour = new Map(model.concepts.map((c) => [c.id, c.color]));
  const colourOf = (f: FrameData) => (input.mono ? "#555555" : f.kind === "concept" ? (f.conceptId && conceptColour.get(f.conceptId)) || P.ink3 : f.kind === "source_system" ? P.physical : f.color || P.ink3);
  const conceptName = new Map(model.concepts.map((c) => [c.id, c.name]));
  for (const f of frames) {
    const col = colourOf(f);
    if (f.collapsed) {
      const r = blocks.get(f.id)!;
      grow(r);
      body += blockSvg(f, r, cards.filter((c) => c.frameId === f.id), col, P, input.words);
      continue;
    }
    grow({ x: f.x, y: f.y - FRAME_NAME_H, w: f.width, h: f.height + FRAME_NAME_H });
    body +=
      `<rect x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.width)}" height="${n2(f.height)}" rx="${FRAME_RX}" fill="${col}" fill-opacity=".06" stroke="${col}" stroke-opacity=".55" stroke-width="1.5"${f.kind === "free" ? ' stroke-dasharray="6 4"' : ""}/>` +
      `<rect x="${n2(f.x + 4)}" y="${n2(f.y - 19)}" width="10" height="10" rx="${f.kind === "free" ? 5 : 3}" fill="${col}"/>` +
      `<text x="${n2(f.x + 20)}" y="${n2(f.y - 10)}" class="fn">${escapeXml(fitText(f.name, Math.max(40, f.width - 24), 13))}</text>`;
  }

  // ---- lines ----
  let lineSvg = "";
  const rectOf = (c: CardData): Rect => ({ x: c.x, y: c.y, w: cardWidth(c), h: cardHeight(c) });
  if (kinds.src)
    for (const s of lines.sources ?? []) {
      const A = placed(s.fromCardId), B = placed(s.toCardId);
      if (!A || !B) continue;
      const g = relGeom(rectOf(A.card as CardData), rectOf(B.card as CardData), s.offset, s.fromCardId === s.toCardId);
      lineSvg += `<g class="srel${s.missing ? " gone" : ""}"><path class="s" d="${g.d}"/><path class="ar" d="${arrowHead(g.pb, g.nb)}"/></g>`;
    }
  if (kinds.rel)
    for (const r of lines.relationships) {
      const A = placed(r.fromCardId), B = placed(r.toCardId);
      if (!A || !B) continue;
      const g = relGeom(rectOf(A.card as CardData), rectOf(B.card as CardData), r.offset, r.fromCardId === r.toCardId);
      const fromMax = r.fromMax, toMax = r.toMax;
      let marks = "";
      if (input.notation === "ie") {
        const a = ieMarker(g.pa, g.na, r.fromMin, fromMax), b = ieMarker(g.pb, g.nb, r.toMin, toMax);
        marks = `<path class="mk" d="${a.d}${b.d}"/>` + [a.circle, b.circle].filter((c): c is Pt => !!c).map((c) => `<circle class="mk" cx="${n2(c.x)}" cy="${n2(c.y)}" r="4"/>`).join("");
      } else {
        const ta = umlMarker(g.pa, g.na), tb = umlMarker(g.pb, g.nb);
        marks = `<text class="mult" x="${n2(ta.x)}" y="${n2(ta.y)}">${multText(r.fromMin, fromMax)}</text><text class="mult" x="${n2(tb.x)}" y="${n2(tb.y)}">${multText(r.toMin, toMax)}</text>`;
        faces.add("sans-500");
      }
      const relationship = model.relationships.find((x) => x.id === r.id);
      const text = relationship ? pillText(relationship) : r.label;
      let pill = "";
      if (text) {
        faces.add("sans-500");
        const w = Math.min(220, sansWidth(text, 11) + 14);
        pill = `<g class="rlab"><rect x="${n2(g.mid.x - w / 2)}" y="${n2(g.mid.y - 9)}" width="${n2(w)}" height="18" rx="9"/><text x="${n2(g.mid.x)}" y="${n2(g.mid.y)}">${escapeXml(fitText(text, w - 12, 11))}</text></g>`;
      }
      lineSvg += `<g class="rel"><path class="s" d="${g.d}"/>${marks}${pill}</g>`;
    }
  const mapLook = (s: MappingStatus, warn: boolean) => `map ${status ? s : "approved"}${warn && status ? " warn" : ""}`;
  if (kinds.map) {
    for (const m of lines.mappings) {
      const g = mapGeom(m, placed);
      if (!g) continue;
      const showChip = g.chip && (status || g.chip.text === "ƒ");
      lineSvg +=
        `<g class="${mapLook(m.status, m.warn)}${g.part ? " part" : ""}">` +
        g.paths.map((d) => `<path class="s" d="${d}"/>`).join("") +
        g.dots.map(([x, y]) => `<circle class="end" cx="${n2(x)}" cy="${n2(y)}" r="2.6"/>`).join("") +
        (showChip ? chipSvg(g.chip!.x, g.chip!.y, g.chip!.text, 8) : "") +
        `</g>`;
    }
  }
  const maps = new Map(all.mappings.map((m) => [m.id, m]));
  for (const b of lines.bundles) {
    if (b.t === "map" ? !kinds.map : !kinds.rel) continue;
    const g = bundleGeom(b, placed, blocks, maps);
    if (!g) continue;
    if (g.kind === "single") {
      const m = g.line;
      lineSvg += `<g class="${mapLook(m.status, m.warn)}${g.geom.part ? " part" : ""}">${g.geom.paths.map((d) => `<path class="s" d="${d}"/>`).join("")}${g.geom.dots.map(([x, y]) => `<circle class="end" cx="${n2(x)}" cy="${n2(y)}" r="2.6"/>`).join("")}${g.geom.chip && (status || g.geom.chip.text === "ƒ") ? chipSvg(g.geom.chip.x, g.geom.chip.y, g.geom.chip.text, 8) : ""}</g>`;
    } else if (g.kind === "map") {
      lineSvg += `<g class="map ${status && g.draft ? "draft" : "approved"}${status && g.warn ? " warn" : ""}"><path class="s" d="${g.d}" stroke-width="${n2(g.width)}"/>${chipSvg(g.mid.x, g.mid.y, String(g.count), 9)}</g>`;
    } else {
      faces.add("sans-500");
      const text = input.words.relationships(b.ids.length), w = sansWidth(text, 11) + 14;
      lineSvg += `<g class="rel"><path class="s" d="${g.d}" stroke-width="${n2(g.width)}"/><g class="rlab"><rect x="${n2(g.mid.x - w / 2)}" y="${n2(g.mid.y - 9)}" width="${n2(w)}" height="18" rx="9"/><text x="${n2(g.mid.x)}" y="${n2(g.mid.y)}">${escapeXml(text)}</text></g></g>`;
    }
  }
  for (const l of lines.modules ?? []) {
    const g = moduleGeom(l, placed);
    if (!g) continue;
    const look = status ? l.cls : l.cls.replace(/\b(draft|review)\b/, "approved");
    const col = input.mono ? P.ink2 : l.colour;
    lineSvg +=
      `<g class="${escapeXml(look)}" stroke="${col}" fill="${col}">` +
      g.paths.map((d) => `<path class="s" d="${d}"/>`).join("") +
      g.starts.map((p) => `<circle cx="${n2(p.x)}" cy="${n2(p.y)}" r="2.6"/>`).join("") +
      g.ends.map((p) => `<rect x="${n2(p.x - 3)}" y="${n2(p.y - 3)}" width="6" height="6" transform="rotate(45 ${n2(p.x)} ${n2(p.y)})"/>`).join("") +
      (g.chip ? chipSvg(g.chip.x, g.chip.y, g.chip.text, 8, col) : "") +
      `</g>`;
  }
  // trace lines (D2): dashed, in the requirement colour, to the element on this figure
  if (reqCards.length) {
    const cardIdOf = new Map(cards.map((c) => [`${c.kind}:${c.targetId}`, c.id]));
    const entityOf = new Map(model.attributes.map((a) => [a.id, a.entity_id]));
    const tableOf = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
    const drawnMappings = new Set(lines.mappings.map((m) => m.id));
    const traces = buildTraces(reqCards, input.requirements.linksOf, {
      cardOf: (kind, id) => cardIdOf.get(`${kind}:${id}`),
      entityOf: (id) => entityOf.get(id),
      tableOf: (id) => tableOf.get(id),
      hasMapping: (id) => kinds.map && drawnMappings.has(id),
    });
    const reqRect = new Map(reqCards.map((r) => [r.id, { x: r.x, y: r.y, w: REQ_CARD.width, h: requirementCardHeight(r.nameLines) }]));
    const placeOf = (cardId: string): TraceCardPlace => {
      const p = placed(cardId);
      if (p) return { placed: p };
      const frameId = hiddenIn.get(cardId);
      const block = frameId ? blocks.get(frameId) : undefined;
      if (!block) return null;
      return { block, index: cards.filter((c) => c.frameId === frameId).findIndex((c) => c.id === cardId) };
    };
    const mid = (id: string) => {
      const m = maps.get(id);
      return m ? (mapGeom(m, placed)?.mid ?? null) : null;
    };
    for (const t of traces) {
      const g = traceGeom(reqRect.get(t.reqCardId) ?? null, t.target, placeOf, mid);
      if (g) lineSvg += `<path class="trace" d="M${n2(g.x1)},${n2(g.y1)} L${n2(g.x2)},${n2(g.y2)}"/><circle class="trace-dot" cx="${n2(g.x2)}" cy="${n2(g.y2)}" r="2.6"/>`;
    }
  }

  // ---- cards ----
  let cardSvg = "";
  let clips = 0;
  for (const c of drawn) {
    grow(rectOf(c));
    if (c.kind === "src") {
      faces.add("mono-400").add("mono-500");
      cardSvg += sourceCardSvg(c, status, P);
    } else {
      const concept = conceptName.get(entity.get(c.targetId)?.concept_id ?? "");
      cardSvg += entityCardSvg(c, status, P, input.mono, c.role ? "" : concept ? `${input.words.in} ${concept}` : "", `k${++clips}`);
      if (c.rows.some((r) => r.calc)) faces.add("mono-400");
    }
  }
  for (const r of reqCards) {
    const h = requirementCardHeight(r.nameLines);
    grow({ x: r.x, y: r.y, w: REQ_CARD.width, h });
    faces.add("mono-500");
    cardSvg += requirementCardSvg(r, h, P);
  }
  const box = figureBoxOf(rects);
  if (!box) return { kind: "empty" };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w}" height="${box.h}">` +
    `<style>${figureCss(P)}</style>` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${P.bg}"/>` +
    body +
    lineSvg +
    cardSvg +
    `</svg>`;
  return { kind: "drawn", svg, box, rects, faces: FIGURE_FACES.filter((f) => faces.has(f)), cards: drawn.length };
}

/** The figure's own styles: the faces by name (the page embeds the files, Q2) and the lines' looks (the prototype's). */
function figureCss(P: Palette): string {
  return (
    `text{font-family:'IBM Plex Sans',sans-serif;fill:${P.ink}}.m{font-family:'IBM Plex Mono',monospace}` +
    `.fn{font-size:13px;font-weight:600}` +
    `.rel .s{fill:none;stroke:${P.rel};stroke-width:1.6}.rel .mk{fill:none;stroke:${P.rel};stroke-width:1.6}.rel circle.mk{fill:${P.bg}}` +
    `.rlab rect{fill:${P.lab};stroke:${P.line}}.rlab text,.mult{font-size:11px;font-weight:500;fill:${P.ink2};text-anchor:middle;dominant-baseline:central}` +
    `.srel .s{fill:none;stroke:${P.ink3};stroke-width:1.1;opacity:.8}.srel .ar{fill:${P.ink3}}.srel.gone .s{stroke-dasharray:4 3}` +
    `.map .s,.cmap .s{fill:none;stroke-width:1.6}.map .s{stroke:${P.map}}.map .end{fill:${P.map}}` +
    `.map.draft .s,.cmap.draft .s{stroke-dasharray:6 4}.map.review .s,.cmap.review .s{stroke-dasharray:10 3 2 3}` +
    `.map.warn .s{stroke:${P.warn}}.map.warn .end{fill:${P.warn}}.map.part .s{opacity:.45}` +
    `.chip circle{fill:${P.bg};stroke:${P.map};stroke-width:1.4}.map.warn .chip circle{stroke:${P.warn}}` +
    `.chip text{font-size:10px;font-weight:600;fill:${P.map};text-anchor:middle;dominant-baseline:central}.map.warn .chip text{fill:${P.warn}}` +
    `.trace{fill:none;stroke:${P.req};stroke-width:1.2;stroke-dasharray:4 3;opacity:.75}.trace-dot{fill:${P.req}}`
  );
}

function chipSvg(x: number, y: number, text: string, r: number, colour?: string): string {
  const style = colour ? ` style="stroke:${colour}"` : "";
  const fill = colour ? ` style="fill:${colour}"` : "";
  return `<g class="chip"><circle cx="${n2(x)}" cy="${n2(y)}" r="${r}"${style}/><text x="${n2(x)}" y="${n2(y)}"${fill}>${escapeXml(text)}</text></g>`;
}

/** A row's status mark (the prototype's `rowStat`): fed or mapped, a type problem, calculated, or not. */
function rowState(r: CardRow): "ok" | "warn" | "calc-ok" | "calc-gap" | "" {
  if (r.mappings > 0) return r.warn ? "warn" : "ok";
  if (r.calc?.square) return r.calc.square === "ok" ? "calc-ok" : "calc-gap";
  return "";
}

function rowsSvg(card: CardData, status: boolean, P: Palette): string {
  const rows = visibleRows(card), w = cardWidth(card), src = card.kind === "src";
  if (!rows.length) return card.collapsed ? "" : `<text x="12" y="${HEAD_H + BODY_PAD + ROW_H / 2 + 4}" font-size="12" font-style="italic" fill="${P.ink3}">—</text>`;
  const dual = rows.some((r) => r.pk && r.fk), kx = 12, nx = dual ? 52 : 36;
  return rows
    .map((r, i) => {
      const cy = HEAD_H + BODY_PAD + i * ROW_H + ROW_H / 2;
      const state = status ? rowState(r) : "";
      const tag: [string, string, string] | null = src ? (r.bk ? ["BK", P.physical, P.physSoft] : null) : r.pii ? ["PII", P.warn, P.warnSoft] : r.bk ? ["BK", P.physical, P.physSoft] : null;
      const typeW = (src ? monoWidth(r.type, 10.5) : sansWidth(r.type, 11)) + 4;
      const nameW = w - nx - typeW - (status ? 26 : 12) - (tag ? 26 : 0) - (r.calc ? 16 : 0);
      const name = fitText(shownText(r), Math.max(20, nameW), src ? 12 : 12.5, src);
      const nameEnd = nx + (src ? monoWidth(name, 12) : sansWidth(name, 12.5));
      let s = "";
      if (r.pk) s += `<text x="${kx}" y="${n2(cy + 3.5)}" font-size="9.5" font-weight="600" fill="${src ? P.physical : P.logical}">PK</text>`;
      if (r.fk) s += `<text x="${kx + (r.pk ? 18 : 0)}" y="${n2(cy + 3.5)}" font-size="9.5" font-weight="600" fill="${P.ink3}">FK</text>`;
      s += `<text x="${nx}" y="${n2(cy + 4.3)}" font-size="${src ? 12 : 12.5}"${src ? ' class="m"' : ""}>${escapeXml(name)}</text>`;
      let tx = nameEnd + 6;
      if (r.calc) {
        s += `<text x="${n2(tx)}" y="${n2(cy + 4)}" font-size="10.5" font-weight="600" fill="${P.logical}" class="m">=</text>`;
        tx += 14;
      }
      if (tag) s += `<rect x="${n2(tx)}" y="${n2(cy - 7.5)}" width="22" height="15" rx="3" fill="${tag[2]}"/><text x="${n2(tx + 11)}" y="${n2(cy + 3.4)}" font-size="9" font-weight="600" text-anchor="middle" fill="${tag[1]}">${tag[0]}</text>`;
      s += `<text x="${w - (status ? 24 : 10)}" y="${n2(cy + 3.8)}" font-size="${src ? 10.5 : 11}" text-anchor="end" fill="${P.ink3}"${src ? ' class="m"' : ""}>${escapeXml(r.type)}</text>`;
      if (status)
        s +=
          state === "ok"
            ? `<circle cx="${w - 13}" cy="${n2(cy)}" r="5" fill="${P.map}"/>`
            : state === "warn"
              ? `<circle cx="${w - 13}" cy="${n2(cy)}" r="5" fill="${P.warn}"/>`
              : state === "calc-ok"
                ? `<rect x="${w - 17.5}" y="${n2(cy - 4.5)}" width="9" height="9" rx="1.5" fill="${P.map}"/>`
                : state === "calc-gap"
                  ? `<rect x="${w - 17.5}" y="${n2(cy - 4.5)}" width="9" height="9" rx="1.5" fill="none" stroke="${P.map}" stroke-width="1.6"/>`
                  : `<circle cx="${w - 13}" cy="${n2(cy)}" r="4.3" fill="none" stroke="${P.ink3}" stroke-width="1.5"/>`;
      return s;
    })
    .join("");
}

/** The fed or mapped count in a header: "{n}/{m}" over the rows. */
const countOf = (c: CardData) => `${c.rows.filter((r) => r.mappings > 0 || r.calc?.square === "ok").length}/${c.rows.length}`;

function entityCardSvg(c: CardData, status: boolean, P: Palette, mono: boolean, line1b: string, clip: string): string {
  const w = cardWidth(c), h = cardHeight(c), col = mono ? "#555555" : c.color || P.ink3;
  const l1 = fitText(c.line1, 120, 11);
  const l1w = sansWidth(l1, 11);
  // the concept's band on the left edge, clipped to the card's corners (one SVG per image: the ids never meet)
  return (
    `<g transform="translate(${n2(c.x)},${n2(c.y)})"><clipPath id="${clip}"><rect width="${w}" height="${h}" rx="10"/></clipPath>` +
    `<rect width="${w}" height="${h}" rx="10" fill="${P.bg}" stroke="${P.line}"/>` +
    `<g clip-path="url(#${clip})"><rect width="4" height="${c.collapsed ? h : HEAD_H}" fill="${col}"/>` +
    (c.role ? `<rect x="4" width="${w - 4}" height="${HEAD_H}" fill="${col}" fill-opacity=".07"/>` : "") +
    `</g>` +
    (c.collapsed ? "" : `<line x1="0" x2="${w}" y1="${HEAD_H}" y2="${HEAD_H}" stroke="${P.line}"/>`) +
    `<text x="14" y="19" font-size="11" fill="${P.ink2}"${c.role ? ' font-weight="600"' : ""}>${escapeXml(l1)}</text>` +
    (line1b ? `<text x="${n2(14 + l1w + 6)}" y="19" font-size="11" fill="${P.ink3}">${escapeXml(fitText(line1b, Math.max(20, w - l1w - 40), 11))}</text>` : "") +
    `<text x="14" y="41" font-size="13.5" font-weight="600">${escapeXml(fitText(shownText(c), w - (status ? 70 : 24), 13.5))}</text>` +
    (status ? `<text x="${w - 10}" y="40.5" font-size="11" text-anchor="end" fill="${P.ink3}">${countOf(c)}</text>` : "") +
    rowsSvg(c, status, P) +
    `</g>`
  );
}

function sourceCardSvg(c: CardData, status: boolean, P: Palette): string {
  const w = cardWidth(c), h = cardHeight(c);
  return (
    `<g transform="translate(${n2(c.x)},${n2(c.y)})">` +
    `<rect width="${w}" height="${h}" rx="3" fill="${P.bg}" stroke="${P.line}"/><rect width="${w}" height="3" fill="${P.physical}"/>` +
    (c.collapsed ? "" : `<line x1="0" x2="${w}" y1="${HEAD_H}" y2="${HEAD_H}" stroke="${P.line}"/>`) +
    `<text x="14" y="19" font-size="10.5" class="m" fill="${P.ink3}">${escapeXml(fitText(c.line1, w - 24, 10.5, true))}</text>` +
    `<text x="14" y="41" font-size="13.5" font-weight="500" class="m">${escapeXml(fitText(c.name, w - (status ? 70 : 24), 13.5, true))}</text>` +
    (status ? `<text x="${w - 10}" y="40.5" font-size="11" text-anchor="end" fill="${P.ink3}">${countOf(c)}</text>` : "") +
    rowsSvg(c, status, P) +
    `</g>`
  );
}

/** A collapsed frame's block (the prototype's `blockSVG`): its kind, its name, up to six members, "and {n} more". */
function blockSvg(f: FrameData, r: Rect, members: readonly CardData[], col: string, P: Palette, words: FigureWords): string {
  const kind = f.kind === "concept" ? words.kinds.concept : f.kind === "source_system" ? words.kinds.source_system : words.kinds.free;
  const rows = members
    .slice(0, BLOCK.maxRows)
    .map((m, i) => {
      const y = blockRowY({ y: 0 }, i) + 4;
      const src = m.kind === "src";
      return (
        `<rect x="14" y="${n2(y - 8)}" width="8" height="8" rx="${src ? 0 : 2}" fill="${src ? P.physical : P.logical}" opacity=".7"/>` +
        `<text x="30" y="${n2(y)}" font-size="12"${src ? ' class="m"' : ""}>${escapeXml(fitText(shownText(m), r.w - 90, 12, src))}</text>` +
        `<text x="${r.w - 14}" y="${n2(y)}" font-size="11" text-anchor="end" fill="${P.ink3}">${m.rows.length}</text>`
      );
    })
    .join("");
  const more = members.length > BLOCK.maxRows ? `<text x="30" y="${n2(blockRowY({ y: 0 }, BLOCK.maxRows) + 4)}" font-size="11.5" fill="${P.ink3}">${escapeXml(words.more(members.length - BLOCK.maxRows))}</text>` : "";
  return (
    `<g transform="translate(${n2(r.x)},${n2(r.y)})"><rect width="${r.w}" height="${r.h}" rx="12" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-opacity=".6" stroke-width="1.5"/>` +
    `<text x="14" y="19" font-size="11" fill="${P.ink2}">${escapeXml(`${kind} · ${words.collapsed}`)}</text>` +
    `<text x="14" y="41" font-size="13.5" font-weight="600">${escapeXml(fitText(f.name, r.w - 28, 13.5))}</text>` +
    `<line x1="0" x2="${r.w}" y1="${HEAD_H}" y2="${HEAD_H}" stroke="${col}" stroke-opacity=".4"/>${rows}${more}</g>`
  );
}

/** A requirement card (D2; the canvas's `.rq-card`, drawn as SVG): key and kind, the name, the coverage bar, status and counts. */
function requirementCardSvg(r: RequirementCardData, h: number, P: Palette): string {
  const W = REQ_CARD.width, total = Math.max(1, r.total);
  const nameLines = wrapName(r.name, W - 20, 13);
  const barY = REQ_CARD.headH + REQ_CARD.namePad + Math.max(1, nameLines.length) * REQ_CARD.nameLine + 2;
  const cov = (r.bar.covered / total) * (W - 20), mapped = (r.bar.mapped / total) * (W - 20);
  return (
    `<g transform="translate(${n2(r.x)},${n2(r.y)})">` +
    `<rect width="${W}" height="${h}" rx="8" fill="${P.bg}" stroke="${P.req}"/>` +
    `<path d="M0.5,8 a7.5,7.5 0 0 1 7.5,-7.5 H${W - 8} a7.5,7.5 0 0 1 7.5,7.5 V${REQ_CARD.headH} H0.5 Z" fill="${P.req}"/>` +
    `<text x="10" y="17" font-size="11" font-weight="500" class="m" fill="#FFFFFF">${escapeXml(r.key)}</text>` +
    `<text x="${W - 10}" y="17" font-size="11" text-anchor="end" fill="#FFFFFF">${escapeXml(r.kindName)}</text>` +
    nameLines.map((l, i) => `<text x="10" y="${REQ_CARD.headH + 8 + 13 + i * REQ_CARD.nameLine}" font-size="13" font-weight="600">${escapeXml(l)}</text>`).join("") +
    `<rect x="10" y="${n2(barY)}" width="${W - 20}" height="5" rx="2.5" fill="${P.gap}"/>` +
    (r.total ? `<rect x="10" y="${n2(barY)}" width="${n2(cov)}" height="5" fill="${P.map}"/><rect x="${n2(10 + cov)}" y="${n2(barY)}" width="${n2(mapped)}" height="5" fill="${P.part}"/>` : "") +
    `<text x="10" y="${n2(h - 12)}" font-size="11" fill="${P.ink3}">${escapeXml(`${r.statusName} · ${r.bar.covered} / ${r.total}`)}</text>` +
    `</g>`
  );
}

/** A requirement's name in lines of the card's width (words wrap, a longer word breaks), as `requirementNameLines` counts. */
function wrapName(name: string, px: number, size: number): string[] {
  const width = (s: string) => sansWidth(s, size) * 1.05;
  const lines: string[] = [];
  let line = "";
  for (const word of name.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (width(next) <= px) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    let rest = word;
    while (width(rest) > px) {
      const cut = fitText(rest, px, size).replace(/…$/, "");
      lines.push(cut);
      rest = rest.slice(cut.length);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
