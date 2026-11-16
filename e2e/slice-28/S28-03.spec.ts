// S28-03 (slice 28, item 1, D-54's limits): the handles keep the canvas's bounds, 200–520 px for the sections panel and
// 280–640 px for the options panel, by drag and keys; a double-click or Home gives 264 and 340 px back. (S27-08 checks
// the drag, the keys' steps and the reload with these numbers.)

import { expect, test } from "./fixtures";
import { openDocument, signInAs, widthOf } from "./helpers";

test("S28-03: the canvas's bounds and defaults, by keys, drag, double-click and Home", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  const left = page.getByTestId("handle-left"), right = page.getByTestId("handle-right");
  await expect(left).toHaveAttribute("aria-valuemin", "200");
  await expect(left).toHaveAttribute("aria-valuemax", "520");
  await expect(right).toHaveAttribute("aria-valuemin", "280");
  await expect(right).toHaveAttribute("aria-valuemax", "640");
  await expect(left).toHaveAttribute("aria-valuenow", "264");
  await expect(right).toHaveAttribute("aria-valuenow", "340");

  // to each end by the keys (Shift: 64 px)
  await left.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  expect(await widthOf(page, "editor-left")).toBe(520);
  for (let i = 0; i < 8; i++) await page.keyboard.press("Shift+ArrowLeft");
  expect(await widthOf(page, "editor-left")).toBe(200);
  await page.keyboard.press("Home");
  expect(await widthOf(page, "editor-left")).toBe(264);

  await right.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowLeft");
  expect(await widthOf(page, "editor-right")).toBe(640);
  await expect(right).toHaveAttribute("aria-valuenow", "640");
  // a drag beyond the bound stops there
  const box = (await right.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 300, { steps: 6 });
  await page.mouse.move(box.x + 600, box.y + 300, { steps: 6 });
  await page.mouse.up();
  expect(await widthOf(page, "editor-right")).toBe(280);
  await page.getByTestId("handle-right").dblclick();
  expect(await widthOf(page, "editor-right")).toBe(340);
  await expect(right).toHaveAttribute("aria-valuenow", "340");
});
