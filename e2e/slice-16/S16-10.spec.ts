// S16-10 (slice 16, item 7, D-71): a right click on an empty canvas, a canvas tab, the top bar, the breadcrumbs row, a
// panel's header and list, and a home page's header is cancelled (the event's `defaultPrevented`); on the object
// browser's search field, a panel's name field, the description editor, a link (a breadcrumb, a home tile) and selected
// text it is not. The canvas's toolbox and a card's menu still open.

import type { Locator } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";
import { cancelledAt, canvasUrl, headOf, openCanvas, openCanvasMenu, recordContextMenus, RETAIL, signInAs, WHOLE_CO } from "./helpers";

const centreOf = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** A point inside `container` where the element under the mouse matches `accept` (scanning a grid). */
async function pointIn(page: Page, container: Locator, accept: string, reject = "a[href], button, input, textarea, select") {
  const b = (await container.boundingBox())!;
  const p = await page.evaluate(
    ({ x0, y0, w, h, accept, reject }) => {
      for (let y = y0 + 4; y < y0 + h - 2; y += 4) {
        for (let x = x0 + 4; x < x0 + w - 4; x += 6) {
          const el = document.elementFromPoint(x, y);
          if (el && el.matches(accept) && !el.closest(reject)) return { x, y };
        }
      }
      return null;
    },
    { x0: b.x, y0: b.y, w: b.width, h: b.height, accept, reject },
  );
  expect(p, `a spot matching ${accept}`).not.toBeNull();
  return p!;
}

test("S16-10: the canvas page cancels the browser's menu on its own surfaces; text fields, the editor, links and selected text keep it", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await recordContextMenus(page);

  // the empty canvas: cancelled, and the toolbox opens
  expect(await cancelledAt(page, await pointIn(page, page.getByTestId("area-canvas"), ".react-flow__pane", "a[href]")), "empty canvas").toBe(true);
  await expect(page.getByTestId("menu-toolbox")).toBeVisible();
  await page.keyboard.press("Escape");
  // a card's header: cancelled, and its menu opens
  expect(await cancelledAt(page, await centreOf(headOf(page, "Customer"))), "card header").toBe(true);
  await expect(page.getByTestId("menu-toolbox")).toBeVisible();
  await page.keyboard.press("Escape");

  // a canvas tab, the top bar, the breadcrumbs row, the details panel's header and the object browser's list
  const tab = page.getByTestId("tab-canvas").first().getByTestId("tab-canvas-name");
  expect(await cancelledAt(page, await centreOf(tab)), "canvas tab").toBe(true);
  expect(await cancelledAt(page, await pointIn(page, page.getByTestId("bar-top"), "header, div")), "top bar").toBe(true);
  expect(await cancelledAt(page, await pointIn(page, page.getByTestId("nav-breadcrumbs"), "div, nav, ol, ul, li")), "breadcrumbs row").toBe(true);
  await page.getByTestId("card-entity").filter({ hasText: "Customer" }).first().getByTestId("card-name").click();
  const panel = page.getByTestId("panel-entity");
  await expect(panel).toBeVisible();
  expect(await cancelledAt(page, await pointIn(page, panel, "div", "a[href], button, input, textarea, select, .rt-view")), "the details panel").toBe(true);
  expect(await cancelledAt(page, await centreOf(page.getByTestId("tree-concept").first())), "the object browser's list").toBe(true);

  // kept: the object browser's search, a panel's name field, a link
  expect(await cancelledAt(page, await centreOf(page.getByTestId("input-tree-search"))), "search field").toBe(false);
  expect(await cancelledAt(page, await centreOf(panel.getByTestId("input-entity-name"))), "name field").toBe(false);
  expect(await cancelledAt(page, await centreOf(page.getByTestId("breadcrumb").first())), "a breadcrumb link").toBe(false);

  // selected text in the panel keeps it
  const label = panel.locator("label").first();
  await label.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  expect(await cancelledAt(page, await centreOf(label)), "selected text").toBe(false);

  // the description editor keeps it
  await panel.getByTestId("field-entity-definition-edit").click();
  const editor = page.getByTestId("rte-content");
  await expect(editor).toBeVisible();
  expect(await cancelledAt(page, await centreOf(editor)), "the description editor").toBe(false);
  await page.keyboard.press("Escape");

  // the canvas tab's menu still opens from its button
  await page.keyboard.press("Escape");
  await openCanvasMenu(page, "Customer & orders");
});

test("S16-10: a home page cancels it on its own surfaces; a tile, a link, keeps it", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("tile-project").first()).toBeVisible();
  await recordContextMenus(page);
  expect(await cancelledAt(page, await centreOf(page.locator("h1").first())), "the home's heading").toBe(true);
  expect(await cancelledAt(page, await centreOf(page.getByTestId("tile-project").first())), "a project tile").toBe(false);
});
