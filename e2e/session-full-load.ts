// fix/blank-page-after-sign-in: what a form that changes the session must do after its answer, read in a test. The next
// page is a new document (a marker set on the old one is gone) and the router never asks for the landing page's RSC
// payload; the landing page is asked for once, as a document. Used by `e2e/fixes/session-change-full-load.spec.ts`
// (local adapter) and `e2e/slice-29/fix-smoke-session-full-load.spec.ts` (Postgres).
import { expect, type Page, type Request } from "@playwright/test";

const MARK = "__imBeforeSessionChange";

/** Marks the page shown now and starts recording the requests that follow; call it once the form is filled. */
export async function watchSessionChange(page: Page) {
  await page.evaluate((mark) => {
    (window as unknown as Record<string, boolean>)[mark] = true;
  }, MARK);
  const requests: { path: string; rsc: boolean; document: boolean }[] = [];
  const onRequest = (r: Request) => {
    if (r.method() !== "GET") return;
    const rsc = r.headers()["rsc"] === "1" && !r.headers()["next-router-prefetch"];
    const document = r.resourceType() === "document";
    if (rsc || document) requests.push({ path: new URL(r.url()).pathname, rsc, document });
  };
  page.on("request", onRequest);
  return {
    /** Waits for the landing page (the top bar), then checks it came by a full load. */
    async expectFullLoad(landing: RegExp) {
      await expect(page).toHaveURL(landing);
      await expect(page.getByTestId("bar-top")).toBeVisible();
      const path = new URL(page.url()).pathname;
      const marked = await page.evaluate((mark) => (window as unknown as Record<string, unknown>)[mark] ?? null, MARK);
      page.off("request", onRequest);
      const toLanding = requests.filter((r) => r.path === path);
      expect({ marked, rscRequests: toLanding.filter((r) => r.rsc).length, documentRequests: toLanding.filter((r) => r.document).length }).toEqual({
        marked: null,
        rscRequests: 0,
        documentRequests: 1,
      });
    },
  };
}

/**
 * Waits until the page a session's form landed on can be used: its top bar shown and hydrated (Back enabled, as slice 9's
 * `hydrated`). Since the full page load, the top bar is drawn by the server before the page's code runs, so a click
 * right after it may go nowhere (S33-04's switcher, fix/blank-page-after-sign-in).
 */
export async function landed(page: Page) {
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(page.getByTestId("button-back")).toBeEnabled();
}
