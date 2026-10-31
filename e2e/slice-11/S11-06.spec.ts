import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { attributeBox, canvasUrl, entityBox, headerOf, idsOf, liveUrl, loadModel, openCanvas, openLiveFor, setAttributeAlias, setCard, setEntityAlias, setNamesAs, signInAs, labelItem } from "./helpers";

// Other cards (item 10): a collapsed card shows its entity alias by the entity mode; a live canvas's context card
// follows the same rules; table and requirement cards are unchanged under both modes.

const texts = (page: Page, testId: string) => page.getByTestId(testId).getByTestId("card-name").allTextContents();

test("S11-06: a collapsed card shows the entity alias by the entity mode", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  await setCard("Customer", { collapsed: true });
  const customer = (await idsOf("Customer")).itemId;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await expect(headerOf(page, customer)).toHaveText("Customer");
  await entityBox(page).click();
  await expect(headerOf(page, customer)).toHaveText("Klient");
  await attributeBox(page).click();
  await expect(headerOf(page, customer)).toHaveText("Klient");
});

test("S11-06: table and requirement cards are unchanged under both modes", async ({ page }) => {
  for (const e of (await loadModel()).entities) await setEntityAlias(e.name, `${e.name} alias`);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const tables = await texts(page, "card-source");
  const requirements = await texts(page, "card-requirement");
  expect(tables.length).toBeGreaterThan(0);
  expect(requirements.length).toBeGreaterThan(0);
  await entityBox(page).click();
  await attributeBox(page).click();
  await expect.poll(() => texts(page, "card-entity")).toEqual(expect.arrayContaining(["Customer alias"]));
  expect(await texts(page, "card-source")).toEqual(tables);
  expect(await texts(page, "card-requirement")).toEqual(requirements);
});

test("S11-06: a live canvas's context card follows the same rules", async ({ page }) => {
  // Order Line is a context card when only one of its attributes carries the label (slice 3b)
  const model = await loadModel();
  const orderLine = model.entities.find((e) => e.name === "Order Line")!;
  const attribute = model.attributes.find((a) => a.entity_id === orderLine.id)!;
  await labelItem("CR-99", { kind: "attribute", id: attribute.id });
  await setEntityAlias("Order Line", "Pozycja");
  await setAttributeAlias("Order Line", attribute.name, "Atrybut");
  const live = await openLiveFor("CR-99");
  await setNamesAs("entity", "alias", live);
  const { itemId, attributeId } = await idsOf("Order Line", attribute.name, live);
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 1 });
  await expect(page.locator(`[data-card="${itemId}"]`)).toHaveAttribute("data-live", "context");
  await expect(headerOf(page, itemId)).toHaveText("Pozycja");
  await attributeBox(page).click();
  await expect(page.locator(`[data-card="${itemId}"] [data-row="${attributeId}"] .nm`)).toHaveText("Atrybut");
});
