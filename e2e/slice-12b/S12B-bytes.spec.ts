// The thumbnails' bytes (slice 12b, step 4; step 2's answer), measurement build only (MEASURE=1
// MEASURE_BUILD=production; the normal e2e run leaves this file out). On "Performance test" and "Performance test – 20
// canvases" (`addManyCanvases`, the e2e data file only): the project home's document as the server sends it, split into
// the embedded RSC payload (`self.__next_f.push` scripts) and the rest, and the thumbnails' share of it (their `<svg>`
// markup, and how often each path's `d` occurs in the whole document: once in the markup, once more in the payload);
// then the answers to three writes on the home (a label's pin, the project's name, Undo), each a server action's
// RSC payload. Runs unchanged on `slice-12a` (no thumbnails there) for the A/B. Results printed and kept in
// .data/measure/s12b-bytes/<LABEL>-<time>.json.

import fs from "node:fs";
import path from "node:path";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { addManyCanvases, MANY_PROJECT_ID } from "../../scripts/lib/many-canvases";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { MEASURE_USE } from "../slice-01b/measure";
import { signInAs } from "../slice-00/helpers";
import type { Route } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";

test.use(MEASURE_USE);

const LABEL = process.env.LABEL ?? "branch";

const PAYLOAD = /<script>self\.__next_f\.push\([\s\S]*?\)<\/script>/g;
const THUMB = /<svg[^>]*data-testid="tile-thumbnail"[\s\S]*?<\/svg>/g;
const D = / d="([^"]+)"/g;

const bytes = (s: string) => Buffer.byteLength(s, "utf8");
const all = (s: string, re: RegExp) => [...s.matchAll(re)].map((m) => m[0]);
const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1;

/** The document's parts, and how many copies of the thumbnails' paths it holds. */
function documentParts(html: string) {
  const payload = all(html, PAYLOAD).reduce((n, s) => n + bytes(s), 0);
  const thumbs = all(html, THUMB);
  const ds = thumbs.flatMap((t) => [...t.matchAll(D)].map((m) => m[1]!));
  const copies = ds.length ? Math.min(...ds.map((d) => occurrences(html, d))) : 0;
  return { html: bytes(html), payload, rest: bytes(html) - payload, thumbnails: thumbs.length, thumbnailMarkup: thumbs.reduce((n, s) => n + bytes(s), 0), pathData: ds.reduce((n, d) => n + bytes(d), 0), copiesOfEachPath: copies, firstD: ds[0] ?? null };
}

/** Runs `act` and returns the body of the server action it sends (read on its way through a route, then passed on). */
async function answerOf(page: Page, act: () => Promise<void>, firstD: string | null) {
  let resolve!: (body: string) => void;
  const answered = new Promise<string>((r) => (resolve = r));
  const handler = async (route: Route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.fallback();
    const res = await route.fetch();
    const body = await res.body();
    await route.fulfill({ response: res, body });
    resolve(body.toString("utf8"));
  };
  await page.route("**/*", handler);
  await act();
  const body = await answered;
  await page.unroute("**/*", handler);
  return { bytes: bytes(body), copiesOfFirstPath: firstD ? occurrences(body, firstD) : 0 };
}

async function measure(page: Page, url: string) {
  const html = await (await page.request.get(url)).text();
  const doc = documentParts(html);
  await page.goto(url);
  await expect(page.getByTestId("button-back")).toBeEnabled(); // hydrated
  const pin = await answerOf(page, () => page.getByTestId("button-label-pin").first().click(), doc.firstD);
  await expect(page.getByTestId("button-label-pin").first()).toHaveAttribute("aria-pressed", "true");
  const name = page.getByTestId("field-project-name");
  const rename = await answerOf(page, async () => {
    await name.fill(`${await name.inputValue()} (renamed)`);
    await name.press("Enter");
  }, doc.firstD);
  await expect(page.getByTestId("text-project-name").or(name)).toBeVisible();
  const undo = await answerOf(page, () => page.getByTestId("button-undo").click(), doc.firstD);
  return { url, document: doc, writes: { pin, rename, undo } };
}

test("S12B-bytes: the project home's document and write answers on “Performance test” and its 20-canvas project", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(10 * 60_000);
  await signInAs(page, "Łukasz");
  const home = (p: string) => `/w/${LARGE_IDS.workspace}/p/${p}`;
  const results: Record<string, unknown> = {};
  await seedLargeData(E2E_DB);
  results.large = await measure(page, home(LARGE_IDS.project));
  await addManyCanvases(E2E_DB);
  results.many = await measure(page, home(MANY_PROJECT_ID));
  const out = { label: LABEL, browser: browser.version(), results };
  console.log(JSON.stringify(out, null, 2));
  const kept = path.resolve(".data", "measure", "s12b-bytes", `${LABEL}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  fs.writeFileSync(kept, JSON.stringify(out, null, 2));
});
