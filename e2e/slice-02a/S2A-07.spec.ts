import { expect, test, type Page } from "./fixtures";
import { canvasUrl, emptySpot, headPoint, loadItems, openCanvas, signInAs, WHOLE } from "./helpers";

/** The view's pan, from React Flow's viewport transform. */
const pan = (page: Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec((el as HTMLElement).style.transform)!;
    return { x: Number(m[1]), y: Number(m[2]) };
  });

async function drag(page: Page, from: { x: number; y: number }, d: { x: number; y: number }, button: "left" | "right" | "middle" = "left") {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + (d.x * i) / 8, from.y + (d.y * i) / 8);
  await page.mouse.up({ button });
}

async function expectPannedBy(page: Page, before: { x: number; y: number }, d: { x: number; y: number }) {
  await expect.poll(async () => {
    const now = await pan(page);
    return Math.abs(now.x - before.x - d.x) < 2 && Math.abs(now.y - before.y - d.y) < 2;
  }).toBe(true);
}

test("S2A-07: the Hand tool (button or H) pans with a left drag over cards and empty canvas and selects nothing; V and Esc turn it off; right drag, middle button and Space still pan", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const area = page.getByTestId("area-canvas");
  const itemsBefore = await loadItems();

  // the button turns it on; the cursor shows it
  await page.getByTestId("button-tool-hand").click();
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "true");
  await expect(area).toHaveAttribute("data-mode", "hand");
  expect(await page.locator(".react-flow__pane").evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");

  // a left drag over a card pans and neither moves nor selects it
  let before = await pan(page);
  await drag(page, await headPoint(page, "Customer"), { x: 120, y: 60 });
  await expectPannedBy(page, before, { x: 120, y: 60 });
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  // over the empty canvas too, with no lasso
  before = await pan(page);
  await drag(page, await emptySpot(page), { x: -80, y: -40 });
  await expectPannedBy(page, before, { x: -80, y: -40 });
  await expect(page.getByTestId("mark-selected")).toHaveCount(0);
  expect(await loadItems()).toEqual(itemsBefore);

  // V turns it off; H on again; Esc off
  await page.keyboard.press("v");
  await expect(area).not.toHaveAttribute("data-mode", "hand");
  await page.keyboard.press("h");
  await expect(area).toHaveAttribute("data-mode", "hand");
  await page.keyboard.press("Escape");
  await expect(area).not.toHaveAttribute("data-mode", "hand");
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "false");

  // without it: right drag, middle button and Space + left drag still pan
  for (const button of ["right", "middle"] as const) {
    before = await pan(page);
    await drag(page, await emptySpot(page), { x: 60, y: 30 }, button);
    await expectPannedBy(page, before, { x: 60, y: 30 });
  }
  await expect(page.getByTestId("menu-toolbox")).toHaveCount(0); // a right drag is not a right-click
  before = await pan(page);
  await page.keyboard.down("Space");
  await drag(page, await emptySpot(page), { x: -50, y: 20 });
  await page.keyboard.up("Space");
  await expectPannedBy(page, before, { x: -50, y: 20 });
  await expect(page.getByTestId("mark-selected")).toHaveCount(0);
  expect(await loadItems()).toEqual(itemsBefore);
});
