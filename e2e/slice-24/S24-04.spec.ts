// S24-04 (slice 24, item 5; F5, F6, F8): "Event" added: the code proposed `event`, edited by hand to `business_event`;
// one undo step; the new row is last, with the chip "own". A bad code and a taken one (a built-in code, an earlier own
// one, one whose add was undone) are refused under the code field. The new stereotype is last in the entity panel's
// select and can be chosen.

import { expect, test } from "./fixtures";
import {
  addStereotype,
  canvasUrl,
  expectToast,
  openCanvas,
  openConventions,
  openEntityFromTree,
  stCodes,
  storedEntity,
  storedStereotype,
  stRow,
  undoButton,
} from "./helpers";

test("S24-04: an own stereotype with its proposed code edited by hand, last in the list and in the panel", async ({ page }) => {
  await openConventions(page);
  const name = page.getByTestId("input-new-stereotype");
  const code = page.getByTestId("input-new-stereotype-code");
  await name.fill("Event");
  await expect(code).toHaveValue("event");
  await name.fill("Zdarzenie gospodarcze");
  await expect(code).toHaveValue("zdarzenie_gospodarcze");
  await name.fill("Event");
  await code.fill("business_event");
  // once edited by hand, the name no longer changes it
  await name.fill("Event ");
  await expect(code).toHaveValue("business_event");
  await page.getByTestId("button-add-stereotype").click();
  await expectToast(page, "Stereotype “Event” added (business_event).");
  await expect.poll(async () => (await storedStereotype("business_event"))?.name).toBe("Event");
  expect(await storedStereotype("business_event")).toMatchObject({ origin: "own", definition: null, deleted_at: null });
  // the data file is written before the answer reaches the page: wait for the page's list
  await expect.poll(() => stCodes(page)).toEqual(["object", "link", "dictionary", "context", "informative", "business_event"]);
  await expect(stRow(page, "business_event").getByTestId("chip-own")).toHaveText("own");
  await expect(stRow(page, "business_event").getByTestId("stereotype-uses")).toHaveText("unused");
  await expect(name).toHaveValue("");
  await expect(code).toHaveValue("");

  // chosen on an entity in its panel, last in the select
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.5 });
  await openEntityFromTree(page, "Customer");
  const select = page.getByTestId("select-entity-stereotype");
  await expect(select.locator("option").last()).toHaveText("Event");
  await select.selectOption("business_event");
  await expect.poll(async () => (await storedEntity("Customer")).stereotype).toBe("business_event");
  await expect(page.getByTestId("text-entity-stereotype-definition")).toHaveCount(0);
});

test("S24-04: a bad code and a taken one are refused, also one whose add was undone", async ({ page }) => {
  await openConventions(page);
  const error = page.getByTestId("stereotype-code-error");
  await addStereotype(page, "Agreement", "1st");
  await expect(error).toHaveText("Letters, digits and _; starting with a letter");
  await addStereotype(page, "Agreement", "agree-ment");
  await expect(error).toHaveText("Letters, digits and _; starting with a letter");
  await addStereotype(page, "Agreement", "link");
  await expect(error).toHaveText("That code is taken");
  // a name with no letter proposes nothing
  await addStereotype(page, "!!!", "");
  await expect(error).toHaveText("Letters, digits and _; starting with a letter");

  await addStereotype(page, "Event", "business_event");
  await expectToast(page, "Stereotype “Event” added (business_event).");
  await addStereotype(page, "Happening", "business_event");
  await expect(error).toHaveText("That code is taken");
  await addStereotype(page, "Happening", "businessevent");
  await expect(error).toHaveText("That code is taken");
  // a name that is a code is taken too
  await addStereotype(page, "Business event", "happening");
  await expect(page.getByTestId("stereotype-new-name-error")).toHaveText("That name is taken");

  await addStereotype(page, "Agreement", "agreement");
  await expectToast(page, "Stereotype “Agreement” added (agreement).");
  await undoButton(page).click();
  await expect.poll(async () => (await storedStereotype("agreement"))?.deleted_at).not.toBeNull();
  await expect(stRow(page, "agreement")).toHaveCount(0);
  await addStereotype(page, "Pact", "agreement");
  await expect(error).toHaveText("That code is taken");
});
