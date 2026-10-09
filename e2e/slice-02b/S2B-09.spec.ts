import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, headPoint, item, loadFrames, loadModel, openCanvas, place, shiftClick, signInAs, toolboxAt, FRAMED } from "./helpers";

test("S2B-09: “Put in a new frame” on Customer and Customer Address makes a Customer concept frame; on two CRM tables a CRM source frame; on a mix a free frame; the card panel's “Put in a new concept frame” does the same for one card", async ({ page }) => {
  // Customer Address below Customer, and the second CRM table below the left column
  await place("Customer Address", { x: 496, y: 336 });
  await place("customer_addresses", { x: 40, y: 864 });
  const model = await loadModel();
  const conceptId = (name: string) => model.concepts.find((c) => c.name === name)!.id;
  const crm = model.sourceSystems.find((x) => x.name === "CRM")!.id;
  const newest = async (before: number) => {
    await expect.poll(async () => (await loadFrames()).length).toBe(before + 1);
    return (await loadFrames()).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).at(-1)!;
  };
  const select = async (a: string, b: string) => {
    await page.keyboard.press("Escape");
    await card(page, a).getByTestId("card-name").click();
    await shiftClick(page, await headPoint(page, b));
    await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  };

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // two entities of one concept, from the group's toolbox: a concept frame 32 px around them (40 above)
  await select("Customer", "Customer Address");
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Put in a new frame" }).click();
  await expectToast(page, "Put 2 cards in a new concept frame.");
  const customerFrame = await newest(0);
  expect(customerFrame).toMatchObject({ kind: "concept", concept_id: conceptId("Customer"), source_system_id: null, name: "Customer", x: 464, y: 0, width: 320 });
  const address = await item("Customer Address");
  expect(customerFrame.y + customerFrame.height).toBe(address.y + address.height + 32);
  expect((await item("Customer")).frame_id).toBe(customerFrame.id);
  expect(address.frame_id).toBe(customerFrame.id);

  // two CRM tables, from the selection panel: a CRM source frame
  await select("customers", "customer_addresses");
  await page.getByTestId("button-selection-put-in-frame").click();
  await expectToast(page, "Put 2 cards in a new source system frame.");
  const crmFrame = await newest(1);
  expect(crmFrame).toMatchObject({ kind: "source_system", source_system_id: crm, concept_id: null, name: "CRM" });
  expect((await item("customers")).frame_id).toBe(crmFrame.id);
  expect((await item("customer_addresses")).frame_id).toBe(crmFrame.id);
  expect((await item("web_users")).frame_id).toBeNull(); // inside the frame's rectangle, but not selected

  // an entity and a table: a free frame
  await select("Order Line", "order_line");
  await page.getByTestId("button-selection-put-in-frame").click();
  await expectToast(page, "Put 2 cards in a new frame.");
  const free = await newest(2);
  expect(free).toMatchObject({ kind: "free", concept_id: null, source_system_id: null, name: "New frame", color: "#7C8998" });
  expect((await item("Order Line")).frame_id).toBe(free.id);
  expect((await item("order_line")).frame_id).toBe(free.id);

  // one card, from the card panel: Sales Order gets a Sales concept frame
  await page.keyboard.press("Escape");
  await card(page, "Sales Order").getByTestId("card-name").click();
  const section = page.getByTestId("section-card-frame");
  await expect(section).toContainText("Not in a frame on this canvas.");
  await expect(page.getByTestId("button-card-put-in-frame")).toHaveText("Put in a new concept frame");
  await page.getByTestId("button-card-put-in-frame").click();
  await expectToast(page, "Frame added. Name it on the right. Drag cards in to add them.");
  const salesFrame = await newest(3);
  expect(salesFrame).toMatchObject({ kind: "concept", concept_id: conceptId("Sales"), name: "Sales" });
  expect((await item("Sales Order")).frame_id).toBe(salesFrame.id);
  // the card panel now names its frame
  await page.keyboard.press("Escape");
  await card(page, "Sales Order").getByTestId("card-name").click();
  await expect(page.getByTestId("link-card-frame")).toContainText("Sales");
});
