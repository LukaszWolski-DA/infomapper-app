import { blockHeight } from "../../src/domain/model/frames";
import { expect, test, type Page } from "./fixtures";
import {
  AROUND,
  blockEl,
  blockHeadPoint,
  box,
  canvasUrl,
  expectDrawnAt,
  expectToast,
  frameEl,
  frameNamed,
  isCollapsed,
  key,
  loadItems,
  makeFrame,
  namePoint,
  openCanvas,
  RETAIL,
  screenPoint,
  signInAs,
  toolboxAt,
  FRAMED,
} from "./helpers";

/** Every card's place on Customer & orders, by id. */
const places = async () => Object.fromEntries((await loadItems(RETAIL)).map((i) => [i.id, { x: i.x, y: i.y, frame: i.frame_id }]));

const collapsedToast = (name: string) => `Collapsed ${name}. Its lines are bundled; click a bundle to see what is inside.`;

test("S2C-01: a collapsed frame shows its block with kind, card count, six member rows with counts, “and N more” and the chips; no card moves; Ctrl+Z expands it and every card is back in its place", async ({ page }) => {
  await makeFrame(AROUND.all, { name: "Everything" }); // all 7 cards, a free frame
  const before = await places();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const chips = await frameEl(page, "Everything").getByTestId("frame-chip").allInnerTexts();
  expect(chips.length).toBeGreaterThan(0);

  // the label's collapse button
  await frameEl(page, "Everything").getByTestId("button-frame-collapse").click();
  await expectToast(page, collapsedToast("Everything"));
  await expect.poll(() => isCollapsed("Everything")).toBe(true);
  const block = blockEl(page, "Everything");
  await expect(block).toBeVisible();
  await expect(page.getByTestId("frame")).toHaveCount(0);
  await expect(page.locator(".react-flow__node-card")).toHaveCount(0); // its cards are not drawn
  await expect(block).toContainText("Free area");
  await expect(block.getByTestId("block-count")).toHaveText("collapsed, 7 cards");
  await expect(block.getByTestId("block-member")).toHaveCount(6);
  for (const t of await block.getByTestId("block-member").allInnerTexts()) expect(t).toMatch(/\d+\/\d+\s*$/);
  await expect(block.getByTestId("block-more")).toHaveText("and 1 more");
  // the frame's chips (a free frame has no “misplaced”)
  expect(await block.getByTestId("block-chip").allInnerTexts()).toEqual(chips);
  // at the frame's top-left corner, 280 px wide, as high as the prototype's blockH
  const f = (await frameNamed("Everything"))!;
  const b = await box(block);
  const corner = await screenPoint(page, { x: f.x, y: f.y });
  const zoom = FRAMED.zoom;
  expect(Math.abs(b.x - corner.x)).toBeLessThan(2);
  expect(Math.abs(b.y - corner.y)).toBeLessThan(2);
  expect(Math.abs(b.width - 280 * zoom)).toBeLessThan(2);
  expect(Math.abs(b.height - blockHeight(7) * zoom)).toBeLessThan(2);
  // nothing moved, also not in the data
  expect(await places()).toEqual(before);

  // one undo step: the frame is back and every card is drawn where it was
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Everything")).toBe(false);
  await expect(frameEl(page, "Everything")).toBeVisible();
  expect(await places()).toEqual(before);
  await expectDrawnAt(page, "Customer", { x: 496, y: 40 });
  await expectDrawnAt(page, "web_users", { x: 40, y: 376 });
});

/** Collapses or expands one way, waits for the data and the page, and checks that no card moved. */
async function step(page: Page, collapse: boolean, how: () => Promise<void>, before: Awaited<ReturnType<typeof places>>) {
  await how();
  await expectToast(page, collapse ? collapsedToast("Area") : "Expanded Area.");
  await expect.poll(() => isCollapsed("Area")).toBe(collapse);
  await expect(collapse ? blockEl(page, "Area") : frameEl(page, "Area")).toBeVisible();
  expect(await places()).toEqual(before);
}

test("S2C-01: collapse and expand by the label button and the block's Expand, by double-clicks on the name and the block's header, by the toolbox and by the frame panel; each is one undo step", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "Area" });
  const before = await places();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // the label's button, the block's “Expand”
  await step(page, true, () => frameEl(page, "Area").getByTestId("button-frame-collapse").click(), before);
  await step(page, false, () => blockEl(page, "Area").getByTestId("button-block-expand").click(), before);
  // each was one undo step: Ctrl+Z collapses again, a second Ctrl+Z expands
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Area")).toBe(true);
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Area")).toBe(false);
  await expect(frameEl(page, "Area")).toBeVisible();

  // a double-click on the name; a double-click on the block's header
  await step(page, true, async () => {
    const at = await namePoint(page, "Area");
    await page.mouse.dblclick(at.x, at.y);
  }, before);
  await step(page, false, async () => {
    const at = await blockHeadPoint(page, "Area");
    await page.mouse.dblclick(at.x, at.y);
  }, before);

  // the toolbox: “Collapse into one block”, then on the block “Expand”
  await step(page, true, async () => {
    await toolboxAt(page, await namePoint(page, "Area"));
    await page.getByTestId("toolbox-frame-collapse").click();
  }, before);
  await step(page, false, async () => {
    await toolboxAt(page, await blockHeadPoint(page, "Area"));
    await expect(page.getByTestId("toolbox-frame-collapse")).toHaveText(/Expand/);
    await page.getByTestId("toolbox-frame-collapse").click();
  }, before);

  // the frame panel: “Collapse frame”, then “Expand frame”
  const at = await namePoint(page, "Area");
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-frame");
  await expect(panel.getByTestId("button-frame-collapse")).toHaveText("Collapse frame");
  await step(page, true, () => panel.getByTestId("button-frame-collapse").click(), before);
  await expect(panel.getByTestId("button-frame-collapse")).toHaveText("Expand frame");
  await step(page, false, () => panel.getByTestId("button-frame-collapse").click(), before);
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Area")).toBe(true);
});
