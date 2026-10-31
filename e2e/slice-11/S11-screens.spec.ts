// Slice 11, step 4: screenshots of aliases on the canvas (runs only with SCREENS=<folder>, into
// docs/prd/slice-11-screens/<folder>/). Aliases on three entities and three attributes (test data): the canvas with
// names and with aliases, both check boxes indeterminate, a card with an entity exception and one with an attribute
// exception in light and dark mode, a long alias truncated, a search row found by alias, the card menu's segments, the
// top bar up to 1,300 px with the check boxes in "More", and the alias field in a panel.
//
//   SCREENS=step-4 npx playwright test e2e/slice-11/S11-screens.spec.ts

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import {
  attributeBox,
  canvasUrl,
  cardOf,
  entityBox,
  expectBox,
  FULL,
  HALF,
  headerOf,
  hydrated,
  idsOf,
  openCanvas,
  openEntityFromTree,
  setAttributeAlias,
  setEntityAlias,
  setException,
  setWidth,
  signInAs,
} from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-11-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const LONG = "Bardzo długa nazwa klienta do sprawdzenia skracania";

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const topBar = (page: Page, name: string, width = 1536) => page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: 0, y: 0, width, height: 46 } });

async function aliases() {
  await setEntityAlias("Customer", "Klient");
  await setEntityAlias("Sales Order", "Zamówienie");
  await setEntityAlias("Order Line", "Pozycja zamówienia");
  await setAttributeAlias("Customer", "customer_id", "Numer klienta");
  await setAttributeAlias("Customer", "email", "Adres e-mail");
  await setAttributeAlias("Sales Order", "order_id", "Numer zamówienia");
}

test("S11 screens: names and aliases, mixed, exceptions, truncation, search, menu, More and the panel field", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  await aliases();
  const customer = (await idsOf("Customer")).itemId;
  const order = (await idsOf("Sales Order")).itemId;

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), HALF);
  await page.mouse.move(2, 400);
  await shot(page, "1-canvas-names");
  await entityBox(page).click();
  await attributeBox(page).click();
  await expect(headerOf(page, customer)).toHaveText("Klient");
  await page.waitForTimeout(1500);
  await shot(page, "2-canvas-aliases");

  // a card with an entity exception (Customer shows its name) and one with an attribute exception (Sales Order's rows
  // show names), on a canvas that shows aliases: both check boxes indeterminate
  await setException("Customer", { entityNames: "name" });
  await setException("Sales Order", { attributeNames: "name" });
  await openCanvas(page, canvasUrl(), FULL);
  await expectBox(entityBox(page), "mixed");
  await expectBox(attributeBox(page), "mixed");
  await page.mouse.move(2, 400);
  await topBar(page, "3-check-boxes-indeterminate");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openCanvas(page, canvasUrl(), FULL);
    await page.mouse.move(2, 400);
    await page.waitForTimeout(400);
    await cardOf(page, customer).screenshot({ path: path.join(OUT, `4-entity-exception-${scheme}.png`) });
    // Sales Order clear of the Overview's miniature
    await openCanvas(page, canvasUrl(), { x: -150, y: -380, zoom: 1 });
    await page.mouse.move(2, 400);
    await page.waitForTimeout(400);
    await cardOf(page, order).screenshot({ path: path.join(OUT, `5-attribute-exception-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await openCanvas(page, canvasUrl(), FULL);

  // the card menu's segments on Customer
  const head = cardOf(page, customer).locator(".c-head");
  const b = (await head.boundingBox())!;
  await page.mouse.click(b.x + 30, b.y + b.height / 2, { button: "right" });
  await expect(page.getByTestId("seg-entity-name")).toBeVisible();
  await page.getByTestId("menu-toolbox").screenshot({ path: path.join(OUT, "6-card-menu-segments.png") });
  await page.keyboard.press("Escape");

  // a long alias in a 200 px card
  await setEntityAlias("Customer", LONG);
  await setException("Customer", { entityNames: "alias" });
  await setWidth("Customer", 200);
  await openCanvas(page, canvasUrl(), FULL);
  await expect(headerOf(page, customer)).toHaveText(LONG);
  await page.mouse.move(2, 400);
  await cardOf(page, customer).screenshot({ path: path.join(OUT, "7-long-alias-truncated.png") });

  // a search row found by alias
  await hydrated(page);
  await page.getByTestId("input-tree-search").fill("Numer");
  await expect(page.getByTestId("tree-item")).toHaveCount(2);
  await page.screenshot({ path: path.join(OUT, "8-search-by-alias.png"), clip: { x: 0, y: 46, width: 300, height: 260 } });
  await page.getByTestId("input-tree-search").fill("");

  // the alias field in the entity panel
  await openEntityFromTree(page, "Sales Order");
  await page.mouse.move(2, 400);
  await page.getByTestId("panel-entity").screenshot({ path: path.join(OUT, "9-alias-field-entity.png") });

  // up to 1,300 px the check boxes are in "More" with Focus
  await page.setViewportSize({ width: 1150, height: 800 });
  await expect(page.getByTestId("switch-names")).toBeHidden();
  await page.getByTestId("button-more-tools").click();
  await expect(page.getByTestId("more-entity-aliases")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "10-more-below-1300.png"), clip: { x: 550, y: 0, width: 600, height: 320 } });
});
