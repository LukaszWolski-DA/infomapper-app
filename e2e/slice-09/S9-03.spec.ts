import type { Browser } from "@playwright/test";
import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, loadModel, openCanvas, recordToasts, rowNamed, signInAs, STALE, toasts } from "./helpers";

/** A session of Łukasz with unit_price's panel open. */
async function sessionOnUnitPrice(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  return page;
}

test("S9-03: a real conflict is still refused; the saves waiting behind it are not sent, with one toast", async ({ browser }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  const first = await sessionOnUnitPrice(browser);
  const second = await sessionOnUnitPrice(browser);

  await first.getByTestId("input-type-precision").fill("12");
  await first.getByTestId("input-type-precision").press("Enter");
  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.id === before.id)?.type_precision).toBe(12);

  // the second session still shows the old version: its name save is refused, and the scale save behind it is cut
  const name = second.getByTestId("input-attribute-name");
  await name.fill("price_from_second");
  await name.press("Enter");
  await second.getByTestId("input-type-scale").fill("3");
  await second.getByTestId("input-type-scale").press("Enter");
  await expectToast(second, STALE);

  await second.waitForTimeout(1500); // room for a cut save that was sent after all
  expect((await loadModel()).attributes.find((a) => a.id === before.id)).toMatchObject({ name: "unit_price", type_precision: 12, type_scale: null, version: before.version + 1 });
  expect(await toasts(second)).toEqual([STALE]);
  // the field keeps what was typed, as before slice 9 (F6)
  await expect(name).toHaveValue("price_from_second");
});

test("S9-03: after a validation refusal the saves behind it are still sent", async ({ page }) => {
  const before = (await loadModel()).attributes.find((a) => a.name === "unit_price")!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();

  // a scale without a precision is refused; the name typed right after it is stored
  await page.getByTestId("input-type-scale").fill("2");
  await page.getByTestId("input-type-scale").press("Enter");
  const name = page.getByTestId("input-attribute-name");
  await name.fill("unit_price_eur");
  await name.press("Enter");

  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.id === before.id)).toMatchObject({ name: "unit_price_eur", type_scale: null, version: before.version + 1 });
  expect(await toasts(page)).toEqual(["A scale needs a precision."]);
});
