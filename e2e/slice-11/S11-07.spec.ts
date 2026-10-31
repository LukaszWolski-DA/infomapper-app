import { expect, test } from "./fixtures";
import { canvasUrl, cardOf, entityBox, FULL, headerOf, idsOf, loadModel, openCanvas, setEntityAlias, setWidth, signInAs } from "./helpers";
import { updateEntity } from "../../src/domain/commands/entity";
import { asLukasz } from "../slice-01b/helpers";

// Truncation (item 12, D-37): a long alias in a 200 px card is truncated by the same rule as a name of that length.

const LONG = "Bardzo długa nazwa klienta do sprawdzenia skracania";

test("S11-07: a long alias in a 200 px card is truncated like a name of the same length", async ({ page }) => {
  await setEntityAlias("Customer", LONG);
  // Sales Order gets the same text as its name, for the comparison
  const model = await loadModel();
  const order = model.entities.find((e) => e.name === "Sales Order")!;
  await asLukasz((ctx, access) => updateEntity(ctx, access, { entity: order, entities: model.entities, concept: null }, { entityId: order.id, expectedVersion: order.version, name: LONG }));
  await setWidth("Customer", 200);
  await setWidth(LONG, 200);
  const customer = (await idsOf("Customer")).itemId;
  const named = (await idsOf(LONG)).itemId;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await entityBox(page).click();
  await expect(headerOf(page, customer)).toHaveText(LONG);

  const fit = (itemId: string) =>
    cardOf(page, itemId).evaluate((c) => {
      const name = c.querySelector<HTMLElement>(".c-name")!;
      const style = getComputedStyle(name);
      return { clipped: c.classList.contains("clip-name"), overflow: style.textOverflow, cut: name.scrollWidth > name.clientWidth, width: name.clientWidth };
    });
  const alias = await fit(customer);
  const name = await fit(named);
  expect(alias).toEqual(name);
  expect(alias).toMatchObject({ clipped: true, overflow: "ellipsis", cut: true });
});
