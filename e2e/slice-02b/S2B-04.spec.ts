import { expect, test } from "./fixtures";
import {
  box,
  canvasUrl,
  dragBetween,
  emptyIn,
  expectDrawnAt,
  expectToast,
  frameEl,
  frameNamed,
  ids,
  item,
  key,
  lineEnds,
  makeFrame,
  mappingLine,
  namePoint,
  openCanvas,
  screenPoint,
  signInAs,
  FRAMED,
  zoomOf,
} from "./helpers";

test("S2B-04: dragging a frame by its name, and by an empty spot inside it, moves it with its cards and lines; one Ctrl+Z puts all back; after a reload the positions are kept", async ({ page }) => {
  const { model, attribute, column } = await ids();
  await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  // a mapping from customers (not in the frame) into Customer: its Customer end follows the frame
  const line = model.mappings.find((m) => m.attribute_id === attribute("Customer", "email").id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === column("customers", "email_addr").id))!;
  const snapshot = async () => ({ frame: (await frameNamed("Area"))!, customer: await item("Customer"), so: await item("Sales Order"), customers: await item("customers") });
  const start = await snapshot();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);
  const endsBefore = (await lineEnds(mappingLine(page, line.id)))[0]!;

  // by its name
  const name = await namePoint(page, "Area");
  await dragBetween(page, name, { x: name.x + 90, y: name.y + 45 });
  await expect.poll(async () => (await frameNamed("Area"))!.x).not.toBe(start.frame.x);
  const moved = await snapshot();
  const d = { x: moved.frame.x - start.frame.x, y: moved.frame.y - start.frame.y };
  expect(d.x % 8).toBe(0);
  expect(d.y % 8).toBe(0);
  expect(Math.abs(d.x - 90 / zoom)).toBeLessThan(16);
  expect(Math.abs(d.y - 45 / zoom)).toBeLessThan(16);
  expect(moved.customer).toMatchObject({ x: start.customer.x + d.x, y: start.customer.y + d.y, frame_id: start.frame.id });
  expect(moved.so).toMatchObject({ x: start.so.x + d.x, y: start.so.y + d.y, frame_id: start.frame.id });
  expect(moved.customers).toMatchObject({ x: start.customers.x, y: start.customers.y }); // not in the frame
  // the line's Customer end moved with the card, its customers end stayed
  await expectDrawnAt(page, "Customer", { x: moved.customer.x, y: moved.customer.y });
  const endsAfter = (await lineEnds(mappingLine(page, line.id)))[0]!;
  const shift = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  const moves = [shift(endsBefore.start, endsAfter.start), shift(endsBefore.end, endsAfter.end)].sort((a, b) => a - b);
  expect(moves[0]).toBeLessThan(1.5);
  expect(Math.abs(moves[1]! - Math.hypot(d.x, d.y) * zoom)).toBeLessThan(1.5);

  // one Ctrl+Z puts the frame and its cards back
  await key(page, "Control+z");
  await expectToast(page, /^Undone: /);
  await expect.poll(async () => (await frameNamed("Area"))!.x).toBe(start.frame.x);
  const back = await snapshot();
  expect(back.frame).toMatchObject({ x: start.frame.x, y: start.frame.y });
  expect(back.customer).toMatchObject({ x: start.customer.x, y: start.customer.y });
  expect(back.so).toMatchObject({ x: start.so.x, y: start.so.y });
  await expectDrawnAt(page, "Customer", { x: start.customer.x, y: start.customer.y });

  // by an empty spot inside it
  const spot = await emptyIn(page, "Area");
  await dragBetween(page, spot, { x: spot.x - 45, y: spot.y + 90 });
  await expect.poll(async () => (await frameNamed("Area"))!.y).not.toBe(start.frame.y);
  const again = await snapshot();
  const e = { x: again.frame.x - start.frame.x, y: again.frame.y - start.frame.y };
  expect(again.customer).toMatchObject({ x: start.customer.x + e.x, y: start.customer.y + e.y });
  expect(again.so).toMatchObject({ x: start.so.x + e.x, y: start.so.y + e.y });

  // after a reload: drawn where saved
  await openCanvas(page, canvasUrl(), FRAMED);
  const drawn = await box(frameEl(page, "Area"));
  const saved = await screenPoint(page, { x: again.frame.x, y: again.frame.y });
  expect(Math.abs(drawn.x - saved.x)).toBeLessThan(2);
  expect(Math.abs(drawn.y - saved.y)).toBeLessThan(2);
  await expectDrawnAt(page, "Customer", { x: again.customer.x, y: again.customer.y });
  await expectDrawnAt(page, "Sales Order", { x: again.so.x, y: again.so.y });
});
