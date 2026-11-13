// Slice 26's helpers: the editor's panels, its section rows and the preview's state (its layouts, the tree's builds,
// what it shows), and a probe of what the preview shows while a layout runs.

import { expect, type Locator, type Page } from "@playwright/test";
import { laidOut } from "../slice-25/helpers";

export * from "../slice-25/helpers";

/** A section's row on the left, by its id. */
export const sectionRow = (page: Page, id: string): Locator => page.locator(`[data-testid="editor-section"][data-section-id="${id}"]`);
/** A section's row on the left, by its type (the first one). */
export const rowOfType = (page: Page, type: string): Locator => page.locator(`[data-testid="editor-section"][data-section="${type}"]`).first();

export const preview = (page: Page) => page.getByTestId("document-pages");
/** The preview's completed layouts in this page. */
export const layouts = async (page: Page) => Number(await preview(page).getAttribute("data-layouts"));
/** The content tree's builds in this page. */
export const builds = async (page: Page) => Number(await page.getByTestId("text-build-ms").getAttribute("data-builds"));
/** What the preview shows: "pages", "quick" or "none". */
export const shown = (page: Page) => preview(page).getAttribute("data-shown");

/** Opens a document's editor and waits for its first pages. */
export async function openEditor(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  return laidOut(page);
}

/** Waits until the preview has `n` layouts and shows real pages again. */
export async function expectLayouts(page: Page, n: number) {
  await expect(preview(page)).toHaveAttribute("data-layouts", String(n), { timeout: 30_000 });
  await expect(preview(page)).toHaveAttribute("data-state", "done");
}

/** Sets Auto's threshold before the page loads (the test hook `window.__imDocLayoutMs`). */
export const setThreshold = (page: Page, ms: number) => page.addInitScript((v) => ((window as unknown as { __imDocLayoutMs: number }).__imDocLayoutMs = v), ms);

/**
 * A probe installed before the page loads: while a layout runs (the preview's `data-state` "laying"), every change of
 * what is shown records how many laid-out pages and quick sheets are visible; read with `whileLaying`.
 */
export const probeWhileLaying = (page: Page) =>
  page.addInitScript(() => {
    const seen: { pages: number; quick: number }[] = [];
    (window as unknown as { __imWhileLaying: typeof seen }).__imWhileLaying = seen;
    const look = () => {
      const box = document.querySelector('[data-testid="document-pages"]');
      if (box?.getAttribute("data-state") !== "laying") return;
      const host = document.querySelector('[data-testid="document-host"]') as HTMLElement | null;
      const quick = document.querySelector('[data-testid="document-quick-box"]') as HTMLElement | null;
      seen.push({ pages: host && !host.hidden ? host.querySelectorAll(".pagedjs_page").length : 0, quick: quick && !quick.hidden ? quick.querySelectorAll(".dsheet").length : 0 });
    };
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "hidden"] }));
  });
export const whileLaying = (page: Page) => page.evaluate(() => (window as unknown as { __imWhileLaying: { pages: number; quick: number }[] }).__imWhileLaying);

/** A probe of the tree's builds: the time of each (`performance.now()`), read with `buildTimes`. */
export const probeBuilds = (page: Page) =>
  page.addInitScript(() => {
    const times: number[] = [];
    (window as unknown as { __imBuilds: number[] }).__imBuilds = times;
    document.addEventListener("DOMContentLoaded", () =>
      new MutationObserver((list) => {
        for (const m of list) if (m.attributeName === "data-builds") times.push(performance.now());
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-builds"] }),
    );
  });
export const buildTimes = (page: Page) => page.evaluate(() => (window as unknown as { __imBuilds: number[] }).__imBuilds.slice());
