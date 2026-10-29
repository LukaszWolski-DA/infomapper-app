// Slice 9's steps: every toast a page shows, recorded from its first paint (`recordToasts`, `toasts`), a row's change
// groups in the e2e data file (`groupsOf`), and the panels' fields by test id. Saves are started without waiting for
// the page: the point of step 2 is that a second save does not need to.

import { expect, type Page } from "@playwright/test";
import { RETAIL, SEED_IDS, store } from "../slice-01b/helpers";

export * from "../slice-01b/helpers";
export { openRequirement, requirementByKey } from "../slice-04a/helpers";
export { loadNotes, undo } from "../slice-03a/helpers";
export { archive } from "../slice-07a/helpers";

/** Records every toast message the page shows into `window.__imToasts`; call before the page is opened. */
export async function recordToasts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __imToasts: string[] }).__imToasts = seen;
    let last: string | null = null;
    new MutationObserver(() => {
      const text = document.querySelector('[data-testid="toast"][data-visible="true"] [data-testid="toast-message"]')?.textContent ?? null;
      if (text && text !== last) seen.push(text);
      last = text;
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

/** The toasts the page has shown since it was opened. */
export const toasts = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __imToasts?: string[] }).__imToasts ?? []);

/** The change groups that wrote a row, oldest first, with each one's after-image of it. */
export async function groupsOf(objectId: string): Promise<{ group: string; after: Record<string, unknown> | null }[]> {
  const events = (await store().changeEvents.list(RETAIL)).filter((e) => e.object_id === objectId);
  return events.map((e) => ({ group: e.change_group_id, after: e.after_image as Record<string, unknown> | null }));
}

export const STALE = "Someone changed this meanwhile. Reload to see the latest version.";

// ---- the project home (step 3, D-59) ----

/** Customer 360's home, and the project in the e2e data file. */
export const C360 = SEED_IDS.projCustomer360;
export const projectHome = (projectId: string = C360) => `/w/${RETAIL}/p/${projectId}`;
export const loadProject = async (projectId: string = C360) => (await store().projects.get(RETAIL, projectId))!;

/**
 * Waits until the page is hydrated: Back is enabled only from the client (`history-nav.tsx`; every spec signs in first,
 * so there is a page to go back to). Typing before it can lose a field's selection (S9-07: `fill("")` deleted one letter).
 */
export const hydrated = (page: Page) => expect(page.getByTestId("button-back")).toBeEnabled();
