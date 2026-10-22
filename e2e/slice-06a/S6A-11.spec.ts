// S6A-11 (slice 6a, items 12–14 as amended in Q5): a canvas's remembered view is saved with the canvas's left edge on
// the screen and corrected by the difference on open, so a card stands where it stood (±1 px): saved with the left
// panel at 264 px and opened with it hidden; opened with it at 520 px; opened in a 1,000 px window (the panels slide over
// the canvas there, the left edge is 0). A view stored in the old format (no left edge, as every earlier helper writes)
// opens exactly as stored.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, CO, cardAt, expectCardAt, grip, openCanvas, panelWidth, signInAs, togglePanel, viewportTransform, WHOLE_CO } from "./helpers";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as { x: number; y: number; zoom: number; left?: number } | null, `infomapper:view:${CO}`);

/** The open saves the view at once in the new format (React Flow reports the opening view as a move). */
const savedWithLeft = (page: Page, left: number) => expect.poll(async () => (await stored(page))?.left).toBe(left);

test("S6A-11: an old view opens as stored; a view saved with the left panel shown opens in place with it hidden", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  // the old format: exactly the stored transform; saved again at once with the left edge
  expect(await viewportTransform(page)).toEqual(WHOLE_CO);
  await savedWithLeft(page, 264);
  const at = await cardAt(page, "Customer");
  const saved = (await stored(page))!;
  // hidden: the view moves with the panel at once (slice 5a); the view as saved beside the shown panel is put back, so
  // only the correction on open can bring the card to its place after the reload
  await togglePanel(page, "left");
  await expectCardAt(page, "Customer", at);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${CO}`, JSON.stringify(saved)] as const);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectCardAt(page, "Customer", at);
});

test("S6A-11: a view saved with the left panel at 264 px opens in place at 520 px and in a 1,000 px window", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await savedWithLeft(page, 264);
  const at = await cardAt(page, "Customer");
  const saved = (await stored(page))!;

  // the panel at 520 px (Shift+→ four times), then the saved view put back as it was saved at 264 px, and a reload
  await grip(page, "left").focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => panelWidth(page, "left")).toBe(520);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${CO}`, JSON.stringify(saved)] as const);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectCardAt(page, "Customer", at);

  // a 1,000 px window: the canvas starts at the window's left edge
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${CO}`, JSON.stringify(saved)] as const);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(Math.round((await page.getByTestId("area-canvas").boundingBox())!.x)).toBe(0);
  await expectCardAt(page, "Customer", at);
});
