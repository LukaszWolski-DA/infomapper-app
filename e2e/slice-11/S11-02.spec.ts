import { expect, test } from "./fixtures";
import { canvasRow, canvasUrl, entityBox, expectBox, headerOf, idsOf, liveUrl, openCanvas, openLiveFor, setEntityAlias, signInAs, undo } from "./helpers";

// Entity aliases on a canvas (items 8, 10): “Entity aliases” shows Customer's alias, names where there is none; one
// undo step; kept after a reload; another canvas with Customer still shows its name.

test("S11-02: checking “Entity aliases” shows “Klient” in Customer's header and names elsewhere, one undo step, kept after a reload", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  const customer = (await idsOf("Customer")).itemId;
  const order = (await idsOf("Sales Order")).itemId;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await expectBox(entityBox(page), "name");
  await expect(entityBox(page)).toBeEnabled();
  await expect(headerOf(page, customer)).toHaveText("Customer");

  await entityBox(page).click();
  await expect(headerOf(page, customer)).toHaveText("Klient");
  await expect(headerOf(page, customer)).toHaveAttribute("title", "Klient");
  await expect(headerOf(page, order)).toHaveText("Sales Order");
  await expectBox(entityBox(page), "alias");
  await expect.poll(async () => (await canvasRow()).entity_names).toBe("alias");

  await undo(page);
  await expect.poll(async () => (await canvasRow()).entity_names).toBeNull();
  await expect(headerOf(page, customer)).toHaveText("Customer");
  await expectBox(entityBox(page), "name");

  await entityBox(page).click();
  await expect.poll(async () => (await canvasRow()).entity_names).toBe("alias");
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(headerOf(page, customer)).toHaveText("Klient");
  await expectBox(entityBox(page), "alias");
});

test("S11-02: another canvas with Customer still shows “Customer”", async ({ page }) => {
  // Customer carries the seed's label CR-23, so CR-23's live canvas has its card
  await setEntityAlias("Customer", "Klient");
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await entityBox(page).click();
  await expect.poll(async () => (await canvasRow()).entity_names).toBe("alias");

  await openCanvas(page, liveUrl(live));
  const customer = (await idsOf("Customer", undefined, live)).itemId;
  await expect(headerOf(page, customer)).toHaveText("Customer");
  await expectBox(entityBox(page), "name");
});
