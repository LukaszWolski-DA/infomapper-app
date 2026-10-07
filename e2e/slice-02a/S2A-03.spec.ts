import { expect, test, type Page } from "./fixtures";
import { box, canvasUrl, card, dragCardBy, expectToast, headPoint, ids, key, lineEnds, loadItems, mappingLine, openCanvas, screenPoint, signInAs, WHOLE, zoomOf } from "./helpers";

test("S2A-03: dragging one card of a three-card selection moves all three and their line ends by the same amount; one Ctrl+Z puts all three back; after a reload the moved positions are kept", async ({ page }) => {
  const { model, entity, table, attribute, column } = await ids();
  const names = ["Customer", "Sales Order", "customers"] as const;
  const targets = { Customer: entity("Customer").id, "Sales Order": entity("Sales Order").id, customers: table("customers").id };
  // a mapping from customers into Customer: both its ends belong to the group
  const line = model.mappings.find((m) => m.attribute_id === attribute("Customer", "email").id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === column("customers", "email_addr").id))!;
  const positions = async () => {
    const items = await loadItems();
    return names.map((n) => {
      const i = items.find((x) => x.entity_id === targets[n] || x.source_table_id === targets[n])!;
      return { x: i.x, y: i.y };
    });
  };
  const start = await positions();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await select(page, names);
  const zoom = await zoomOf(page);
  const endsBefore = (await lineEnds(mappingLine(page, line.id)))[0]!;

  // drag Sales Order by its header: the group moves as a whole, snapped to 8 px, saved as one change
  await dragCardBy(page, "Sales Order", 80, 40);
  await expect.poll(async () => (await positions())[0]!.x).not.toBe(start[0]!.x);
  const once = await positions();
  const d = { x: once[0]!.x - start[0]!.x, y: once[0]!.y - start[0]!.y };
  expect(d.x % 8).toBe(0);
  expect(d.y % 8).toBe(0);
  expect(Math.abs(d.x - 80 / zoom)).toBeLessThan(16);
  expect(Math.abs(d.y - 40 / zoom)).toBeLessThan(16);
  for (let k = 0; k < 3; k++) expect(once[k]).toEqual({ x: start[k]!.x + d.x, y: start[k]!.y + d.y });
  // the line's ends moved by the same amount on the screen
  const endsAfter = (await lineEnds(mappingLine(page, line.id)))[0]!;
  expect(Math.abs(endsAfter.start.x - endsBefore.start.x - d.x * zoom)).toBeLessThan(1.5);
  expect(Math.abs(endsAfter.start.y - endsBefore.start.y - d.y * zoom)).toBeLessThan(1.5);
  expect(Math.abs(endsAfter.end.x - endsBefore.end.x - d.x * zoom)).toBeLessThan(1.5);
  expect(Math.abs(endsAfter.end.y - endsBefore.end.y - d.y * zoom)).toBeLessThan(1.5);

  // after a reload the moved positions are kept: the cards are drawn where they were saved
  await openCanvas(page, canvasUrl(), WHOLE);
  for (const [k, n] of names.entries()) {
    const drawn = await box(card(page, n).locator("[data-card]"));
    const saved = await screenPoint(page, once[k]!);
    expect(Math.abs(drawn.x - saved.x), n).toBeLessThan(2);
    expect(Math.abs(drawn.y - saved.y), n).toBeLessThan(2);
  }

  // a second group move, then Ctrl+Z twice: each undo puts the whole group one move back
  await select(page, names);
  await dragCardBy(page, "Customer", -40, 60);
  await expect.poll(async () => (await positions())[0]!.y).not.toBe(once[0]!.y);
  const twice = await positions();
  expect(twice[1]!.x - once[1]!.x).toBe(twice[0]!.x - once[0]!.x);
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move cards");
  await expect.poll(positions).toEqual(once);
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move cards");
  await expect.poll(positions).toEqual(start);
});

async function select(page: Page, names: readonly string[]) {
  await page.getByTestId("card-name").getByText(names[0]!, { exact: true }).click();
  await page.keyboard.down("Shift");
  for (const n of names.slice(1)) {
    const at = await headPoint(page, n);
    await page.mouse.click(at.x, at.y);
  }
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("mark-selected")).toHaveCount(names.length);
}
