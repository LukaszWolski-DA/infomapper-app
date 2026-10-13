import { expect, test } from "./fixtures";
import {
  AROUND,
  canvasUrl,
  card,
  contextOn,
  dragCardBy,
  emptySpot,
  expectToast,
  FRAMED,
  ids,
  labelNamed,
  lastGroup,
  linkedTo,
  loadItems,
  loadModel,
  loadNotes,
  makeFrame,
  namePoint,
  openCanvas,
  rowNamed,
  signInAs,
  toolboxAt,
} from "./helpers";

test("S3B-03: with CR-23 on, moving a card, resizing it, collapsing a frame, writing a note, deleting an attribute and moving an attribute add no label beyond the moved attribute (Q2)", async ({ page }) => {
  test.setTimeout(180_000);
  const cr23 = (await labelNamed("CR-23"))!;
  const { attribute } = await ids();
  await makeFrame({ ...AROUND.customers, x: AROUND.customers.x - 16, y: AROUND.customers.y - 16, width: AROUND.customers.width + 32, height: AROUND.customers.height + 32 }, { name: "Tables" });
  const before = new Set(await linkedTo("CR-23"));
  const added = async () => (await linkedTo("CR-23")).filter((id) => !before.has(id));
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.8 });

  // moving a card: layout, not labeled (the context is still recorded on the change)
  const customer = (await loadItems()).find((i) => i.entity_id === attribute("Customer", "email").entity_id)!;
  await dragCardBy(page, "Customer", 40, 24);
  await expect.poll(async () => (await loadItems()).find((i) => i.id === customer.id)!.version).toBeGreaterThan(customer.version);
  expect((await lastGroup()).every((e) => e.context_label_id === cr23.id)).toBe(true);
  expect(await added()).toEqual([]);

  // resizing a card (“Fit width to names”): not labeled
  const moved = (await loadItems()).find((i) => i.id === customer.id)!;
  const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: /Fit width to names/ }).click();
  await expect.poll(async () => (await loadItems()).find((i) => i.id === customer.id)!.version).toBeGreaterThan(moved.version);
  expect(await added()).toEqual([]);

  // collapsing a frame: not labeled
  await openCanvas(page, canvasUrl(), FRAMED);
  await toolboxAt(page, await namePoint(page, "Tables"));
  await page.getByTestId("toolbox-frame-collapse").click();
  await expect(page.getByTestId("block")).toHaveCount(1);
  expect(await added()).toEqual([]);

  // writing a note: not labeled
  const notes = (await loadNotes()).length;
  await page.getByTestId("button-tool-note").click();
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.type("Check this with the business");
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => (await loadNotes()).length).toBe(notes + 1);
  expect(await added()).toEqual([]);

  // deleting an attribute: not labeled (its own link goes with it)
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  const segment = attribute("Customer", "segment_code");
  await rowNamed(page, "Customer", "segment_code").click();
  await page.getByTestId("button-delete-attribute").click();
  await expectToast(page, "Attribute deleted");
  await expect.poll(async () => (await loadModel()).attributes.some((a) => a.id === segment.id)).toBe(false);
  expect(await added()).toEqual([]);

  // moving an attribute (Alt+↓): only the moved attribute is labeled, not the one renumbered around it
  const first = attribute("Customer", "first_name");
  const order = async () => (await loadModel()).attributes.filter((a) => a.entity_id === first.entity_id).sort((a, b) => a.sort_order - b.sort_order).map((a) => a.id);
  const was = await order();
  const at = was.indexOf(first.id);
  await rowNamed(page, "Customer", "first_name").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(async () => (await order()).indexOf(first.id)).toBe(at + 1);
  await expect.poll(added).toEqual([first.id]);
  expect((await lastGroup()).filter((e) => e.object_type === "attribute").length).toBeGreaterThan(1); // the neighbour was renumbered too
});
