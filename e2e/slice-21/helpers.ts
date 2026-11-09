// Slice 21's helpers: the earlier slices' (15d's chain, which reaches slice 1b's), and a few of slice 17's and 12a's.

import type { Locator, Page } from "@playwright/test";
import { store } from "../slice-01a/helpers";
import { RETAIL } from "../slice-01a/helpers";

export * from "../slice-15d/helpers";
export { conceptPicker, entitiesNamed, expectConceptPicker } from "../slice-17/helpers";
export { redoButton, undoButton } from "../slice-12a/helpers";
export { archive } from "../slice-07a/helpers";

/** The concept picker's create item (slice 21, `picker-create`). */
export const createItem = (picker: Locator) => picker.getByTestId("picker-create");

/** The workspace's concepts in the e2e data file, deleted ones too. */
export async function conceptsRaw() {
  return (await store().model.load(RETAIL)).concepts;
}
export const liveConceptNamed = async (name: string) => (await conceptsRaw()).find((c) => c.name === name && c.deleted_at === null);

/** The "Concept colours" line of a concept in the settings, and its swatch of a colour. */
export const colourLine = (page: Page, concept: string) => page.getByTestId("box-concept-colours").locator(`[data-testid="concept-colour"][data-concept="${concept}"]`);
export const swatch = (page: Page, concept: string, colour: string) => colourLine(page, concept).locator(`button[data-colour="${colour}"]`);
