import { blockHeight } from "../../src/domain/model/frames";
import { expect, test, type Page } from "./fixtures";
import {
  AROUND,
  blockEl,
  blockHeadPoint,
  canvasUrl,
  collapsedFrame,
  dragBetween,
  frameMarks,
  frameNamed,
  headPoint,
  item,
  key,
  lasso,
  openCanvas,
  shiftClick,
  signInAs,
  toolboxAt,
  toolboxLabels,
  expectDrawnAt,
  screenPoint,
  FRAMED,
  zoomOf,
} from "./helpers";

/** The frame Area (collapsed, with Customer hidden in it) and web_users, from the data. */
async function layout() {
  const f = (await frameNamed("Area"))!;
  const [customer, web] = [await item("Customer"), await item("web_users")];
  return { frame: { x: f.x, y: f.y }, customer: { x: customer.x, y: customer.y }, web: { x: web.x, y: web.y } };
}
const by = (p: { x: number; y: number }, d: { x: number; y: number }) => ({ x: p.x + d.x, y: p.y + d.y });

/** Customer moved exactly as its frame did, and stayed in it. */
async function expectCarried(now: Awaited<ReturnType<typeof layout>>, start: Awaited<ReturnType<typeof layout>>, frameId: string) {
  expect(now.customer).toEqual(by(start.customer, { x: now.frame.x - start.frame.x, y: now.frame.y - start.frame.y }));
  expect((await item("Customer")).frame_id).toBe(frameId);
}

/** After an undo the page may still lag the data: wait until the block is drawn where the frame now is. */
async function expectBlockAt(page: Page, at: { x: number; y: number }) {
  await expect
    .poll(async () => {
      const b = await blockEl(page, "Area").boundingBox();
      const want = await screenPoint(page, at);
      return !!b && Math.abs(b.x - want.x) < 2 && Math.abs(b.y - want.y) < 2;
    })
    .toBe(true);
}

async function groupAction(page: Page, label: string) {
  await toolboxAt(page, await headPoint(page, "web_users"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: label }).click();
}

test("S2C-03: the block is selected by a click and moved by its header with its hidden cards (one undo step); its toolbox offers “Expand”, no fit, “Select its cards” disabled, and no resize", async ({ page }) => {
  const area = await collapsedFrame(AROUND.customer, { name: "Area" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);

  // a click selects the frame
  const head = await blockHeadPoint(page, "Area");
  await page.mouse.click(head.x, head.y);
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("input-frame-name")).toHaveValue("Area");
  await expect(blockEl(page, "Area")).toHaveAttribute("aria-selected", "true");

  // dragging its header moves the frame and its hidden card by the same amount, snapped to 8 px
  const start = await layout();
  await dragBetween(page, head, { x: head.x + 80 * zoom, y: head.y + 160 * zoom });
  await expect.poll(async () => (await layout()).frame).toEqual(by(start.frame, { x: 80, y: 160 }));
  await expectCarried(await layout(), start, area);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).frame).toEqual(start.frame);
  expect((await layout()).customer).toEqual(start.customer);

  // the block's toolbox: “Expand” instead of “Collapse into one block”, no “Fit frame to its content”,
  // “Select its cards” disabled; no resize handle anywhere (the frame is not drawn)
  await expect.poll(async () => {
    const b = blockEl(page, "Area");
    return (await b.boundingBox()) !== null;
  }).toBe(true);
  const labels = await toolboxLabels(page, await blockHeadPoint(page, "Area"));
  expect(labels).toContain("Expand");
  expect(labels).not.toContain("Collapse into one block");
  expect(labels).not.toContain("Fit frame to its content");
  await expect(page.getByTestId("toolbox-frame-select-cards")).toBeDisabled();
  await key(page, "Escape");
  await expect(page.getByTestId("frame-resize")).toHaveCount(0);
});

test("S2C-03: a lasso around the block selects the frame; with a card it takes part in group drag, nudge and align as a unit with the block's size", async ({ page }) => {
  const area = await collapsedFrame(AROUND.customer, { name: "Area" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);

  // a lasso only partly around the block catches nothing; fully around it, the frame (D-16, D-17)
  await lasso(page, { x: 800, y: 60 }, { x: 500, y: -40 });
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await lasso(page, { x: 800, y: blockHeight(1) + 16 }, { x: 464, y: -40 });
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("input-frame-name")).toHaveValue("Area");

  // with web_users: a frame and a card
  await shiftClick(page, await headPoint(page, "web_users"));
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  await expect(page.getByTestId("selection-kinds")).toHaveText("1 table, 1 frame.");
  await expect(frameMarks(page)).toHaveCount(1);

  // group drag by web_users: the frame and its hidden card move with it
  let start = await layout();
  await dragBetween(page, await headPoint(page, "web_users"), { x: (await headPoint(page, "web_users")).x + 40 * zoom, y: (await headPoint(page, "web_users")).y - 80 * zoom });
  await expect.poll(async () => (await layout()).web.y).not.toBe(start.web.y);
  let now = await layout();
  const d = { x: now.web.x - start.web.x, y: now.web.y - start.web.y };
  expect(now.frame).toEqual(by(start.frame, d));
  await expectCarried(now, start, area);

  // nudge: → and Shift+↓ move the block with its hidden card, saved together, one undo step
  start = now;
  await key(page, "ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => (await layout()).frame).toEqual(by(start.frame, { x: 8, y: 32 }));
  now = await layout();
  expect(now.web).toEqual(by(start.web, { x: 8, y: 32 }));
  await expectCarried(now, start, area);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).frame).toEqual(start.frame);
  expect((await layout()).customer).toEqual(start.customer);

  // Align left: the block lines up with web_users' left edge, its hidden card carried; one Ctrl+Z puts it back
  await expectBlockAt(page, start.frame);
  await expectDrawnAt(page, "web_users", start.web);
  await groupAction(page, "Align left");
  await expect.poll(async () => (await layout()).frame.x).toBe(start.web.x);
  now = await layout();
  expect(now.web).toEqual(start.web);
  await expectCarried(now, start, area);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).frame).toEqual(start.frame);

  // Line up in a row: web_users first, then the block 64 px after it (the block's width counts, not the frame's)
  await expectBlockAt(page, start.frame);
  await expectDrawnAt(page, "web_users", start.web);
  await groupAction(page, "Line up in a row");
  await expect.poll(async () => (await layout()).frame.x).toBe(Math.ceil((start.web.x + 256 + 64) / 8) * 8);
  now = await layout();
  expect(now.frame.y).toBe(start.web.y);
  await expectCarried(now, start, area);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).frame).toEqual(start.frame);

  // Stack in a column: the block first (higher), web_users 64 px below the block, not below the frame's 360 px
  await expectBlockAt(page, start.frame);
  await expectDrawnAt(page, "web_users", start.web);
  await groupAction(page, "Stack in a column");
  await expect.poll(async () => (await layout()).web.y).toBe(Math.ceil((start.frame.y + blockHeight(1) + 64) / 8) * 8);
  expect((await layout()).frame).toEqual(start.frame);
});
