import { expect, test } from "./fixtures";
import {
  card,
  expectCard,
  expectToast,
  ids,
  labelItem,
  labelNamed,
  linkedTo,
  liveCards,
  liveUrl,
  loadModel,
  openCanvas,
  openLiveFor,
  RETAIL,
  signInAs,
  store,
  treeItem,
} from "./helpers";

test("S3B-10: dropping an entity on the live canvas asks; “Add CR-23” labels and places it where dropped; “Cancel” changes nothing; the Entity tool labels without asking; bulk adds are refused with the prototype's toast", async ({ page }) => {
  test.setTimeout(150_000);
  const { entity } = await ids();
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 1 });
  const pane = page.locator(".react-flow__pane");
  const area = (await pane.boundingBox())!;

  // “Cancel” changes nothing
  const links = await linkedTo("CR-23");
  await treeItem(page, "Order Line").dragTo(pane, { targetPosition: { x: area.width - 320, y: 120 } });
  await expect(page.getByTestId("text-live-question")).toHaveText("Label Order Line with CR-23? It then appears on this live canvas.");
  await expect(page.getByTestId("button-live-yes")).toHaveText("Add CR-23");
  await page.getByTestId("button-live-no").click();
  await expect(page.getByTestId("dialog-live-question")).toHaveCount(0);
  expect(await linkedTo("CR-23")).toEqual(links);
  expect((await liveCards(live)).some(([id]) => id === entity("Order Line").id)).toBe(false);

  // “Add CR-23” labels Sales Order and places it where dropped (its header's top middle under the mouse), one change
  await treeItem(page, "Sales Order").dragTo(pane, { targetPosition: { x: area.width - 320, y: 160 } });
  await page.getByTestId("button-live-yes").click();
  await expectToast(page, "Sales Order is now labeled CR-23.");
  await expect.poll(() => linkedTo("CR-23")).toContain(entity("Sales Order").id);
  await expect.poll(() => liveCards(live)).toContainEqual([entity("Sales Order").id, "full", "all"]);
  const placed = (await store().canvasItems.listOfCanvas(RETAIL, live)).find((i) => i.entity_id === entity("Sales Order").id)!;
  expect(placed.x).toBeGreaterThan(area.width - 320 - 256);
  expect(placed.y).toBeLessThan(200);
  await expectCard(page, "Sales Order");

  // the Entity tool labels the new entity without a question; its toast ends “, labeled CR-23”
  await openCanvas(page, liveUrl(live), { x: 0, y: -900, zoom: 1 });
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(area.x + 300, area.y + 200);
  await expect(page.getByTestId("dialog-live-question")).toHaveCount(0);
  await expectToast(page, /^Created New entity in .+, labeled CR-23\. Type its name now; change the concept in the panel\.$/);
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "New entity")).toBe(true);
  const created = (await loadModel()).entities.find((e) => e.name === "New entity")!;
  await expect.poll(() => linkedTo("CR-23")).toContain(created.id);
  await page.keyboard.press("Escape");

  // bulk adds: a live canvas of a label only on Customer offers its two feeding sources as “Add all”: refused
  await labelItem("LIVE-1", { kind: "entity", id: entity("Customer").id });
  const only = await openLiveFor("LIVE-1");
  expect((await labelNamed("LIVE-1"))).toBeTruthy();
  await openCanvas(page, liveUrl(only), { x: 0, y: 0, zoom: 1 });
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("button-feed-all").click();
  await expectToast(page, "On a live canvas, add cards one at a time: each one gets the label first.");
  expect(await liveCards(only)).toHaveLength(1);
});
