// Slice 12b's steps: the canvas thumbnails on the tiles (PRD P2, P5). The earlier slices' helpers come through slice
// 12a's. A thumbnail is read from the file its tile's `<use>` refers to (the route's SVG): its paths' kinds, colours
// and subpaths. Specs compare it with the data without the domain's rules: the drawing is the canvas scaled and moved,
// so the scale and the offset come from the leftmost and the rightmost drawn edge, and every expected shape must be
// there at its place and width.

import { expect, type Locator, type Page } from "@playwright/test";
import { deleteEntity } from "../../src/domain/commands/entity";
import { deleteFrame } from "../../src/domain/commands/frame";
import { createNote, deleteNote } from "../../src/domain/commands/note";
import { deleteRequirement } from "../../src/domain/commands/requirement";
import { collapse, makeFrame } from "../slice-02c/helpers";
import { openLiveFor } from "../slice-03b/helpers";
import { asLukasz, loadModel, placeReqCards, RETAIL, SEED_IDS, store } from "../slice-12a/helpers";

export * from "../slice-12a/helpers";
export { collapse, makeFrame, openLiveFor };
export { place } from "../slice-02b/helpers";

export type Kind = "frame" | "block" | "table" | "entity" | "note" | "requirement" | "line";
export interface Rect {
  kind: Exclude<Kind, "line">;
  color: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Thumb {
  rects: Rect[];
  lines: number;
  viewBox: string;
  cache: string | undefined;
  status: number;
}

/** A canvas tile on the project home, by its canvas's name. */
export const tileOf = (page: Page, name: string): Locator =>
  page.getByTestId("tile-canvas").filter({ has: page.getByTestId("tile-canvas-name").getByText(name, { exact: true }) });

/** The address a strip's `<use>` refers to, without its fragment; null when the strip says "Empty canvas". */
export async function thumbnailHref(tile: Locator): Promise<string | null> {
  if (await tile.getByTestId("tile-thumbnail-empty").count()) return null;
  const href = await tile.getByTestId("tile-thumbnail").locator("use").getAttribute("href");
  return href ? href.replace(/#.*$/, "") : null;
}

/** A thumbnail file's shapes. */
export function parseThumbnail(svg: string): Omit<Thumb, "cache" | "status"> {
  const rects: Rect[] = [];
  let lines = 0;
  for (const m of svg.matchAll(/<path data-kind="(\w+)"(?: data-color="([^"]+)")? d="([^"]+)"/g)) {
    const kind = m[1] as Kind;
    const d = m[3]!;
    if (kind === "line") {
      lines += (d.match(/M/g) ?? []).length;
      continue;
    }
    for (const r of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v(\d+)h-\d+z/g)) rects.push({ kind, color: m[2] ?? null, x: +r[1]!, y: +r[2]!, w: +r[3]!, h: +r[4]! });
  }
  return { rects, lines, viewBox: /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "" };
}

/** A tile's thumbnail, fetched as the browser fetches it (the page's cookies). */
export async function thumbnailOf(page: Page, tile: Locator): Promise<Thumb | null> {
  const href = await thumbnailHref(tile);
  if (!href) return null;
  const res = await page.request.get(href);
  return { ...parseThumbnail(await res.text()), cache: res.headers()["cache-control"], status: res.status() };
}

/** A shape expected from the data: its kind, colour role (when it matters), place and width in canvas units. */
export interface Expected {
  kind: Rect["kind"];
  color?: string | null;
  x: number;
  y: number;
  w: number;
}

/**
 * Checks that the thumbnail holds exactly the expected shapes (as many of each kind, every one at its place and width
 * after the scale and offset the outer edges give) and returns the scale.
 */
export function expectDrawn(t: Thumb, expected: readonly Expected[]): number {
  const count = (xs: readonly { kind: string }[]) => Object.fromEntries([...new Set(xs.map((x) => x.kind))].sort().map((k) => [k, xs.filter((x) => x.kind === k).length]));
  expect(count(t.rects)).toEqual(count(expected));
  const left = Math.min(...expected.map((e) => e.x)), right = Math.max(...expected.map((e) => e.x + e.w)), top = Math.min(...expected.map((e) => e.y));
  const tLeft = Math.min(...t.rects.map((r) => r.x)), tRight = Math.max(...t.rects.map((r) => r.x + r.w)), tTop = Math.min(...t.rects.map((r) => r.y));
  const s = (tRight - tLeft) / (right - left);
  for (const e of expected) {
    const x = tLeft + (e.x - left) * s, y = tTop + (e.y - top) * s, w = e.w * s;
    const found = t.rects.find((r) => r.kind === e.kind && (e.color === undefined || r.color === e.color) && Math.abs(r.x - x) <= 2 && Math.abs(r.y - y) <= 2 && Math.abs(r.w - w) <= 2);
    expect(found, `${e.kind}${e.color ? ` ${e.color}` : ""} at ${e.x}, ${e.y} (${Math.round(x)}, ${Math.round(y)} in the thumbnail)`).toBeTruthy();
  }
  return s;
}

/** Order management's own canvas and the shared one (seed). */
export const CO = SEED_IDS.canvasCustomerOrders;
export const OL = SEED_IDS.canvasOrderLines;

/** A canvas's live rows and the model, from the e2e data file. */
export async function canvasData(canvasId: string) {
  const s = store();
  const [model, items, frames, notes, requirements] = await Promise.all([
    loadModel(),
    s.canvasItems.listOfCanvas(RETAIL, canvasId),
    s.frames.listOfCanvas(RETAIL, canvasId),
    s.notes.listOfCanvas(RETAIL, canvasId),
    s.requirements.list(RETAIL),
  ]);
  return { model, items, frames, notes, requirements };
}

/**
 * What P2 draws of a canvas, read plainly from its rows: frames (a collapsed one as its 280-wide block), entity cards
 * in their concept's colour and table cards in the physical colour unless their frame is collapsed, free notes unless
 * their frame is collapsed, and the cards of live requirements. Places and widths only: heights follow the canvas's
 * rules, which the unit tests check.
 */
export function expectedOf(data: Awaited<ReturnType<typeof canvasData>>): Expected[] {
  const { model, items, frames, notes, requirements } = data;
  const collapsed = new Set(frames.filter((f) => f.collapsed).map((f) => f.id));
  const hidden = (frameId: string | null) => frameId !== null && collapsed.has(frameId);
  const out: Expected[] = frames.map((f) => ({ kind: f.collapsed ? "block" : "frame", x: f.x, y: f.y, w: f.collapsed ? 280 : f.width }));
  for (const i of items) {
    if (hidden(i.frame_id)) continue;
    if (i.entity_id && model.entities.some((e) => e.id === i.entity_id)) out.push({ kind: "entity", color: conceptColorOf(model, i.entity_id), x: i.x, y: i.y, w: i.width ?? 256 });
    else if (i.source_table_id && model.sourceTables.some((t) => t.id === i.source_table_id)) out.push({ kind: "table", color: "physical", x: i.x, y: i.y, w: i.width ?? 256 });
    else if (i.requirement_id && requirements.some((r) => r.id === i.requirement_id)) out.push({ kind: "requirement", color: "req", x: i.x, y: i.y, w: 230 });
  }
  for (const n of notes) if (!n.pin_canvas_item_id && !n.pin_frame_id && !hidden(n.frame_id)) out.push({ kind: "note", color: n.color, x: n.x, y: n.y, w: n.width });
  return out;
}

/** The table and entity pairs on a canvas joined by a mapping, from the data. */
export function mappedPairs(model: Awaited<ReturnType<typeof loadModel>>, items: readonly { entity_id: string | null; source_table_id: string | null }[]): number {
  const entities = new Set(items.flatMap((i) => (i.entity_id ? [i.entity_id] : [])));
  const tables = new Set(items.flatMap((i) => (i.source_table_id ? [i.source_table_id] : [])));
  const pairs = new Set<string>();
  for (const m of model.mappings) {
    const e = model.attributes.find((a) => a.id === m.attribute_id)?.entity_id;
    for (const i of model.mappingInputs.filter((x) => x.mapping_id === m.id)) {
      const t = model.sourceColumns.find((c) => c.id === i.source_column_id)?.source_table_id;
      if (e && t && entities.has(e) && tables.has(t)) pairs.add(`${t}|${e}`);
    }
  }
  return pairs.size;
}

/** An entity's concept colour, from the data. */
export const conceptColorOf = (model: Awaited<ReturnType<typeof loadModel>>, entityId: string) =>
  model.concepts.find((c) => c.id === model.entities.find((e) => e.id === entityId)!.concept_id)!.color;

// ---- test data through the domain ----

/** Deletes an entity as its panel does (its cards go, notes pinned to them become free notes at their place). */
export async function deleteEntityAs(name: string): Promise<void> {
  const s = store();
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === name)!;
  const [canvasItems, labelLinks, notes, requirementLinks] = await Promise.all([s.canvasItems.list(RETAIL), s.labels.listLinks(RETAIL), s.notes.list(RETAIL), s.requirements.listLinks(RETAIL)]);
  await asLukasz((ctx, access) => deleteEntity(ctx, access, { ...model, entity, canvasItems, labelLinks, notes, requirementLinks }, { entityId: entity.id, expectedVersion: entity.version }));
}

/** Deletes a requirement by key (its cards stay in the data, as in the app). */
export async function deleteRequirementAs(key: string): Promise<void> {
  const s = store();
  const [requirements, links, items] = await Promise.all([s.requirements.list(RETAIL), s.requirements.listLinks(RETAIL), s.canvasItems.list(RETAIL)]);
  const r = requirements.find((x) => x.key === key)!;
  await asLukasz((ctx, access) => deleteRequirement(ctx, access, { requirements, links, items }, { requirementId: r.id, expectedVersion: r.version }));
}

/** Deletes a frame (its cards stay where they are). */
export async function deleteFrameAs(frameId: string): Promise<void> {
  const s = store();
  const frame = (await s.frames.list(RETAIL)).find((f) => f.id === frameId)!;
  const [canvas, frames, items, notes] = await Promise.all([s.canvases.get(RETAIL, frame.canvas_id), s.frames.listOfCanvas(RETAIL, frame.canvas_id), s.canvasItems.listOfCanvas(RETAIL, frame.canvas_id), s.notes.listOfCanvas(RETAIL, frame.canvas_id)]);
  const cards = items.filter((i) => i.frame_id === frameId).map((i) => ({ canvasItemId: i.id, expectedVersion: i.version }));
  await asLukasz((ctx, access) => deleteFrame(ctx, access, { canvas, frames, items, notes }, { frameId, expectedVersion: frame.version, cards }));
}

/** A note on a canvas: free at a place, or pinned to a card. Returns its id. */
export async function addNote(canvasId: string, text: string, at: { x: number; y: number } | { pinTo: string }): Promise<string> {
  const s = store();
  const [canvas, items, frames, notes] = await Promise.all([s.canvases.get(RETAIL, canvasId), s.canvasItems.listOfCanvas(RETAIL, canvasId), s.frames.listOfCanvas(RETAIL, canvasId), s.notes.listOfCanvas(RETAIL, canvasId)]);
  const where = "pinTo" in at ? { pin: { canvasItemId: at.pinTo } } : at;
  return (await asLukasz((ctx, access) => createNote(ctx, access, { canvas, items, frames, notes }, { canvasId, text, ...where }))).note.id;
}

/** Deletes a note. */
export async function deleteNoteAs(noteId: string): Promise<void> {
  const note = (await store().notes.list(RETAIL)).find((n) => n.id === noteId) ?? null;
  await asLukasz((ctx, access) => deleteNote(ctx, access, { note }, { noteId, expectedVersion: note!.version }));
}

export { placeReqCards };
