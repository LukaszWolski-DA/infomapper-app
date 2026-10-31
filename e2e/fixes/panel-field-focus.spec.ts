import { expect, test, type Page } from "../slice-01b/fixtures";
import { canvasUrl, card, loadModel, openCanvas, rowNamed, signInAs } from "../slice-01b/helpers";

// Tab keeps the focus in the next field of a panel after the field it leaves is saved (Łukasz, slice 8's manual
// acceptance): the fields were keyed by the object's version, so the save mounted the next field anew.

/** Presses Tab and waits for the save it starts, with the page's refresh in the same response. */
async function tabAndSave(page: Page) {
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await page.keyboard.press("Tab");
  await saved;
}

test("Tab from Precision to Scale: the focus stays in Scale after Precision is saved, and Scale takes what is typed", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  const precision = page.getByTestId("input-type-precision");
  const scale = page.getByTestId("input-type-scale");

  const panel = page.getByTestId("panel-attribute");
  const before = Number(await panel.getAttribute("data-version"));
  await precision.click();
  await page.keyboard.type("12");
  await tabAndSave(page);
  // the panel shows the saved version (before it does, a save from Scale would carry the old one)
  await expect(panel).toHaveAttribute("data-version", String(before + 1));
  await expect(scale).toBeFocused();

  await page.keyboard.type("2");
  await expect(scale).toHaveValue("2");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.name === "unit_price")).toMatchObject({ type_precision: 12, type_scale: 2 });
  await expect(precision).toHaveValue("12");
});

// since slice 11 the entity's Alias field follows its name
test("Tab from an entity's name to its alias: the focus stays on the alias after the name is saved", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await card(page, "Customer").getByTestId("card-name").click();
  const name = page.getByTestId("input-entity-name");

  await name.fill("Client");
  await tabAndSave(page);
  await expect(card(page, "Client")).toBeVisible();
  await expect(name).toHaveValue("Client");
  await expect(page.getByTestId("input-entity-alias")).toBeFocused();
});
