// S6A-08 (slice 6a, section 6): a chip appearing or going adds no canvas and no miniature commit to those of the switch
// it follows, and a chip's × costs no more commits than its switch: Focus (none, either way), resolved notes hidden, a
// tool, collapsed frames. Counted in development (`__imCanvasCommits`, `__imMiniatureCommits`) once the page is quiet.

import { expect, test, type Page } from "./fixtures";
import { AROUND, canvasUrl, chip, chipOff, collapsedFrame, counters, openCanvas, signInAs, WHOLE_CO } from "./helpers";

/** The canvas and miniature commits one action adds, once the page is quiet again. */
async function commitsOf(page: Page, act: () => Promise<void>): Promise<{ canvas: number; miniature: number }> {
  await page.waitForTimeout(400);
  const before = await counters(page);
  await act();
  await page.waitForTimeout(600);
  const after = await counters(page);
  return { canvas: after.canvas - before.canvas, miniature: after.miniature - before.miniature };
}

test("S6A-08: chips add no canvas or miniature commit; a × costs what its switch costs", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  // Focus: neither way commits the canvas or the miniature (slice 4b-1); its chip changes nothing in that
  const focusOn = await commitsOf(page, async () => {
    await page.getByTestId("button-focus").click();
    await expect(chip(page, "focus")).toBeVisible();
  });
  expect(focusOn).toEqual({ canvas: 0, miniature: 0 });
  const focusOff = await commitsOf(page, async () => {
    await chipOff(page, "focus").click();
    await expect(chip(page, "focus")).toHaveCount(0);
  });
  expect(focusOff).toEqual({ canvas: 0, miniature: 0 });

  // resolved notes hidden and a tool: the × costs what turning it off with its own control costs
  const cases = [
    { id: "notes-hidden", on: () => page.getByTestId("checkbox-show-resolved").uncheck(), off: () => page.getByTestId("checkbox-show-resolved").check() },
    { id: "tool", on: () => page.getByTestId("button-tool-hand").click(), off: () => page.getByTestId("button-tool-hand").click() },
  ];
  for (const { id, on, off } of cases) {
    await on();
    await expect(chip(page, id)).toBeVisible();
    const bySwitch = await commitsOf(page, async () => {
      await off();
      await expect(chip(page, id)).toHaveCount(0);
    });
    await on();
    await expect(chip(page, id)).toBeVisible();
    const byChip = await commitsOf(page, async () => {
      await chipOff(page, id).click();
      await expect(chip(page, id)).toHaveCount(0);
    });
    expect(byChip.canvas, id).toBeLessThanOrEqual(bySwitch.canvas);
    expect(byChip.miniature, id).toBeLessThanOrEqual(bySwitch.miniature);
  }
});

test("S6A-08: a collapsed frame's chip × costs what “Expand all” costs", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Kasia Zielińska"); // a reader: in the tab only, nothing saved, no fresh page in between
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const bySwitch = await commitsOf(page, async () => {
    await page.getByTestId("button-frames-expand-all").click();
    await expect(chip(page, "collapsed-frames")).toHaveCount(0);
  });
  await page.getByTestId("button-frames-collapse-all").click();
  await expect(chip(page, "collapsed-frames")).toBeVisible();
  const byChip = await commitsOf(page, async () => {
    await chipOff(page, "collapsed-frames").click();
    await expect(chip(page, "collapsed-frames")).toHaveCount(0);
  });
  expect(byChip.canvas).toBeLessThanOrEqual(bySwitch.canvas);
  expect(byChip.miniature).toBeLessThanOrEqual(bySwitch.miniature);
});

test("S6A-08: a chip folding into “+{n}” and coming back adds no canvas or miniature commit", async ({ page }) => {
  // the default 1,280 px window: with three chips on, Focus's chip pushes the last one into “+{n}”
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await page.getByTestId("button-tool-hand").click();
  await expect(page.getByTestId("button-view-show-all")).toBeVisible();
  const folded = async () => ((await chip(page, "more").count()) ? Number((await chip(page, "more").innerText()).slice(1)) : 0);
  const before = await folded();
  const on = await commitsOf(page, async () => {
    await page.getByTestId("button-focus").click();
    await expect(chip(page, "focus")).toBeVisible();
    await expect.poll(folded).toBe(before + 1);
  });
  expect(on).toEqual({ canvas: 0, miniature: 0 });
  const off = await commitsOf(page, async () => {
    await chipOff(page, "focus").click();
    await expect(chip(page, "focus")).toHaveCount(0);
    await expect.poll(folded).toBe(before);
  });
  expect(off).toEqual({ canvas: 0, miniature: 0 });
});
