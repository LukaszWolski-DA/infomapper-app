import { expect, test, type Page } from "./fixtures";
import {
  backButton,
  canvasUrl,
  card,
  clickCard,
  expectSelected,
  expectToast,
  groupsOf,
  loadModel,
  openCanvas,
  recordToasts,
  selfRelationship,
  signInAs,
  toasts,
  viewportTransform,
} from "./helpers";

// The panel of a relationship from an entity to itself (item 14, F8–F10) and its place in the history (item 15, D-38).
// Until step 4 the loop is not drawn as a loop, so the tests select it from the entity panel's list of relationships.

const relationshipRow = (id: string) => async () => (await loadModel()).relationships.find((r) => r.id === id);

async function selectFromEntity(page: Page, entityName: string) {
  await clickCard(page, entityName);
  await expectSelected(page, `entity:${entityName}`);
  await page.getByTestId("panel-entity").getByText(`${entityName} relates to ${entityName}`, { exact: true }).click();
  await expectSelected(page, "relationship");
}

const field = (page: Page, label: string) => page.getByTestId("panel-relationship").locator("label").filter({ hasText: label });

test("S10A-10: the panel is titled “Customer and Customer”, its end fields “At the right end” and “At the top end”; the label and both ends are saved", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await selectFromEntity(page, "Customer");
  const panel = page.getByTestId("panel-relationship");
  await expect(panel.locator("h2")).toHaveText("Customer and Customer");
  await expect(field(page, "At the right end")).toHaveCount(1);
  await expect(field(page, "At the top end")).toHaveCount(1);
  await expect(panel.getByText("At the Customer end")).toHaveCount(0);
  await expect(panel.getByTestId("seg-relationship-from").getByRole("button", { name: "0..1" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("seg-relationship-to").getByRole("button", { name: "0..*" })).toHaveAttribute("aria-pressed", "true");

  const label = panel.getByTestId("input-relationship-label");
  await label.fill("refers");
  await label.press("Tab");
  await expect.poll(relationshipRow(rel.id)).toMatchObject({ label: "refers" });
  await panel.getByTestId("seg-relationship-from").getByRole("button", { name: "Exactly 1" }).click();
  await expect.poll(relationshipRow(rel.id)).toMatchObject({ from_min: 1, from_max: "1" });
  await panel.getByTestId("seg-relationship-to").getByRole("button", { name: "1..*" }).click();
  await expect.poll(relationshipRow(rel.id)).toMatchObject({ label: "refers", from_min: 1, from_max: "1", to_min: 1, to_max: "n", version: 4 });
});

test("S10A-10: a relationship between two entities keeps “At the {entity} end” on both fields", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await clickCard(page, "Customer");
  await page.getByTestId("panel-entity").getByText(/^Customer \S.* Sales Order$/).first().click();
  await expectSelected(page, "relationship");
  await expect(field(page, "At the Customer end")).toHaveCount(1);
  await expect(field(page, "At the Sales Order end")).toHaveCount(1);
  await expect(field(page, "At the right end")).toHaveCount(0);
});

test("S10A-10: swap exchanges the ends' cardinalities in one undo step", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await selectFromEntity(page, "Customer");
  await page.getByTestId("button-swap-relationship").click();
  await expect.poll(relationshipRow(rel.id)).toMatchObject({ from_entity_id: rel.from_entity_id, to_entity_id: rel.from_entity_id, from_min: 0, from_max: "n", to_min: 0, to_max: "1", version: 2 });
  expect(await groupsOf(rel.id)).toHaveLength(2); // the create and the swap
  await expect(page.getByTestId("seg-relationship-from").getByRole("button", { name: "0..*" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-undo").click();
  await expect.poll(relationshipRow(rel.id)).toMatchObject({ from_min: 0, from_max: "1", to_min: 0, to_max: "n" });
});

test("S10A-10: swap with equal cardinalities is refused with “Nothing to change.” and writes nothing", async ({ page }) => {
  const rel = await selfRelationship("Customer", { from_min: 0, from_max: "n" });
  expect(rel).toMatchObject({ from_min: 0, from_max: "n", to_min: 0, to_max: "n", version: 2 });
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await selectFromEntity(page, "Customer");
  await page.getByTestId("button-swap-relationship").click();
  await expectToast(page, "Nothing to change.");
  await page.waitForTimeout(500);
  expect(await relationshipRow(rel.id)()).toMatchObject({ version: 2 });
  expect(await groupsOf(rel.id)).toHaveLength(2);
  expect((await toasts(page)).filter((t) => t === "Nothing to change.")).toHaveLength(1);
});

test("S10A-10: the self-relationship, then a card, then Back selects the self-relationship again without moving the view (D-38)", async ({ page }) => {
  await selfRelationship("Customer", { label: "refers" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await clickCard(page, "Customer");
  await page.getByTestId("panel-entity").getByText("Customer refers Customer", { exact: true }).click();
  await expectSelected(page, "relationship");
  await clickCard(page, "Sales Order");
  await expectSelected(page, "entity:Sales Order");
  const view = await viewportTransform(page);
  await backButton(page).click();
  await expectSelected(page, "relationship");
  await expect(page.getByTestId("panel-relationship").locator("h2")).toHaveText("Customer and Customer");
  expect(await viewportTransform(page)).toEqual(view);
  await expect(card(page, "Customer")).toHaveCount(1);
});
