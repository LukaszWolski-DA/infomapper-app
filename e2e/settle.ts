// The base of every fixture that reseeds (fix/write-after-reseed): before a test's pages close, and so before the next
// test's reseed, it waits until no save is on its way. A save still on its way when the next test reseeded wrote the
// earlier test's whole file over the fresh seed, or landed on the fresh seed itself (the seed's ids and versions are the
// same every time): S11-08 found S11-07's rename and names switch in PR 66's full run 44043914367
// (docs/known-limitations.md).
//
// "On its way" is what a page counts (leave-guard's `track`: the save chain and the canvas's queue, read through the
// test hook `window.__imSavesOnTheWay`) and every POST the default context has sent and not yet had answered (server
// actions outside the chain, the import's upload, the sign-in), until its page has loaded a new document: the browser
// abandons a request of the document it leaves, and Playwright never reports that request's end (a sign-in as another
// person or a `page.goto` right after a save, in S3B-02, S3B-12, S25-02 and others). No test's assertions change: the
// wait is after the test.

import { test as base, type BrowserContext, type Page, type Request } from "@playwright/test";

/** How long the wait may take before the test goes on anyway, with a warning (a save held on purpose and never let go). */
export const SETTLE_TIMEOUT_MS = 10_000;

/** The POST requests of a context still waiting for their answer. */
const posts = new WeakMap<BrowserContext, Set<Request>>();
/** How many documents each page has loaded (`domcontentloaded`; a Next.js navigation inside the app is no new document). */
const documents = new WeakMap<Page, number>();
/** The page's document count when each POST started. */
const sentFrom = new WeakMap<Request, number>();

function trackPosts(context: BrowserContext): void {
  if (posts.has(context)) return;
  const open = new Set<Request>();
  posts.set(context, open);
  const watch = (page: Page) => page.on("domcontentloaded", () => documents.set(page, (documents.get(page) ?? 0) + 1));
  for (const page of context.pages()) watch(page);
  context.on("page", watch);
  context.on("request", (r) => {
    if (r.method() !== "POST") return;
    open.add(r);
    const page = pageOf(r);
    if (page) sentFrom.set(r, documents.get(page) ?? 0);
  });
  const done = (r: Request) => void open.delete(r);
  context.on("requestfinished", done);
  context.on("requestfailed", done);
}

function pageOf(r: Request): Page | null {
  try {
    return r.frame().page();
  } catch {
    return null;
  }
}

/**
 * Whether a request still counts: its page is open (a page the test closed itself, a closed tab in S14B, may never
 * report its requests' end) and has loaded no new document since the request started (the browser abandoned it with the
 * document it left; the server may still be handling it for a moment, docs/known-limitations.md).
 */
function stillOpen(r: Request): boolean {
  const page = pageOf(r);
  if (!page || page.isClosed()) return false;
  return (documents.get(page) ?? 0) === (sentFrom.get(r) ?? 0);
}

/** The saves a page counts, or 0 for a page without the hook (not loaded, another site) or one that is closing. */
async function pageSaves(page: Page): Promise<number> {
  if (page.isClosed()) return 0;
  try {
    return await page.evaluate(() => (window as unknown as { __imSavesOnTheWay?: () => number }).__imSavesOnTheWay?.() ?? 0);
  } catch {
    // a page in the middle of a navigation: ask again
    return page.isClosed() ? 0 : 1;
  }
}

/** How many saves the open pages of these contexts have on their way, and the requests the tracked ones have open. */
async function onTheWay(contexts: readonly BrowserContext[]): Promise<number> {
  let n = 0;
  for (const context of contexts) {
    for (const r of posts.get(context) ?? []) if (stillOpen(r)) n++;
    for (const page of context.pages()) n += await pageSaves(page);
  }
  return n;
}

/**
 * Waits until nothing is on its way in `context` and in every other open context of its browser (a test's second
 * person), twice in a row a frame apart; a later save the first answer starts (the chain's next one) counts as soon as
 * it is queued. Answers whether everything settled within `timeout`.
 */
export async function settleSaves(context: BrowserContext, timeout = SETTLE_TIMEOUT_MS): Promise<boolean> {
  const contexts = () => {
    const all = context.browser()?.contexts() ?? [];
    return all.includes(context) ? all : [context, ...all];
  };
  const until = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < until) {
    quiet = (await onTheWay(contexts())) === 0 ? quiet + 1 : 0;
    if (quiet >= 2) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

export const test = base.extend<{ settledSaves: void }>({
  settledSaves: [
    async ({ context }, use, testInfo) => {
      trackPosts(context);
      await use();
      if (!(await settleSaves(context))) console.warn(`[settle] ${testInfo.titlePath.join(" › ")}: a save was still on its way after ${SETTLE_TIMEOUT_MS} ms`);
    },
    { auto: true },
  ],
});
