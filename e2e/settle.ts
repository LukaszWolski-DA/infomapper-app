// The base of every fixture that reseeds (fix/write-after-reseed): before a test's pages close, and so before the next
// test's reseed, it waits until no save is on its way. A save still on its way when the next test reseeded wrote the
// earlier test's whole file over the fresh seed, or landed on the fresh seed itself (the seed's ids and versions are the
// same every time): S11-08 found S11-07's rename and names switch in PR 66's full run 44043914367
// (docs/known-limitations.md).
//
// "On its way" is what a page counts (leave-guard's `track`: the save chain and the canvas's queue, read through the
// test hook `window.__imSavesOnTheWay`) and every POST the default context has sent and not yet had answered (server
// actions outside the chain, the import's upload, the sign-in). No test's assertions change: the wait is after the test.

import { test as base, type BrowserContext, type Request } from "@playwright/test";

/** How long the wait may take before the test goes on anyway, with a warning (a save held on purpose and never let go). */
export const SETTLE_TIMEOUT_MS = 10_000;

/** The POST requests of a context still waiting for their answer. */
const posts = new WeakMap<BrowserContext, Set<Request>>();

function trackPosts(context: BrowserContext): void {
  if (posts.has(context)) return;
  const open = new Set<Request>();
  posts.set(context, open);
  context.on("request", (r) => {
    if (r.method() === "POST") open.add(r);
  });
  const done = (r: Request) => void open.delete(r);
  context.on("requestfinished", done);
  context.on("requestfailed", done);
}

/**
 * Whether a request's page is still open: a page the test closed itself (a closed tab, S14B) may never report its
 * requests' end, and nothing more can be waited for there.
 */
function openPage(r: Request): boolean {
  try {
    return !r.frame().page().isClosed();
  } catch {
    return false;
  }
}

/** The saves a page counts, or 0 for a page without the hook (not loaded, another site) or one that is closing. */
async function pageSaves(page: import("@playwright/test").Page): Promise<number> {
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
    for (const r of posts.get(context) ?? []) if (openPage(r)) n++;
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
