// S6A-10 (slice 6a, items 9–11; Łukasz's step 1 answer 7; rewritten in slice 38, step 2): the top bar and the canvas
// toolbar on Customer & orders, as Łukasz (every tool) with the working context on (its widest state), both panels shown,
// at 2,560, 2,100, 1,880, 1,600, 1,536, 1,300, 1,201, 1,200, 1,101, 1,100, 1,000 and 800 px: no control reaches past
// the bar or under another, nothing scrolls; both panel buttons, the working context, Undo and Redo, the save pair and
// the user indicator are always in the top bar, the brand only above 1,600 px. Since slice 38 the canvas's controls
// are in its toolbar: the layer switch and zoom always, the other groups either in the toolbar or in “More” (by the
// toolbar's own room, S38-01), and the toolbar never scrolls. The measured widths are printed (the step's table).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, signInAs, WHOLE_CO } from "./helpers";

const WIDTHS = [2560, 2100, 1880, 1600, 1536, 1300, 1201, 1200, 1101, 1100, 1000, 800];
const ALWAYS = ["button-toggle-left", "button-context", "group-undo", "group-save", "button-toggle-right", "indicator-user"];
const TOOLBAR_ALWAYS = ["switch-layer", "group-zoom"];
const TOOLBAR_GROUPS = ["button-focus", "button-changes", "button-tool-hand", "button-tool-entity", "button-tool-note", "button-tool-frame", "switch-notation", "button-names"];

/** The bar's shown controls with their boxes, whether one reaches past the bar or overlaps the next, and the scroll. */
const barState = (page: Page) =>
  page.getByTestId("bar-top").evaluate((bar) => {
    const b = bar.getBoundingClientRect();
    const shown = [...bar.querySelectorAll<HTMLElement>("[data-testid]")].filter(
      (e) => e.offsetParent !== null && e.getClientRects().length > 0 && !e.parentElement?.closest("[data-testid^='group-'],[data-testid^='switch-'],[data-testid='indicator-user'],[data-testid^='switcher-']") && e.getAttribute("data-testid") !== "bar-tools",
    );
    const boxes = shown.map((e) => ({ id: e.getAttribute("data-testid")!, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: Math.round(e.getBoundingClientRect().width) }));
    const sorted = [...boxes].sort((x, y) => x.left - y.left);
    return {
      ids: boxes.map((x) => x.id),
      widths: Object.fromEntries(boxes.map((x) => [x.id, x.width])),
      outside: boxes.filter((x) => x.left < b.left - 0.5 || x.right > b.right + 0.5).map((x) => x.id),
      overlapping: sorted.slice(1).filter((x, i) => x.left < sorted[i]!.right - 0.5).map((x) => x.id),
      scroll: bar.scrollWidth - bar.clientWidth,
      brand: getComputedStyle(bar.querySelector("b")!.parentElement!).display !== "none",
    };
  });

/** The canvas toolbar's shown controls and whether it scrolls (slice 38). */
const toolbarState = (page: Page) =>
  page.getByTestId("bar-canvas").evaluate((bar) => ({
    ids: [...bar.querySelectorAll<HTMLElement>("[data-testid]")].filter((e) => e.getClientRects().length > 0).map((e) => e.getAttribute("data-testid")!),
    scroll: bar.scrollWidth - bar.clientWidth,
    width: Math.round(bar.getBoundingClientRect().width),
  }));

/** Customer & orders as Łukasz with the working context on, at 2,560 px. */
async function openWide(page: Page) {
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await page.setViewportSize({ width: 2560, height: 900 });
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("button-context")).toContainText("Working on CR-23");
}

test("S6A-10: nothing in the top bar or the canvas toolbar is cut off from 2,560 to 800 px; what does not fit the toolbar is in “More”", async ({ page }) => {
  test.setTimeout(120_000);
  await openWide(page);
  const table: Record<number, unknown> = {};

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const s = await barState(page);
    const t = await toolbarState(page);
    table[width] = { scroll: s.scroll, widths: s.widths, toolbar: t.width };
    expect(s.outside, `${width}: past the bar`).toEqual([]);
    expect(s.overlapping, `${width}: overlapping`).toEqual([]);
    expect(s.scroll, `${width}: the bar scrolls`).toBe(0);
    for (const id of ALWAYS) expect(s.ids, `${width}: ${id}`).toContain(id);
    expect(s.brand, `${width}: brand`).toBe(width > 1600);
    // the canvas's controls are in its toolbar, never in the top bar (slice 38)
    for (const id of [...TOOLBAR_ALWAYS, ...TOOLBAR_GROUPS]) expect(s.ids, `${width}: ${id} not in the top bar`).not.toContain(id);
    expect(t.scroll, `${width}: the toolbar scrolls`).toBe(0);
    for (const id of TOOLBAR_ALWAYS) expect(t.ids, `${width}: ${id} in the toolbar`).toContain(id);
    // a group is either in the toolbar or “More” is there to hold it
    if (!t.ids.includes("button-more-tools")) for (const id of TOOLBAR_GROUPS) expect(t.ids, `${width}: ${id} in the toolbar`).toContain(id);
  }
  console.log(`S6A-10 widths: ${JSON.stringify(table)}`);
});

test("S6A-10: at 1,201 px the top bar does not scroll", async ({ page }) => {
  // chore CI e2e split it out as an expected failure on Linux; slice 16 (item 5): the working context's label gives way,
  // so a font's extra pixels never make the bar scroll
  await openWide(page);
  for (const width of [1300, 1201]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
  }
  const s = await barState(page);
  console.log(`S6A-10 at 1201: ${JSON.stringify({ scroll: s.scroll, widths: s.widths })}`);
  expect(s.scroll, "1201: the bar scrolls").toBe(0);
});
