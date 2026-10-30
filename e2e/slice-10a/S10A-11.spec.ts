import { expect, test } from "./fixtures";
import {
  canvasUrl,
  clickLine,
  LOOP_VIEW,
  card,
  clickCard,
  contextOn,
  expectToast,
  ids,
  linkedTo,
  loadModel,
  menuOn,
  openCanvas,
  relationshipLine,
  relationshipsOf,
  selfRelationship,
  signInAs,
} from "./helpers";

// Deleting, the entity's delete and the working context for a relationship from an entity to itself (item 15). Step 1
// found no code to change for these (Q6, F14): the specs prove it.

test("S10A-11: the entity's delete preview counts the self-relationship once; the delete removes it and undo brings it back with its line", async ({ page }) => {
  const customer = (await ids()).entity("Customer");
  const rel = await selfRelationship("Customer");
  const count = (await relationshipsOf(customer.id)).length; // the seed's two and the self-relationship
  expect(count).toBe(3);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await clickCard(page, "Customer");
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  await expect(dialog.getByTestId("table-entity-impact").locator("tbody tr").filter({ hasText: /relationships/ })).toHaveText(/^3 relationships\s*deleted$/);
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await expectToast(page, "Deleted Customer from the model.");
  await expect.poll(async () => (await loadModel()).relationships.some((r) => r.id === rel.id)).toBe(false);
  await expect(card(page, "Customer")).toHaveCount(0);

  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await loadModel()).relationships.find((r) => r.id === rel.id)).toMatchObject({ from_entity_id: customer.id, to_entity_id: customer.id });
  await expect(card(page, "Customer")).toHaveCount(1);
  await expect(relationshipLine(page, rel.id)).toHaveCount(1);
});

test("S10A-11: with a working context on, Relate to itself labels the entity once", async ({ page }) => {
  const order = (await ids()).entity("Sales Order");
  expect(await linkedTo("CR-23")).not.toContain(order.id);
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl());
  await menuOn(page, card(page, "Sales Order").locator(".c-head"), "Relate to itself");
  await expect.poll(async () => (await relationshipsOf(order.id)).some((r) => r.from_entity_id === r.to_entity_id)).toBe(true);
  await expect.poll(async () => (await linkedTo("CR-23")).filter((id) => id === order.id).length).toBe(1);
});

test("S10A-11: deleting the self-relationship is immediate, with Undo in the toast", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  const live = async () => (await loadModel()).relationships.some((r) => r.id === rel.id);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LOOP_VIEW);
  await clickLine(page, rel.id);
  await page.getByTestId("button-delete-relationship").click();
  await expectToast(page, "Relationship deleted");
  const toast = page.getByTestId("toast");
  await expect(toast.getByTestId("toast-action")).toHaveText("Undo");
  await expect.poll(live).toBe(false);
  await toast.getByTestId("toast-action").click();
  await expect.poll(live).toBe(true);
});
