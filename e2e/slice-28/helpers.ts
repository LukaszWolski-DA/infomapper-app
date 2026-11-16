// Slice 28's helpers: slice 27's (26's, 25's), and the editor's panels shown or hidden, their widths, the preview's
// scale, and the Document panel's folds (`openFold` is slice 25's, used by the earlier specs too).

import { expect, type Locator, type Page } from "@playwright/test";
import { DEMO_DOCUMENT_NAMES, formUrl, openEditor, storedDocument } from "../slice-27/helpers";

export * from "../slice-27/helpers";

export const sectionsToggle = (page: Page): Locator => page.getByTestId("button-toggle-sections");
export const optionsToggle = (page: Page): Locator => page.getByTestId("button-toggle-options");
/** A panel's width on the screen, in whole px. */
export const widthOf = (page: Page, id: "editor-left" | "editor-right") => page.getByTestId(id).evaluate((el) => Math.round(el.getBoundingClientRect().width));
/** Whether a panel is `inert`. */
export const inertOf = (page: Page, id: "editor-left" | "editor-right") => page.getByTestId(id).evaluate((el) => (el as HTMLElement).inert);
/** The zoom the shown pages are drawn at ("Fit width"). */
export const zoomOf = (page: Page) => page.getByTestId("document-host").evaluate((el) => Number((el as HTMLElement).style.zoom));
/** The editor's cookie's value for this browser. */
export const panelsCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name.startsWith("im-doc-panels."))?.value;

/** Opens a demo document's editor by its name and waits for its first pages; answers its stored definition. */
export async function openDocument(page: Page, name: string = DEMO_DOCUMENT_NAMES.s2t) {
  const doc = (await storedDocument(name))!;
  await openEditor(page, formUrl(doc.id));
  return doc;
}

/** A shown panel: its width, not inert, its handle there; a hidden one: 0 wide, inert, no handle. */
export async function expectPanel(page: Page, side: "left" | "right", shown: boolean, width?: number) {
  const id = side === "left" ? "editor-left" : "editor-right";
  const toggle = side === "left" ? sectionsToggle(page) : optionsToggle(page);
  await expect(toggle).toHaveAttribute("aria-pressed", String(shown));
  await expect(page.getByTestId(id)).toHaveAttribute("data-shown", String(shown));
  await expect.poll(() => inertOf(page, id)).toBe(!shown);
  if (shown) {
    await expect(page.getByTestId(`handle-${side}`)).toBeVisible();
    if (width !== undefined) await expect.poll(() => widthOf(page, id)).toBe(width);
  } else {
    await expect(page.getByTestId(`handle-${side}`)).toBeHidden();
    await expect.poll(() => widthOf(page, id)).toBe(0);
  }
}
