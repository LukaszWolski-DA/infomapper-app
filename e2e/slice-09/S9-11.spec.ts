import { expect, test } from "./fixtures";
import { canvasUrl, openCanvas, projectHome, recordToasts, signInAs, toasts } from "./helpers";
import { centrePoint, expectZoom, typeZoom, zoomField } from "./zoom";

// The zoom field (items 16–19, D-60): a whole number with or without "%" and spaces applies on Enter around the view's
// centre; leaving the field applies it too (v); out of range is clamped and shown (vii); "abc" goes back without a
// toast; Escape goes back; the field follows the wheel (a pinch), − and +, Fit and Back.

const VIEW = { x: 0, y: 0, zoom: 1 };

test.beforeEach(async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  await expectZoom(page, 100);
});

test("S9-11: typing 95 and Enter zooms to 95 % around the view's centre; with % and spaces too", async ({ page }) => {
  await expect(zoomField(page)).toHaveAttribute("aria-label", "Zoom");
  await expect(zoomField(page)).toHaveAttribute("title", "Type a zoom and press Enter");
  const before = await centrePoint(page);
  await typeZoom(page, "95");
  await expectZoom(page, 95);
  const after = await centrePoint(page);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  await expect(zoomField(page)).not.toBeFocused();

  await typeZoom(page, "80%");
  await expectZoom(page, 80);
  await typeZoom(page, " 120 % ");
  await expectZoom(page, 120);
  await typeZoom(page, "66.6");
  await expectZoom(page, 67);
  expect(await toasts(page)).toEqual([]);
});

test("S9-11: leaving the field applies (v); out of range gives 10 % or 300 % (vii); abc and Escape go back", async ({ page }) => {
  await typeZoom(page, "70", "Tab");
  await expectZoom(page, 70);
  await typeZoom(page, "5");
  await expectZoom(page, 10);
  await typeZoom(page, "500");
  await expectZoom(page, 300);
  await typeZoom(page, "abc");
  await expectZoom(page, 300);
  await typeZoom(page, "150", "Escape");
  await expectZoom(page, 300);
  await expect(zoomField(page)).not.toBeFocused();
  // a click outside applies too
  await typeZoom(page, "90", null);
  await page.getByTestId("nav-breadcrumbs").click();
  await expectZoom(page, 90);
  expect(await toasts(page)).toEqual([]);
});

test("S9-11: the field follows a pinch, − and +, Fit and Back, but not while someone types in it", async ({ page }) => {
  await page.getByTestId("button-zoom-in").click();
  await expectZoom(page, 120);
  await page.getByTestId("button-zoom-out").click();
  await expectZoom(page, 100);

  // a pinch (Ctrl and the wheel) over the canvas
  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 300);
  await page.keyboard.up("Control");
  await expect(zoomField(page)).not.toHaveValue("100%");

  await page.getByTestId("button-zoom-fit").click();
  await expect(zoomField(page)).not.toHaveValue("100%");
  const fitted = await zoomField(page).inputValue();

  // focused but not typed in yet: the field follows a pinch and its value stays selected, so the first key replaces it
  await zoomField(page).click();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 200);
  await page.keyboard.up("Control");
  await expect(zoomField(page)).not.toHaveValue(fitted);
  await expect(zoomField(page)).toBeFocused();
  await page.keyboard.type("2");
  // while typing, a zoom does not overwrite the text
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  await expect(zoomField(page)).toHaveValue("2");
  await page.keyboard.press("Escape");
  await expect(zoomField(page)).not.toHaveValue(fitted);

  // Back: the canvas opens again at its remembered view
  await typeZoom(page, "50");
  await expectZoom(page, 50);
  await page.goto(projectHome());
  await page.goBack();
  await expectZoom(page, 50);
});
