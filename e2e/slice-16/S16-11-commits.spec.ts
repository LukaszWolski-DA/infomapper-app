// S16-11's commit bars (slice 16, PRD section 6 as answered: one canvas commit per switch of a relationship kind; one
// miniature commit for "Between entities", which the miniature draws, none for "Between source tables"; the layer switch
// beside them in the same sitting). The counters exist only in development (`__imCanvasCommits`, `__imMiniatureCommits`),
// so this runs on the e2e dev server, on demand. Each switch's answer from the server is held for 2 s, so the switch's
// own commits (read after 1 s) are told apart from the fresh page's that follow its answer, as S11-13-commits does.
// "Performance test" with 20 source relationships (e2e data file only), S6A-09's two views, ROUNDS balanced rounds
// (default 3). Results in test-results/S16-11-commits.json.
//
//   COMMITS=1 npx playwright test e2e/slice-16/S16-11-commits.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { resetDevData, seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { LARGE_URL } from "../slice-01b/measure";
import { settledCommits } from "../slice-10a/helpers";
import { expect, test } from "./fixtures";
import { signInAs } from "./helpers";
import { drawn, openTabMenu, SWITCHES, twentySourceKeys, views, type Kind, type View } from "./measure";

test.skip(!process.env.COMMITS, "a measurement: COMMITS=1");

const ROUNDS = Number(process.env.ROUNDS ?? 3);
const HOLD_MS = 2000;

const counters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0 };
  });

async function open(page: Page, view: View) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await openTabMenu(page);
  await settledCommits(page, async (p) => (await counters(p)).canvas);
}

test("S16-11 commits: the two relationship kinds against the layer switch, their own commits and the fresh page's", async ({ page }) => {
  test.setTimeout(40 * 60_000);
  await resetDevData(E2E_DB);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  let hold = false;
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (hold && r.method() === "POST" && r.headers()["next-action"]) {
      const response = await route.fetch();
      await new Promise((done) => setTimeout(done, HOLD_MS));
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const keys = await twentySourceKeys(pane);

  type Counts = { canvas: number; miniature: number };
  const results: Record<string, { own: Counts; page: Counts }[]> = {};
  const lines: Record<string, unknown> = {};
  for (const [name, view] of Object.entries(views(pane))) {
    await open(page, view);
    lines[name] = await drawn(page);
    for (let round = 0; round < ROUNDS; round++) {
      const order: Kind[] = round % 2 === 0 ? ["entities", "sources", "layer"] : ["layer", "sources", "entities"];
      for (const kind of order) {
        await open(page, view);
        for (const dir of ["on", "off"] as const) {
          const before = await counters(page);
          hold = true;
          await page.locator(SWITCHES[kind][dir].click).click();
          await page.locator(SWITCHES[kind][dir].done).waitFor();
          await page.waitForTimeout(1000);
          const own = await counters(page);
          hold = false;
          await page.waitForTimeout(HOLD_MS);
          await settledCommits(page, async (p) => (await counters(p)).canvas);
          const after = await counters(page);
          (results[`${name} · ${kind} ${dir}`] ??= []).push({
            own: { canvas: own.canvas - before.canvas, miniature: own.miniature - before.miniature },
            page: { canvas: after.canvas - own.canvas, miniature: after.miniature - own.miniature },
          });
        }
      }
    }
  }
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S16-11-commits.json", JSON.stringify({ rounds: ROUNDS, holdMs: HOLD_MS, keys, pane, lines, results }, null, 2));
  console.log(`S16-11 commits: ${JSON.stringify({ lines, results })}`);
});
