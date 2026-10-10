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
  // each was one undo step: Ctrl+Z collapses again, a second Ctrl+Z expands (after an undo the page may lag the
  // data: wait until it shows each state, so the next collapse is sent with the frame's latest version)
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Area")).toBe(true);
  await expect(blockEl(page, "Area")).toBeVisible();
  await key(page, "Control+z");
  await expect.poll(() => isCollapsed("Area")).toBe(false);
  await expect(frameEl(page, "Area")).toBeVisible();
  await expect(blockEl(page, "Area")).toHaveCount(0);

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

test("S2C-01: the label's collapse button sits just left of the name, on its row, covers neither the name nor the chips and is clickable at 25 %, 40 %, 100 % and 300 %", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "Area" }); // at 480, 0
  await signInAs(page, "Łukasz");
  for (const zoom of [0.25, 0.4, 1, 3]) {
    // the frame's top-left corner 300 px from the pane's left and 200 px from its top
    await openCanvas(page, canvasUrl(), { x: 300 - 480 * zoom, y: 200, zoom });
    const frame = frameEl(page, "Area");
    const button = await box(frame.getByTestId("button-frame-collapse"));
    const name = await box(frame.getByTestId("frame-name"));
    const label = await box(frame.getByTestId("frame-label"));
    // left of the label, on its row (the label's middle within the button's height)
    expect(button.x + button.width, `zoom ${zoom}: left of the label`).toBeLessThanOrEqual(label.x + 0.5);
    const mid = label.y + label.height / 2 - 3.5; // the row's middle above the label's 7 px bottom padding
    expect(Math.abs(button.y + button.height / 2 - mid), `zoom ${zoom}: on the label's row`).toBeLessThan(button.height / 2);
    expect(button.x + button.width, `zoom ${zoom}: not over the name`).toBeLessThanOrEqual(name.x);
    for (const chip of await frame.getByTestId("frame-chip").all()) expect(button.x + button.width).toBeLessThanOrEqual((await box(chip)).x);
    // the same size on the screen at every zoom
    expect(Math.abs(button.height - 20), `zoom ${zoom}: 20 px high`).toBeLessThan(1);
    // nothing covers its middle
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="button-frame-collapse"]') !== null, { x: button.x + button.width / 2, y: button.y + button.height / 2 });
    expect(hit, `zoom ${zoom}: clickable`).toBe(true);
  }
  // at 300 % a click collapses the frame
  const at = await box(frameEl(page, "Area").getByTestId("button-frame-collapse"));
  await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  await expect.poll(() => isCollapsed("Area")).toBe(true);
  await expect(blockEl(page, "Area")).toBeVisible();
});
