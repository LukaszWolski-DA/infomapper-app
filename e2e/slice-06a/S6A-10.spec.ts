// S6A-10 (slice 6a, items 9–11; Łukasz's step 1 answer 7): the top bar on Customer & orders, as Łukasz (every tool) with
// the working context on (its widest state), both panels shown, at 2,560, 2,100, 1,880, 1,600, 1,536, 1,300,
// 1,201, 1,200, 1,101, 1,100, 1,000 and 800 px: no control reaches past the bar or under another, nothing scrolls; the layer switch,
// the working context, undo, zoom, both panel buttons and the user indicator are always there; the prototype's steps
// (short labels up to 2,100, icon-only tools up to 1,880, no brand up to 1,300); Focus and the notation in “More” up to
// 1,200 px, the Entity, Frame, Note and Hand tools too up to 1,100 px, each reachable there. The measured widths are
// printed (the step's table).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, signInAs, WHOLE_CO } from "./helpers";

const WIDTHS = [2560, 2100, 1880, 1600, 1536, 1300, 1201, 1200, 1101, 1100, 1000, 800];
const ALWAYS = ["button-toggle-left", "switch-layer", "button-context", "group-undo", "group-zoom", "button-toggle-right", "indicator-user"];
const FOCUS_AND_NOTATION = ["button-focus", "switch-notation"];
const TOOLS = ["button-tool-entity", "button-tool-frame", "button-tool-note", "button-tool-hand"];

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

test("S6A-10: nothing in the top bar is cut off from 2,560 to 800 px; what does not fit is in “More”", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await page.setViewportSize({ width: 2560, height: 900 });
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("button-context")).toContainText("Working on CR-23");
  const table: Record<number, unknown> = {};

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const s = await barState(page);
    table[width] = { scroll: s.scroll, widths: s.widths };
    expect(s.outside, `${width}: past the bar`).toEqual([]);
    expect(s.overlapping, `${width}: overlapping`).toEqual([]);
    expect(s.scroll, `${width}: the bar scrolls`).toBe(0);
    for (const id of ALWAYS) expect(s.ids, `${width}: ${id}`).toContain(id);
    // the prototype's steps
    expect(await page.locator('[data-testid="switch-layer"] [data-layer="all"]').innerText(), `${width}: layer label`).toBe(width > 2100 ? "Everything" : "All");
    expect(s.brand, `${width}: brand`).toBe(width > 1300);
    if (width > 1200) {
      for (const id of [...FOCUS_AND_NOTATION, ...TOOLS]) expect(s.ids, `${width}: ${id}`).toContain(id);
      expect(s.ids, `${width}: no More`).not.toContain("button-more-tools");
      expect((await page.getByTestId("button-tool-hand").innerText()).trim(), `${width}: Hand's label`).toBe(width > 1880 ? "Hand" : "");
    } else {
      for (const id of FOCUS_AND_NOTATION) expect(s.ids, `${width}: ${id} in More`).not.toContain(id);
      for (const id of TOOLS) (width > 1100 ? expect(s.ids, `${width}: ${id}`) : expect(s.ids, `${width}: ${id} in More`).not).toContain(id);
      expect(s.ids, `${width}: More`).toContain("button-more-tools");
    }
  }
  console.log(`S6A-10 widths: ${JSON.stringify(table)}`);

  // “More” at 1,200 px: Focus and the notation, no tools; at 800 px the tools too, and each works from there
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.getByTestId("button-more-tools").click();
  const menu = page.getByTestId("menu-more-tools");
  await expect(menu.getByTestId("more-focus")).toBeVisible();
  await expect(menu.getByTestId("more-notation")).toHaveCount(2);
  await expect(menu.getByTestId("more-tool-hand")).toBeHidden();
  await menu.locator('[data-notation="uml"]').click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-notation", "uml");

  await expect(menu).toBeHidden();
  await page.setViewportSize({ width: 800, height: 900 });
  await page.getByTestId("button-more-tools").click();
  for (const id of ["more-tool-entity", "more-tool-frame", "more-tool-note", "more-tool-hand"]) await expect(menu.getByTestId(id)).toBeVisible();
  await menu.getByTestId("more-tool-hand").click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "hand");
  await expect(menu).toBeHidden();
  await page.getByTestId("button-more-tools").click();
  await expect(menu).toBeVisible();
  await menu.getByTestId("more-focus").click();
  await expect(page.getByTestId("chip-focus")).toBeAttached();
});
