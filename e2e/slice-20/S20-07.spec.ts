// S20-07 (in part: CI and the full run are in the acceptance doc): the arrival addresses the project home's lines use
// (F17; Łukasz's step 1 answer 9): `?entity=` selects an entity's card here, else its panel; `?rel=` a relationship and
// `?ext=cube_mapping:{id}` a dimensional mapping, each centred on its first card here. Each is a history place (Back and
// Forward return to it), and an address whose object is gone says so with the places' words (GONE).

import { SEED_IDS } from "../../src/data/local/seed";
import { expect, test } from "./fixtures";
import { backButton, canvasUrl, card, cubeMappingId, demoEntity, demoRel, forwardButton, hydrated, openCanvas, recordToasts, signInAs, starUrl, toasts, WHOLE_CO } from "./helpers";

test("S20-07: the checks' arrival addresses, as history places, and gone objects", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await recordToasts(page);

  // an entity with a card here: its card, selected, its panel open
  await page.goto(`${canvasUrl()}?entity=${demoEntity("order")}`);
  await hydrated(page);
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(card(page, "Sales Order").getByTestId("card-entity")).toHaveAttribute("aria-selected", "true");
  await expect(page).not.toHaveURL(/entity=/);
  // without a card here: its panel only
  await page.goto(`${canvasUrl()}?entity=${demoEntity("product")}`);
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Product");

  // a relationship, then a dimensional mapping: selected; Back and Forward walk between them
  await page.goto(`${starUrl()}?rel=${demoRel("country>address")}`);
  await hydrated(page);
  await expect(page.getByTestId("panel-relationship")).toContainText("Country and Customer Address");
  await card(page, "Customer").getByTestId("card-name").click();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");
  await backButton(page).click();
  await expect(page.getByTestId("panel-relationship")).toContainText("Country and Customer Address");
  await forwardButton(page).click();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");
  await page.goto(`${starUrl()}?ext=cube_mapping:${cubeMappingId("prod.sku")}`);
  await hydrated(page);
  await expect(page.getByTestId("panel-cube-mapping")).toHaveAttribute("data-mapping", cubeMappingId("prod.sku"));
  await expect(page).not.toHaveURL(/ext=/);

  // gone: an entity, a relationship and a mapping that are not in the model
  const missing = "01a0f9e9-5200-7000-8000-00000000dead";
  for (const [query, text] of [
    [`entity=${missing}`, "That element no longer exists."],
    [`rel=${missing}`, "That relationship no longer exists."],
    [`ext=cube_mapping:${missing}`, "That mapping no longer exists."],
  ] as const) {
    await page.goto(`${canvasUrl(SEED_IDS.canvasCustomerOrders, SEED_IDS.projOrderManagement)}?${query}`);
    await recordToasts(page);
    await hydrated(page);
    await expect.poll(() => toasts(page)).toContain(text);
    await expect(page.getByTestId("inspector-overview")).toBeVisible();
  }
  await openCanvas(page, canvasUrl(), WHOLE_CO);
});
