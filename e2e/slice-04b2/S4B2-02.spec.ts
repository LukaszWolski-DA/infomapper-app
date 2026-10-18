// S4B2-02 (slice 4b-2, PRD items 5–7, 13, L): a requirement card's lifecycle. Placed from the requirement's panel at the
// top centre of the view; one card per requirement per canvas; moved on the 8 px grid, and dropped onto a frame it stays
// outside it; removed from the panel and from the card's menu; Delete on the selected card removes the card only;
// deleting the requirement removes its cards from every canvas and one undo brings them back; selecting several takes
// the card along in a group drag, undone in one step.

import { expect, test, type Page } from "./fixtures";
import {
  box,
  canvasUrl,
  dragCardBy,
  key,
  loadFrames,
  loadItems,
  loadRequirementCards,
  loadRequirements,
  makeFrame,
  openCanvas,
  openRequirement,
  placeReqCards,
  RETAIL,
  reqCard,
  reqCardData,
  screenPoint,
  SEED_IDS,
  signInAs,
} from "./helpers";

const VIEW = { x: 10, y: 10, zoom: 0.42 };

/** The part of the board in view, from the viewport's transform and the pane's size. */
const viewRect = (page: Page) =>
  page.evaluate(() => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec((document.querySelector(".react-flow__viewport") as HTMLElement).style.transform)!;
    const [tx, ty, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    return { x: -tx / z, y: -ty / z, w: pane.width / z, h: pane.height / z };
  });

/** Drags a requirement card by (dx, dy) screen pixels with the real mouse, from its name. */
async function dragReqCard(page: Page, keyName: string, to: { x: number; y: number }) {
  const b = await box(reqCard(page, keyName).getByTestId("card-name"));
  const from = { x: b.x + 20, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

test("S4B2-02: placed from the panel, moved on the grid and kept out of frames, removed from the panel, the menu and by Delete; deleting the requirement removes its cards everywhere, undo restores them; a group drag takes it along", async ({ page }) => {
  // test data: a free frame to the right of the cards
  const frameId = await makeFrame({ x: 1600, y: 0, width: 640, height: 480 }, { name: "Elsewhere" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  // placed from the requirement's panel, at the top centre of the view, on the grid
  await openRequirement(page, "REQ-101");
  await expect(page.getByTestId("button-requirement-uncard")).toHaveCount(0);
  await page.getByTestId("button-requirement-card").click();
  await expect(reqCard(page, "REQ-101")).toBeVisible();
  const v = await viewRect(page);
  const placed = (await reqCardData("REQ-101"))!;
  expect(placed.x).toBe(Math.round((v.x + v.w / 2 - 115) / 8) * 8);
  expect(placed.y).toBe(Math.round((v.y + 60) / 8) * 8);
  expect(placed).toMatchObject({ frame_id: null, width: null, entity_id: null, source_table_id: null });
  // one card per requirement per canvas: the panel now offers to remove it, not to place another
  await expect(page.getByTestId("button-requirement-card")).toHaveCount(0);
  await expect(page.getByTestId("button-requirement-uncard")).toBeVisible();

  // moved on the grid; dropped onto the frame, it stays outside it and the frame keeps its size
  const inside = await screenPoint(page, { x: 1760, y: 160 });
  await dragReqCard(page, "REQ-101", inside);
  await expect.poll(async () => (await reqCardData("REQ-101"))!.version).toBeGreaterThan(placed.version);
  const moved = (await reqCardData("REQ-101"))!;
  expect(moved.x % 8).toBe(0);
  expect(moved.y % 8).toBe(0);
  expect(moved.x).toBeGreaterThan(1600);
  expect(moved.frame_id).toBeNull();
  expect((await loadFrames()).find((f) => f.id === frameId)).toMatchObject({ x: 1600, y: 0, width: 640, height: 480 });

  // removed from the panel: the card goes, the requirement stays
  await openRequirement(page, "REQ-101");
  await page.getByTestId("button-requirement-uncard").click();
  await expect(reqCard(page, "REQ-101")).toHaveCount(0);
  await expect.poll(() => reqCardData("REQ-101")).toBeUndefined();

  // placed again, removed from the card's menu
  await page.getByTestId("button-requirement-card").click();
  await expect(reqCard(page, "REQ-101")).toBeVisible();
  const at = await box(reqCard(page, "REQ-101").getByTestId("card-name"));
  await page.mouse.click(at.x + 20, at.y + at.height / 2, { button: "right" });
  await expect(page.getByTestId("menu-toolbox")).toBeVisible();
  await page.getByTestId("toolbox-requirement-remove").click();
  await expect(reqCard(page, "REQ-101")).toHaveCount(0);
  await expect.poll(() => reqCardData("REQ-101")).toBeUndefined();

  // Delete on the selected card removes the card only
  await openRequirement(page, "REQ-101");
  await page.getByTestId("button-requirement-card").click();
  await expect(reqCard(page, "REQ-101")).toBeVisible();
  await reqCard(page, "REQ-101").getByTestId("card-name").click();
  await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
  await key(page, "Delete");
  await expect(reqCard(page, "REQ-101")).toHaveCount(0);
  await expect.poll(() => reqCardData("REQ-101")).toBeUndefined();
  expect((await loadRequirements()).find((r) => r.key === "REQ-101")).toBeDefined();

  // deleting the requirement removes its cards from every canvas; one undo brings them back
  await placeReqCards([{ key: "REQ-104", x: 40, y: 900 }], SEED_IDS.canvasOrderLines);
  await openCanvas(page, canvasUrl(), VIEW);
  await expect(reqCard(page, "REQ-104")).toBeVisible();
  await openRequirement(page, "REQ-104");
  await page.getByTestId("button-delete-requirement").click();
  await expect(reqCard(page, "REQ-104")).toHaveCount(0);
  await expect.poll(async () => (await loadRequirementCards()).length + (await loadRequirementCards(RETAIL, SEED_IDS.canvasOrderLines)).length).toBe(0);
  await page.getByTestId("button-undo").click();
  await expect(reqCard(page, "REQ-104")).toBeVisible();
  await expect.poll(async () => [(await reqCardData("REQ-104")) !== undefined, (await reqCardData("REQ-104", SEED_IDS.canvasOrderLines)) !== undefined]).toEqual([true, true]);

  // Ctrl+A takes the requirement card into the selection; a group drag moves it with the cards, one undo puts all back
  await openCanvas(page, canvasUrl(), VIEW);
  await key(page, "Control+a");
  await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
  const reqBefore = (await reqCardData("REQ-104"))!;
  const customerBefore = (await loadItems()).find((i) => i.entity_id !== null && i.x === 496 && i.y === 40)!;
  await dragCardBy(page, "Customer", 42, 0);
  await expect.poll(async () => (await reqCardData("REQ-104"))!.x).not.toBe(reqBefore.x);
  const reqAfter = (await reqCardData("REQ-104"))!;
  const customerAfter = (await loadItems()).find((i) => i.id === customerBefore.id)!;
  expect(reqAfter.x - reqBefore.x).toBe(customerAfter.x - customerBefore.x);
  expect(reqAfter.y).toBe(reqBefore.y);
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => [(await reqCardData("REQ-104"))!.x, (await loadItems()).find((i) => i.id === customerBefore.id)!.x]).toEqual([reqBefore.x, customerBefore.x]);
});
