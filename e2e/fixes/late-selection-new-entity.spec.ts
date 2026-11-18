import { expect, test } from "../slice-16/fixtures";
import { canvasUrl, card, hydrated, loadModel, openCanvas, signInAs, WHOLE_CO } from "../slice-16/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-remaining (the S15-24 entry's list, known-limitations.md): a new entity from the left panel's "+"
// opened the details panel, selected its card and focused its name when its answer arrived, whatever had been selected
// by then. The answer is held until another card has been clicked, so the click always comes first.

const nameFields = "[data-testid=input-attribute-name], [data-testid=input-entity-name]";
const liveEntities = async () => (await loadModel()).entities.filter((e) => e.deleted_at === null);

test("a card clicked while a new entity from the left panel is on its way stays selected, and no name is focused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const before = (await liveEntities()).length;

  const hold = await holdUntil(page, '"conceptId"');
  await page.getByTestId("button-concept-add").first().click();
  await expect.poll(() => hold.held()).toBe(true);
  await card(page, "Sales Order").getByTestId("card-name").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");

  hold.release();
  await hold.given;
  // the answer has been applied: its toast shows (the toast comes before the selection) and the entity is stored
  await expect(page.getByTestId("toast")).toContainText("Created New entity in");
  await expect.poll(async () => (await liveEntities()).length).toBe(before + 1);
  await expect(card(page, "New entity")).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.locator(nameFields).and(page.locator(":focus"))).toHaveCount(0);
});

test("a new entity from the left panel is selected with its name focused when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await page.getByTestId("button-concept-add").first().click();
  await expect(card(page, "New entity")).toBeVisible();
  const name = page.getByTestId("input-entity-name");
  await expect(name).toHaveValue("New entity");
  await expect(name).toBeFocused();
});
