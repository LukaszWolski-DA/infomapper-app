// S16-08 (slice 16, item 5): with the working context on, the top bar never scrolls from 2,560 to 800 px, on any
// platform: at 1,201 px too (S6A-10's case, docs/known-limitations.md "The top bar overflows by 1 px at 1,201 px on
// Linux"). The working context's label is the bar's flexible item, truncated by the browser, with its name in the
// button's title. S6A-10 still checks that nothing is cut off at slice 6a's widths.
// Slice 37 (step 8): the label stays inside its button at every width, cut by the browser, with the context's name in
// the title. Slice 38 (step 3, S38-02): the canvas's controls left the bar, and the label keeps 40 px at least at every
// one of the 13 widths (slice 37's limitation at 1,201–1,250 px closed).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, signInAs, WHOLE_CO } from "./helpers";

const WIDTHS = [2560, 2100, 1880, 1600, 1536, 1300, 1250, 1201, 1200, 1101, 1100, 1000, 800];
const TITLE = "Working on CR-23. Everything you create or change in the model gets this label.";

const scrollOf = (page: Page) => page.getByTestId("bar-top").evaluate((bar) => bar.scrollWidth - bar.clientWidth);
/** The label's shown width, whether the browser truncates it and how far it runs past its button's right edge. */
const labelOf = (page: Page) =>
  page.getByTestId("button-context").evaluate((b) => {
    const span = [...b.querySelectorAll("span")].find((s) => s.textContent?.startsWith("Working on"))!;
    const r = span.getBoundingClientRect();
    const past = Math.max(0, Math.round((r.right - b.getBoundingClientRect().right) * 10) / 10);
    return { width: Math.round(r.width), cut: span.scrollWidth > span.clientWidth, past };
  });

test("S16-08: the top bar never scrolls from 2,560 to 800 px; the working context's label keeps 40 px inside its button, its name in the title", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await page.setViewportSize({ width: 2560, height: 900 });
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("button-context")).toContainText("Working on CR-23");
  await expect(page.getByTestId("button-context")).toHaveAttribute("title", TITLE);

  const table: Record<number, unknown> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const label = await labelOf(page);
    const scroll = await scrollOf(page);
    table[width] = { scroll, label };
    expect(scroll, `${width}: the bar scrolls`).toBe(0);
    expect(label.past, `${width}: the label runs past its button`).toBe(0);
    await expect(page.getByTestId("button-context"), `${width}: the title names the context`).toHaveAttribute("title", TITLE);
    expect(label.width, `${width}: the label keeps 40 px at least`).toBeGreaterThanOrEqual(40);
  }
  console.log(`S16-08: ${JSON.stringify(table)}`);
});
