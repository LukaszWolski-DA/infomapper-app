import { expect, test } from "./fixtures";
import { box, canvasUrl, card, dragCard, lineEnds, loadItems, loadModel, mappingLine, openCanvas, signInAs } from "./helpers";

test("S1A-05: dragging a card moves it and its lines; after reload it is still there", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  const customer = card(page, "Customer").locator("[data-card]");
  const cardId = (await customer.getAttribute("data-card"))!;
  // a direct mapping into Customer.email: its line ends on the card being dragged
  const model = await loadModel();
  const customerId = model.entities.find((e) => e.name === "Customer")!.id;
  const email = model.attributes.find((a) => a.entity_id === customerId && a.name === "email")!;
  const mappingId = model.mappings.find((m) => m.attribute_id === email.id)!.id;

  const before = await box(customer);
  const endsBefore = (await lineEnds(mappingLine(page, mappingId)))[0]!;
  await dragCard(page, "Customer", 160, 96);
  // React Flow starts a drag after a small threshold and snaps to 8 px, so the card lands close to, not exactly at, +160/+96
  await expect.poll(async () => (await box(customer)).x - before.x).toBeGreaterThan(130);
  const after = await box(customer);
  expect(Math.abs(after.x - (before.x + 160))).toBeLessThan(24);
  expect(Math.abs(after.y - (before.y + 96))).toBeLessThan(24);

  // the line's attribute end moved with the card
  const endsAfter = (await lineEnds(mappingLine(page, mappingId)))[0]!;
  expect(endsAfter.end.x - endsBefore.end.x).toBeCloseTo(after.x - before.x, 0);
  expect(endsAfter.end.y - endsBefore.end.y).toBeCloseTo(after.y - before.y, 0);

  // saved when the drag ended
  await expect.poll(async () => (await loadItems()).find((i) => i.id === cardId)!.x).not.toBe(496);
  const saved = (await loadItems()).find((i) => i.id === cardId)!;
  expect(saved.x % 8 + saved.y % 8).toBe(0);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const reloaded = await box(card(page, "Customer").locator("[data-card]"));
  expect(Math.abs(reloaded.x - after.x)).toBeLessThan(1);
  expect(Math.abs(reloaded.y - after.y)).toBeLessThan(1);
});
