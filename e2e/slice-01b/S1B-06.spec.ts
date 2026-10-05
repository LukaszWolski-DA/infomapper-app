import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, ids, loadModel, openCanvas, signInAs, treeItem } from "./helpers";

test("S1B-06: relate from Customer to Country creates a relationship; the panel sets its label and ends", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer"), country = entity("Country");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.6 });
  await treeItem(page, "Country").click(); // not on this canvas yet: placed in a free spot in view
  await expect(card(page, "Country")).toBeVisible();

  await card(page, "Customer").getByTestId("button-card-relate").click();
  await expectToast(page, "Now click the entity to relate to. Esc cancels.");
  await card(page, "Country").getByTestId("card-name").click();
  await expectToast(page, "Relationship added. Name it and set the cardinality on the right.");

  const panel = page.getByTestId("panel-relationship");
  await expect(panel).toBeVisible();
  const rel = () => loadModel().then((m) => m.relationships.find((r) => r.from_entity_id === customer.id && r.to_entity_id === country.id));
  // default ends: 1 to 0..n
  await expect.poll(rel).toMatchObject({ from_min: 1, from_max: "1", to_min: 0, to_max: "n" });

  await panel.getByTestId("input-relationship-label").fill("lives in");
  await panel.getByTestId("input-relationship-label").press("Enter");
  await expect.poll(async () => (await rel())?.label).toBe("lives in");
  // each change waits until the panel shows the saved one (the next save sends its version)
  await expect(panel.getByTestId("relationship-sentences")).toContainText("lives in");
  await panel.getByTestId("seg-relationship-to").getByRole("button", { name: "Exactly 1" }).click();
  await expect.poll(rel).toMatchObject({ label: "lives in", to_min: 1, to_max: "1" });
  await expect(panel.getByTestId("seg-relationship-to").getByRole("button", { name: "Exactly 1" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByTestId("seg-relationship-from").getByRole("button", { name: "0..*" }).click();
  await expect.poll(rel).toMatchObject({ from_min: 0, from_max: "n" });
  await expect(panel.getByTestId("seg-relationship-from").getByRole("button", { name: "0..*" })).toHaveAttribute("aria-pressed", "true");
});
