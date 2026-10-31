// S11-13's commit bars (slice 11, PRD section 6): one canvas commit and no miniature commit for a switch of “Attribute
// aliases”, against the layer switch in the same sitting. The counters exist only in development (`__imCanvasCommits`,
// `__imMiniatureCommits`), so this runs on the e2e dev server, on demand. Each switch's answer from the server is held
// for 2 s, so the switch's own commits (read after 1 s) are told apart from the fresh page's that follow its answer
// (read once the counters settle), which every saved switch has. “Performance test” with an alias on every entity and
// attribute (e2e data file only), both of S6A-09's views, ROUNDS balanced rounds (default 3). Results in
// test-results/S11-13-commits.json.
//
//   COMMITS=1 npx playwright test e2e/slice-11/S11-13-commits.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { LARGE_URL } from "../slice-01b/measure";
import { expect, test } from "./fixtures";
import { settledCommits, signInAs } from "./helpers";
import { aliasEverything, views, type View } from "./measure";

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
  await settledCommits(page, async (p) => (await counters(p)).canvas);
}

test("S11-13 commits: a switch of “Attribute aliases” against the layer switch, its own commits and the fresh page's", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  const aliased = await aliasEverything();
  await signInAs(page, "Łukasz");
  // every server action's answer held for HOLD_MS while `hold` is on
  let hold = false;
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (hold && r.method() === "POST" && r.headers()["next-action"]) {
      const response = await route.fetch();
      await new Promise((done) => setTimeout(done, HOLD_MS));
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));

  const switches = {
    names: { on: () => page.getByTestId("check-attribute-aliases").click(), off: () => page.getByTestId("check-attribute-aliases").click() },
    layer: { on: () => page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click(), off: () => page.locator('[data-testid="switch-layer"] [data-layer="all"]').click() },
  };
  type Counts = { canvas: number; miniature: number };
  const results: Record<string, { own: Counts; page: Counts }[]> = {};
  for (const [name, view] of Object.entries(views(pane))) {
    for (let round = 0; round < ROUNDS; round++) {
      const order = (round % 2 === 0 ? ["names", "layer"] : ["layer", "names"]) as (keyof typeof switches)[];
      for (const kind of order) {
        await open(page, view);
        for (const dir of ["on", "off"] as const) {
          const before = await counters(page);
          hold = true;
          await switches[kind][dir]();
          await page.waitForTimeout(1000);
          const own = await counters(page);
          hold = false;
          await page.waitForTimeout(HOLD_MS);
          await settledCommits(page, async (p) => (await counters(p)).canvas);
          const after = await counters(page);
          const key = `${name} · ${kind} ${dir}`;
          (results[key] ??= []).push({
            own: { canvas: own.canvas - before.canvas, miniature: own.miniature - before.miniature },
            page: { canvas: after.canvas - own.canvas, miniature: after.miniature - own.miniature },
          });
        }
      }
    }
  }
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S11-13-commits.json", JSON.stringify({ rounds: ROUNDS, holdMs: HOLD_MS, aliased, pane, results }, null, 2));
  console.log(`S11-13 commits: ${JSON.stringify(results)}`);
});
