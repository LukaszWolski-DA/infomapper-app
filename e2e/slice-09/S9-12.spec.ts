import { expect, test } from "./fixtures";
import { canvasUrl, loadModel, openCanvas, signInAs } from "./helpers";
import { clickCard, expectZoom, selected, zoomField } from "./zoom";

// Keys in the zoom field act on the field only (item 20): E, F, H, Escape, Ctrl+Z and Alt+← change nothing on the
// canvas; the selection and the details panel stay; after leaving the field the shortcuts work again.

test("S9-12: E, F, H, Escape, Ctrl+Z and Alt+← typed in the zoom field change nothing on the canvas", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await expectZoom(page, 100);

  // something to undo, and a selection with its details
  await clickCard(page, "Customer");
  await expect.poll(async () => selected(page)).toBe("entity:Customer");
  const name = page.getByTestId("input-entity-name");
  await name.fill("Client");
  await name.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Client")).toBe(true);
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await clickCard(page, "Client");
  await expect.poll(async () => selected(page)).toBe("entity:Client");
  const url = page.url();

  await zoomField(page).click();
  for (const key of ["e", "f", "h"]) await page.keyboard.press(key);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(zoomField(page)).toBeFocused();
  for (const tool of ["entity", "hand"]) await expect(page.getByTestId(`button-tool-${tool}`)).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(zoomField(page)).not.toBeFocused();

  await expectZoom(page, 100);
  expect(page.url()).toBe(url);
  expect(await selected(page)).toBe("entity:Client");
  expect((await loadModel()).entities.some((e) => e.name === "Client")).toBe(true);

  // outside the field the shortcuts work again
  await page.keyboard.press("e");
  await expect(page.getByTestId("button-tool-entity")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("button-tool-entity")).toHaveAttribute("aria-pressed", "false");
});
