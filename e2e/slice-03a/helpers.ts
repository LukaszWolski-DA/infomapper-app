// Slice 3a's steps, on top of slice 2c's: the demo working layer from the e2e data file (labels, links, pins, notes),
// the Labels field and the note on the page, and test data made through the domain.

import { readDb } from "../../src/data/local/file";
import { deleteLabel } from "../../src/domain/commands/label";
import { E2E_DB } from "../config";
import type { Locator, Page } from "@playwright/test";
import { asUser, box, CO, RETAIL, SEED_IDS, store, type Pt } from "../slice-02c/helpers";

export * from "../slice-02c/helpers";

/** Customer & orders at 45 %: every card and the demo notes in view. */
export const WHOLE_CO = { x: 10, y: 10, zoom: 0.45 };

export const loadLabels = () => store().labels.list(RETAIL);
export const loadLinks = () => store().labels.listLinks(RETAIL);
export const loadPins = () => store().labels.listPins(RETAIL);
export const loadNotes = (canvasId: string = CO) => store().notes.listOfCanvas(RETAIL, canvasId);
/** Every row of the e2e data file, deleted ones included. */
export const rawDb = () => readDb(E2E_DB);

export const labelNamed = async (name: string) => (await loadLabels()).find((l) => l.name === name);
export const noteWithText = async (start: string, canvasId: string = CO) => (await loadNotes(canvasId)).find((n) => (n.body_text ?? "").startsWith(start));

/** The demo notes' texts (seed-working-layer.ts). */
export const DEMO_NOTES = {
  free: "Order lines come from ERP once a night.",
  pinned: "Which order statuses count as confirmed?",
  resolved: "order_line.disc is a percentage",
} as const;

/** Test data: a label deleted by Anna (modeler), with its links. */
export async function removeLabel(name: string): Promise<void> {
  const label = (await labelNamed(name))!;
  const links = (await loadLinks()).filter((k) => k.label_id === label.id);
  const pins = (await loadPins()).filter((p) => p.label_id === label.id);
  await asUser(SEED_IDS.userAnna, (ctx, access) => deleteLabel(ctx, access, { label, links, pins }, { labelId: label.id, expectedVersion: label.version }));
}

/** The Labels field of the right panel. */
export const labelsField = (page: Page) => page.getByTestId("field-labels");
export const chipNames = (page: Page) => labelsField(page).getByTestId("chip-label").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.label));

/** Types into the Labels field (focused first). */
export async function typeLabel(page: Page, text: string) {
  const input = labelsField(page).getByTestId("input-label");
  await input.click();
  await input.fill(text);
}

/** A note on the page by the start of its text. */
export const noteEl = (page: Page, text: string): Locator => page.getByTestId("note").filter({ hasText: text });

/** A point on a note's body, away from its ✓ and its edge. */
export async function notePoint(page: Page, text: string): Promise<Pt> {
  const b = await box(noteEl(page, text));
  return { x: b.x + Math.min(60, b.width / 3), y: b.y + b.height / 2 };
}

/** Undo with the top bar's button, once it is enabled. */
export async function undo(page: Page) {
  const button = page.getByTestId("button-undo");
  await button.click();
}

