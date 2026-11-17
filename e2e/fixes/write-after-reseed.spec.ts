import type { Page, Route } from "@playwright/test";
import { expect, test } from "../slice-11/fixtures";
import { canvasRow, canvasUrl, entityBox, FULL, hydrated, openCanvas, signInAs } from "../slice-11/helpers";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { settleSaves } from "../settle";

// fix/write-after-reseed (S11-08 failed in PR 66's full run 44043914367, known-limitations.md): a save still on its way
// when the next test reseeded wrote over the fresh seed. Variant B: the request reaches the server only after the
// reseed, and lands on the fresh seed, whose ids and versions are the same every time, so no version check refuses it.
// The names switch's request is held before it reaches the server and let go by the test (no timing luck).

/** Holds the names switch's request (to entity aliases) before it reaches the server, until `release`. */
async function holdNamesSwitch(page: Page) {
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let answered!: () => void;
  const given = new Promise<void>((done) => (answered = done));
  await page.route("**/*", async (route: Route) => {
    const r = route.request();
    if (!held && r.method() === "POST" && r.headers()["next-action"] && (r.postData() ?? "").includes('"mode":"alias"')) {
      held = true;
      await gate;
      const response = await route.fetch();
      await route.fulfill({ response }).catch(() => {});
      answered();
    } else await route.continue().catch(() => {});
  });
  return { held: () => held, release, given };
}

async function switchHeld(page: Page) {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  const hold = await holdNamesSwitch(page);
  await entityBox(page).click();
  await expect.poll(() => hold.held()).toBe(true);
  return hold;
}

test("without the wait, a names switch let through after a reseed lands on the fresh seed (variant B)", async ({ page }) => {
  const hold = await switchHeld(page);
  await resetDevData(E2E_DB); // the next test's reseed
  expect((await canvasRow()).entity_names).toBeNull();
  hold.release();
  await hold.given;
  // the earlier test's write is in the next test's data: what the fixture's wait prevents
  expect((await canvasRow()).entity_names).toBe("alias");
});

test("the fixtures' wait lasts until the save's answer, so the next reseed comes after the write", async ({ page, context }) => {
  const hold = await switchHeld(page);
  let answeredAt = 0;
  void hold.given.then(() => (answeredAt = performance.now()));
  const settling = settleSaves(context).then((settled) => ({ settled, at: performance.now() }));
  // the page counts the save while its request is held (on the save chain, which holds the canvas's row, and on the
  // canvas's queue: both track it)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __imSavesOnTheWay: () => number }).__imSavesOnTheWay())).toBeGreaterThan(0);
  hold.release();
  const { settled, at } = await settling;
  expect(settled).toBe(true);
  expect(answeredAt).toBeGreaterThan(0);
  expect(answeredAt).toBeLessThanOrEqual(at);
  expect((await canvasRow()).entity_names).toBe("alias");
  // the reseed now finds nothing on its way: the fresh seed stays fresh
  await resetDevData(E2E_DB);
  expect(await page.evaluate(() => (window as unknown as { __imSavesOnTheWay: () => number }).__imSavesOnTheWay())).toBe(0);
  expect((await canvasRow()).entity_names).toBeNull();
});
