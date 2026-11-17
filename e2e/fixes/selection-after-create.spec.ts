import { expect, test } from "../slice-15d/fixtures";
import { hydrated, ids, liveCubeMappings, openAttribute, openEntity, openStar, signInAs } from "../slice-15d/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-after-create (S15-24 failed once in slice 29's full run, known-limitations.md): an answer that
// selects what it made replaced the selection the person had made while the action was on its way. InfoCube's "Add a
// logical attribute" is the case found: its answer selected the new mapping whatever was selected by then. The answer is
// held until another card has been clicked, so the click always comes before the answer (no timing luck).

test("a card clicked while 'Add a logical attribute' is on its way stays selected", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const before = (await liveCubeMappings()).length;
  await openAttribute(page, "Dim Date", "day_of_week");
  const { attribute } = await ids();
  const input = attribute("Product", "product_name").id;

  const hold = await holdUntil(page, input);
  await page.getByTestId("select-add-logical-attribute").selectOption(input);
  await expect.poll(() => hold.held()).toBe(true);
  await openEntity(page, "Fact Sales");
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");

  hold.release();
  await hold.given;
  // the answer has been applied (the mapping is stored and the undo step is there), and Fact Sales is still selected
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(before + 1);
  await expect(page.getByTestId("toast")).toContainText(/./);
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");
  await expect(page.getByTestId("panel-cube-mapping")).toHaveCount(0);
});

test("'Add a logical attribute' selects the new mapping when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const before = (await liveCubeMappings()).length;
  await openAttribute(page, "Dim Date", "day_of_week");
  const { attribute } = await ids();
  await page.getByTestId("select-add-logical-attribute").selectOption(attribute("Product", "product_name").id);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(before + 1);
  const made = (await liveCubeMappings()).find((m) => m.attribute_id === attribute("Dim Date", "day_of_week").id)!;
  await expect(page.getByTestId("panel-cube-mapping")).toBeVisible();
  await expect(page.getByTestId("panel-cube-mapping")).toHaveAttribute("data-mapping", made.id);
});
