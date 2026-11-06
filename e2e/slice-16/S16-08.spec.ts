// S16-08 (slice 16, item 5): with the working context on, the top bar never scrolls from 2,560 to 800 px, on any
// platform: at 1,201 px too (S6A-10's case, docs/known-limitations.md "The top bar overflows by 1 px at 1,201 px on
// Linux"). The working context's label is the bar's flexible item, truncated by the browser, with its name in the
// button's title. S6A-10 still checks that nothing is cut off at slice 6a's widths.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, signInAs, WHOLE_CO } from "./helpers";

const WIDTHS = [2560, 2100, 1880, 1600, 1536, 1300, 1250, 1201, 1200, 1101, 1100, 1000, 800];
const TITLE = "Working on CR-23. Everything you create or change in the model gets this label.";

const scrollOf = (page: Page) => page.getByTestId("bar-top").evaluate((bar) => bar.scrollWidth - bar.clientWidth);
/** The label's shown width and whether the browser truncates it. */
const labelOf = (page: Page) =>
  page.getByTestId("button-context").evaluate((b) => {
    const span = [...b.querySelectorAll("span")].find((s) => s.textContent?.startsWith("Working on"))!;
    return { width: Math.round(span.getBoundingClientRect().width), cut: span.scrollWidth > span.clientWidth };
  });

test("S16-08: the top bar never scrolls from 2,560 to 800 px; the working context's label gives way, its name in the title", async ({ page }) => {
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
    expect(label.width, `${width}: the label keeps 40 px at least`).toBeGreaterThanOrEqual(40);
  }
  console.log(`S16-08: ${JSON.stringify(table)}`);
  // at 1,201 px the label is truncated by the browser, and its name stays in the title
  await page.setViewportSize({ width: 1201, height: 900 });
  await page.waitForTimeout(150);
  expect((await labelOf(page)).cut, "1201: the label is truncated").toBe(true);
  await expect(page.getByTestId("button-context")).toHaveAttribute("title", TITLE);
});
