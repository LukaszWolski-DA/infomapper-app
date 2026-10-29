import { expect, test } from "./fixtures";
import { canvasUrl, loadModel, openCanvas, SEED_IDS, signInAs } from "./helpers";
import { clickCard, expectZoom, typeZoom } from "./zoom";

// The remembered view (item 21): a typed zoom is saved like any other zoom and the canvas opens at it after a reload;
// typing the zoom is view state, never an undo step (D-22).

test("S9-13: a typed zoom is remembered over a reload and is no undo step", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await expectZoom(page, 100);

  // a model change first, then a typed zoom
  await clickCard(page, "Customer");
  const name = page.getByTestId("input-entity-name");
  await name.fill("Client");
  await name.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Client")).toBe(true);
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await typeZoom(page, "150");
  await expectZoom(page, 150);
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").zoom, `infomapper:view:${SEED_IDS.canvasCustomerOrders}`))
    .toBeCloseTo(1.5, 3);

  // Ctrl+Z undoes the model change, not the zoom
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Customer")).toBe(true);
  await expectZoom(page, 150);

  await page.reload();
  await expectZoom(page, 150);
});
