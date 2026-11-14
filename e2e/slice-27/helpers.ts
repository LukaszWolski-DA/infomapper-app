// Slice 27's helpers: figures as test data (a document whose sections are a Figure section's figures, a frame on a
// canvas), the figures in the pages and the quick sheet (their images, the SVG each shows, their captions), and the
// editor's figure editor and side panels.

import { expect, type Locator, type Page } from "@playwright/test";
import { readDb } from "../../src/data/local/file";
import { uuidv7 } from "../../src/domain/ids";
import type { Frame } from "../../src/domain/types";
import { newFigure, type FigureEntry } from "../../src/modules/infodocumenter/domain/sections";
import { E2E_DB } from "../config";
import { changeDb, setSections } from "../slice-26/helpers";
import { RETAIL } from "../slice-07c/helpers";

export * from "../slice-26/helpers";

/** The demo's canvas by name in "Retail Co – DWH". */
export async function canvasId(name: string): Promise<string> {
  const db = await readDb(E2E_DB);
  return db.canvas.find((c) => c.name === name && c.workspace_id === RETAIL && c.deleted_at === null)!.id;
}

/**
 * Test data: a free frame around the first entity card of a canvas, holding that card (the demo's canvases have no
 * frame); its id.
 */
export async function frameAroundFirstEntity(canvasName: string, name: string): Promise<{ frameId: string; entityId: string }> {
  const id = uuidv7();
  let entityId = "";
  await changeDb((db) => {
    const canvas = db.canvas.find((c) => c.name === canvasName && c.workspace_id === RETAIL && c.deleted_at === null)!;
    const item = db.canvas_item.find((i) => i.canvas_id === canvas.id && i.entity_id && i.deleted_at === null)!;
    entityId = item.entity_id!;
    const now = new Date().toISOString();
    const frame: Frame = {
      id,
      workspace_id: RETAIL,
      version: 1,
      created_at: now,
      created_by: item.created_by,
      updated_at: now,
      updated_by: item.created_by,
      deleted_at: null,
      canvas_id: canvas.id,
      name,
      kind: "free",
      concept_id: null,
      source_system_id: null,
      color: "#3346C4",
      x: item.x - 40,
      y: item.y - 40,
      width: 340,
      height: 520,
      collapsed: false,
    };
    db.frame.push(frame);
    item.frame_id = id;
  });
  return { frameId: id, entityId };
}

/** Test data: a document's sections replaced by one Figure section with these figures (its other sections gone). */
export const figuresOnly = (name: string, figures: readonly FigureEntry[]) => setSections(name, [{ type: "figure", options: { figures } }]);
export { newFigure };

/** The figures on the laid-out pages, or on the quick sheet. */
export const pageFigures = (page: Page): Locator => page.locator('[data-testid="document-host"] [data-testid="figure"]');
export const quickFigures = (page: Page): Locator => page.locator('[data-testid="document-quick-box"] [data-testid="figure"]');

/** Each figure image's source, its region (parts), its decoded size and the caption under it, in order. */
export async function figureImages(page: Page, root: "host" | "quick" = "host") {
  return page.evaluate(async (box) => {
    const sel = box === "host" ? '[data-testid="document-host"]' : '[data-testid="document-quick-box"]';
    const imgs = [...document.querySelectorAll<HTMLImageElement>(`${sel} img[data-fig]`)];
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
    return imgs.map((i) => ({ src: i.getAttribute("src") ?? "", view: i.getAttribute("data-view"), width: i.naturalWidth, caption: i.closest("figure")?.querySelector("figcaption")?.textContent ?? "" }));
  }, root);
}

/** The SVG an image shows (its blob, without the region). */
export const svgOf = (page: Page, src: string) => page.evaluate(async (s) => (await fetch(s.split("#")[0]!)).text(), src);

/** The figure editor's entries in the right panel. */
export const figureEntries = (page: Page): Locator => page.getByTestId("figure-entry");

/** Waits until the stored document's Figure section holds `n` figures. */
export async function expectStoredFigures(name: string, n: number) {
  const { storedDocument } = await import("../slice-25/helpers");
  await expect.poll(async () => (((await storedDocument(name))!.sections.find((s) => s.type === "figure")?.options.figures as unknown[]) ?? []).length).toBe(n);
}
