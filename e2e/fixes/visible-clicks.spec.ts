import { clickVisible } from "../canvas-click";
import { scrollsOnPurpose } from "../canvas-scroll-watch";
import { expect, test } from "../slice-03b/fixtures";
import { card, expectCard, expectToast, liveUrl, openCanvas, openLiveFor, rowNamed, signInAs, typeLabel } from "../slice-03b/helpers";
import type { Page } from "@playwright/test";

// fix/e2e-visible-clicks (the S3B-06 entry, docs/known-limitations.md): Playwright's plain click scrolls a card that
// lies partly outside the canvas's visible column into view by scrolling React Flow's `overflow:hidden` wrapper, which
// React Flow scrolls back on a later frame, so a click can be lost. `clickVisible` clicks the visible part's centre
// without scrolling. The scene is S3B-06's: customers comes to the live canvas as context, to the right of the content,
// with most of its name under the details panel.

/** Counts the scrolls of `.react-flow` and `.im-canvas` away from 0 from now on (capture phase). */
async function countScrolls(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const w = window as unknown as { __visScrolls: number };
    w.__visScrolls = 0;
    document.addEventListener(
      "scroll",
      (e) => {
        const t = e.target;
        if (t instanceof Element && t.matches(".react-flow, .im-canvas") && (t.scrollLeft !== 0 || t.scrollTop !== 0)) w.__visScrolls++;
      },
      true,
    );
  });
  return () => page.evaluate(() => (window as unknown as { __visScrolls: number }).__visScrolls);
}

const resetScrolls = (page: Page) => page.evaluate(() => void ((window as unknown as { __visScrolls: number }).__visScrolls = 0));
const wrapperAtRest = (page: Page) =>
  expect.poll(() => page.locator(".react-flow").evaluate((el) => [el.scrollLeft, el.scrollTop, el.parentElement!.scrollLeft, el.parentElement!.scrollTop])).toEqual([0, 0, 0, 0]);
const customersName = (page: Page) => card(page, "customers").getByTestId("card-name");

test("visible clicks: a plain click on a card partly outside the canvas scrolls the wrapper; clickVisible does not and selects it; a card wholly outside fails with a message", async ({ page }) => {
  test.setTimeout(120_000);
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: -200, y: 0, zoom: 0.8 });
  await expectCard(page, "Customer");

  // S3B-06's scene: labeling the mapping customers.cust_id → Customer.customer_id brings customers as context
  await clickVisible(rowNamed(page, "Customer", "customer_id"));
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await typeLabel(page, "CR-23");
  await page.keyboard.press("Enter");
  await expectToast(page, "Added from CR-23: customers.");
  await expectCard(page, "customers");

  // the scene holds: customers' name lies partly outside the canvas's column (under the details panel)
  const column = (await page.getByTestId("area-canvas").boundingBox())!;
  const name = (await customersName(page).boundingBox())!;
  expect(name.x + name.width).toBeGreaterThan(column.x + column.width);
  await wrapperAtRest(page);
  const scrolls = await countScrolls(page);

  // (1) a plain click scrolls React Flow's wrapper (which React Flow scrolls back later) or the canvas element around
  // it (which nothing scrolls back: the canvas stays shifted on that page), so the page is opened again afterwards
  scrollsOnPurpose(test.info(), "case (1) shows that a plain click scrolls the canvas");
  await customersName(page).click();
  await expect.poll(scrolls).toBeGreaterThan(0);
  await openCanvas(page, liveUrl(live), { x: -200, y: 0, zoom: 0.8 });
  await expectCard(page, "customers");
  await wrapperAtRest(page);
  const again = (await customersName(page).boundingBox())!;
  expect(again.x + again.width).toBeGreaterThan(column.x + column.width);
  const scrolls2 = await countScrolls(page);

  // (2) clickVisible scrolls nothing and selects: first Customer, then customers
  await resetScrolls(page);
  await clickVisible(card(page, "Customer").getByTestId("card-name"));
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await clickVisible(customersName(page));
  await expect(page.getByTestId("panel-source-table").locator("h2")).toHaveText("customers");
  // the scroll event would come on a later frame: wait for one rendered frame after the click, then read the count
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  expect(await scrolls2()).toBe(0);

  // (3) a card wholly outside the canvas's column: clickVisible fails with its message and clicks nothing
  await openCanvas(page, liveUrl(live), { x: -4000, y: 0, zoom: 0.8 });
  await expect(customersName(page)).toBeAttached();
  const outside = (await customersName(page).boundingBox())!;
  const column3 = (await page.getByTestId("area-canvas").boundingBox())!;
  expect(outside.x + outside.width < column3.x || outside.x > column3.x + column3.width).toBe(true);
  await expect(clickVisible(customersName(page))).rejects.toThrow(/has no part of at least 4 × 4 px in the canvas's visible column/);
});
