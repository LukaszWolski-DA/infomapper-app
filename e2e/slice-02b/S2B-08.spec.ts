import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  cardMarks,
  emptyIn,
  frameMarks,
  frameNamed,
  headPoint,
  item,
  key,
  lasso,
  makeFrame,
  namePoint,
  openCanvas,
  dragCardBy,
  shiftClick,
  signInAs,
  toolboxAt,
  FRAMED,
  zoomOf,
} from "./helpers";

/** Where the frame, its two cards and web_users are, from the data. */
async function layout() {
  const f = (await frameNamed("Area"))!;
  const [customer, so, web] = [await item("Customer"), await item("Sales Order"), await item("web_users")];
  return { frame: { x: f.x, y: f.y }, customer: { x: customer.x, y: customer.y }, so: { x: so.x, y: so.y }, web: { x: web.x, y: web.y }, h: f.height };
}
const by = (p: { x: number; y: number }, d: { x: number; y: number }) => ({ x: p.x + d.x, y: p.y + d.y });

/** The frame's cards moved exactly as the frame did. */
function expectCarried(now: Awaited<ReturnType<typeof layout>>, start: Awaited<ReturnType<typeof layout>>) {
  const d = { x: now.frame.x - start.frame.x, y: now.frame.y - start.frame.y };
  expect(now.customer).toEqual(by(start.customer, d));
  expect(now.so).toEqual(by(start.so, d));
}

async function groupAction(page: Page, label: string) {
  await toolboxAt(page, await headPoint(page, "web_users"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: label }).click();
}

test("S2B-08: a lasso around a whole frame selects the frame, not its cards; group drag, nudge, align, stack and line up move frames with their cards; Ctrl+A selects frames and the cards outside frames", async ({ page }) => {
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);

  // a lasso around the whole frame catches the frame only (D-16, D-17)
  await lasso(page, { x: 456, y: -80 }, { x: 792, y: 872 });
  await expect(frameMarks(page)).toHaveCount(0); // one item is the single frame selection
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("input-frame-name")).toHaveValue("Area");
  // with web_users added (Shift+click), the group is a frame and a card
  await shiftClick(page, await headPoint(page, "web_users"));
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  await expect(page.getByTestId("selection-kinds")).toHaveText("1 table, 1 frame.");
  await expect(frameMarks(page)).toHaveCount(1);
  await expect(cardMarks(page)).toHaveCount(1); // web_users only, not the frame's cards

  // group drag by web_users: the frame and its cards move by the same amount, once
  let start = await layout();
  await dragCardBy(page, "web_users", 40 * zoom, 80 * zoom);
  await expect.poll(async () => (await layout()).web.y).not.toBe(start.web.y);
  let now = await layout();
  const d = { x: now.web.x - start.web.x, y: now.web.y - start.web.y };
  expect(now.frame).toEqual(by(start.frame, d));
  expectCarried(now, start);
  expect((await item("Customer")).frame_id).toBe(area);

  // nudge: → and Shift+↓ in one save
  start = now;
  await key(page, "ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => (await layout()).frame).toEqual(by(start.frame, { x: 8, y: 32 }));
  now = await layout();
  expect(now.web).toEqual(by(start.web, { x: 8, y: 32 }));
  expectCarried(now, start);

  // Align left: the frame lines up with web_users' left edge; one Ctrl+Z puts it back
  start = now;
  await groupAction(page, "Align left");
  await expect.poll(async () => (await layout()).frame.x).toBe(start.web.x);
  now = await layout();
  expect(now.web).toEqual(start.web);
  expectCarried(now, start);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).frame).toEqual(start.frame);

  // Stack in a column: the frame is first (higher), web_users 64 px below it (after a frame)
  await groupAction(page, "Stack in a column");
  await expect.poll(async () => (await layout()).web.y).toBe(Math.ceil((start.frame.y + start.h + 64) / 8) * 8);
  now = await layout();
  expect(now.web.x).toBe(start.frame.x);
  expect(now.frame).toEqual(start.frame);
  await key(page, "Control+z");
  await expect.poll(async () => (await layout()).web).toEqual(start.web);

  // Line up in a row: web_users first (left), the frame 64 px after it, at web_users' top
  await groupAction(page, "Line up in a row");
  await expect.poll(async () => (await layout()).frame.x).toBe(Math.ceil((start.web.x + 256 + 64) / 8) * 8);
  now = await layout();
  expect(now.frame.y).toBe(start.web.y);
  expectCarried(now, start);

  // Ctrl+A: the frame and every card in no frame (5), not the frame's cards
  await key(page, "Control+a");
  await expect(frameMarks(page)).toHaveCount(1);
  await expect(cardMarks(page)).toHaveCount(5);
  await expect(page.getByTestId("selection-kinds")).toHaveText("1 entity, 4 tables, 1 frame.");
  // Shift+click without moving on an empty spot inside the frame takes it out and puts it back (answer 2 of step 4);
  // Shift+click on its name does the same
  await shiftClick(page, await emptyIn(page, "Area"));
  await expect(frameMarks(page)).toHaveCount(0);
  await expect(page.getByTestId("selection-count")).toHaveText("5 items selected");
  await shiftClick(page, await emptyIn(page, "Area"));
  await expect(frameMarks(page)).toHaveCount(1);
  await shiftClick(page, await namePoint(page, "Area"));
  await expect(frameMarks(page)).toHaveCount(0);
  await shiftClick(page, await namePoint(page, "Area"));
  await expect(page.getByTestId("selection-count")).toHaveText("6 items selected");
});
