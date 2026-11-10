// S24-03 (slice 24, items 3, 4, 9, 10; F5, F8, F9): Link renamed "Association" and defined, each one undo step, undone
// and redone from the top bar; Order Line's card label and the Model tab say "Association", the card's title is the
// definition, and its panel's select shows it selected with the definition under it and each option's definition as its
// title; the entity's code stays `link`. A taken name (another's name, or a code such as "OBJECT") is refused under the
// field, and nothing is written.

import { expect, test } from "./fixtures";
import {
  card,
  cardStereotype,
  canvasUrl,
  expectStoredName,
  expectToast,
  hydrated,
  openCanvas,
  openConventions,
  openEntityFromTree,
  redoButton,
  stDefinition,
  stName,
  stRow,
  storedEntity,
  storedStereotype,
  treeItem,
  typeAndLeave,
  undoButton,
} from "./helpers";

const DEFINITION = "Joins two objects and takes its identity from both, e.g. an order line.";

test("S24-03: rename Link and define it: one undo step each; the names change, the code does not", async ({ page }) => {
  await openConventions(page);
  const link = stRow(page, "link");

  await typeAndLeave(stName(link), "  Association ");
  await expectToast(page, "Renamed to Association; entities keep the stereotype.");
  await expectStoredName("link", "Association");
  await undoButton(page).click();
  await expectStoredName("link", "Link");
  await expect(stName(link)).toHaveValue("Link");
  await redoButton(page).click();
  await expectStoredName("link", "Association");
  await expect(stName(link)).toHaveValue("Association");

  await typeAndLeave(stDefinition(link), `  ${DEFINITION} `);
  await expectToast(page, "Saved the definition of Association.");
  await expect.poll(async () => (await storedStereotype("link"))?.definition).toBe(DEFINITION);
  await undoButton(page).click();
  await expect.poll(async () => (await storedStereotype("link"))?.definition).toBe("Connects objects and takes its identity from them, e.g. an order line.");
  await redoButton(page).click();
  await expect.poll(async () => (await storedStereotype("link"))?.definition).toBe(DEFINITION);
  expect((await storedEntity("Order Line")).stereotype).toBe("link");

  // the canvas: Order Line's card and the Model tab show the name, the card's title is the definition
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.5 });
  const label = cardStereotype(card(page, "Order Line"));
  await expect(label).toHaveText("Association");
  await expect(label).toHaveAttribute("title", DEFINITION);
  await expect(cardStereotype(card(page, "Customer"))).toHaveText("Object");
  await expect(cardStereotype(card(page, "Customer"))).toHaveAttribute("title", "A business thing with its own identity and life cycle: customer, product, order.");
  await page.getByTestId("tab-model").click();
  await expect(treeItem(page, "Order Line")).toContainText("Association");

  // the panel's select: value the code, text the name, the definition under it and on each option
  await openEntityFromTree(page, "Order Line");
  const select = page.getByTestId("select-entity-stereotype");
  await expect(select).toHaveValue("link");
  await expect(select.locator("option:checked")).toHaveText("Association");
  await expect(select.locator("option")).toHaveText(["Object", "Association", "Dictionary", "Context", "Informative"]);
  await expect(select.locator('option[value="link"]')).toHaveAttribute("title", DEFINITION);
  await expect(page.getByTestId("text-entity-stereotype-definition")).toHaveText(DEFINITION);
  // choosing another writes its code and shows its definition
  await select.selectOption("context");
  await expect.poll(async () => (await storedEntity("Order Line")).stereotype).toBe("context");
  await expect(page.getByTestId("text-entity-stereotype-definition")).toHaveText("Describes another object in a given context or over time, e.g. a role or a changing set of attributes.");
});

test("S24-03: a taken name is refused under the field: another's name, or another's code in any case", async ({ page }) => {
  await openConventions(page);
  const link = stRow(page, "link");
  for (const taken of ["Object", "OBJECT", "dictionary"]) {
    await typeAndLeave(stName(link), taken);
    await expect(link.getByTestId("stereotype-name-error")).toHaveText("That name is taken");
    expect((await storedStereotype("link"))?.name).toBe("Link");
  }
  // its own code in another case is no other's: allowed
  await typeAndLeave(stName(link), "LINK");
  await expectStoredName("link", "LINK");
  await expect(link.getByTestId("stereotype-name-error")).toHaveCount(0);
  // an empty name puts the stored one back and writes nothing
  await typeAndLeave(stName(link), "  ");
  await expect(stName(link)).toHaveValue("LINK");
  await page.reload();
  await hydrated(page);
  await expect(stName(stRow(page, "link"))).toHaveValue("LINK");
});
