import { expect, test } from "./fixtures";
import { box, canvasUrl, card, lineEnds, loadItems, loadModel, mappingLine, openCanvas, signInAs } from "./helpers";

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
  // a real mouse drag in 10 steps, left and down so the pointer stays inside the canvas (near its edge React Flow
  // pans the view along); at every step the card stays under the cursor at the grab offset, apart from the
  // 8 px snap (at 100% at most 4 px either way); the first step must not be lost to React Flow's drag threshold
  const head = await box(card(page, "Customer").locator(".c-head .c-l2"));
  const from = { x: head.x + head.width / 3, y: head.y + head.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const at = { x: from.x - (160 * i) / 10, y: from.y + (96 * i) / 10 };
    await page.mouse.move(at.x, at.y);
    await expect
      .poll(async () => {
        const b = await box(customer);
        return Math.max(Math.abs(b.x - before.x - (at.x - from.x)), Math.abs(b.y - before.y - (at.y - from.y)));
      }, { message: `card under the cursor at step ${i}` })
      .toBeLessThanOrEqual(4);
  }
  await page.mouse.up();
  const after = await box(customer);
  expect(Math.abs(after.x - (before.x - 160))).toBeLessThanOrEqual(4);
  expect(Math.abs(after.y - (before.y + 96))).toBeLessThanOrEqual(4);

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
