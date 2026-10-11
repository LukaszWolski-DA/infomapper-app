import { expect, test } from "./fixtures";
import {
  box,
  callActionDirectly,
  canvasUrl,
  captureActionId,
  card,
  CO,
  dragBetween,
  expectToast,
  frameEl,
  frameMarks,
  cardMarks,
  frameNamed,
  headPoint,
  heightOf,
  item,
  key,
  loadFrames,
  loadItems,
  loadModel,
  namePoint,
  newSession,
  openCanvas,
  RETAIL,
  screenPoint,
  shiftClick,
  store,
  toolboxAt,
  toolboxLabels,
  viewOf,
  FRAMED,
} from "./helpers";

/** Everything a reviewer's direct calls could change: every frame and every card of the workspace. */
const snapshot = async () => ({ frames: await store().frames.list(RETAIL), items: await store().canvasItems.list(RETAIL) });

test("S2B-13: as Piotr (reviewer), frames can be selected, zoomed to and their cards selected; no drawing, moving, resizing, editing, arranging or deleting is offered; those commands called directly are refused", async ({ browser }) => {
  test.setTimeout(180_000);

  // Łukasz (owner) uses each frame write once, so its action id can be called again directly as Piotr
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, canvasUrl(), FRAMED);
  await key(o, "a");
  const from = await screenPoint(o, { x: 464, y: 8 }), to = await screenPoint(o, { x: 792, y: 864 });
  const createId = await captureActionId(o, () => dragBetween(o, from, to));
  await expect(o.getByTestId("input-frame-name")).toBeFocused();
  await o.keyboard.press("Control+a");
  await o.keyboard.type("Area");
  const updateId = await captureActionId(o, () => o.keyboard.press("Enter"));
  await expect(frameEl(o, "Area")).toBeVisible();
  const name = await namePoint(o, "Area");
  const moveId = await captureActionId(o, () => dragBetween(o, name, { x: name.x + 20, y: name.y + 20 }));
  const handle = await box(frameEl(o, "Area").getByTestId("frame-resize"));
  const h = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  const resizeId = await captureActionId(o, () => dragBetween(o, h, { x: h.x + 30, y: h.y + 30 }));
  await toolboxAt(o, await namePoint(o, "Area"));
  const fitId = await captureActionId(o, () => o.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Fit frame to its content" }).click());
  const area = await namePoint(o, "Area");
  await o.mouse.click(area.x, area.y);
  await expect(frameEl(o, "Area")).toHaveAttribute("data-selected", "true");
  const deleteId = await captureActionId(o, () => key(o, "Delete"));
  await expectToast(o, "Deleted the frame Area. Everything inside stays on the canvas.");
  await card(o, "Order Line").getByTestId("card-name").click();
  await shiftClick(o, await headPoint(o, "order_line"));
  const putId = await captureActionId(o, () => o.getByTestId("button-selection-put-in-frame").click());
  await expectToast(o, "Put 2 cards in a new frame.");
  // a free frame would stay through “Arrange”: it goes first, so Piotr sees the five arranged frames only
  await toolboxAt(o, await namePoint(o, "New frame"));
  await o.getByTestId("toolbox-frame-delete").click();
  await expect.poll(async () => (await loadFrames()).length).toBe(0);
  await key(o, "Escape");
  const arrangeId = await captureActionId(o, () => o.getByTestId("button-arrange-frames").click());
  await expectToast(o, "Arranged the canvas into 5 frames. Undo restores your previous layout.");
  await expect.poll(async () => (await loadFrames()).length).toBe(5);
  await owner.context.close();
  const before = await snapshot();

  // Piotr: no Frame tool, no resize handles, no arrange button; A does nothing
  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(page.getByTestId("frame")).toHaveCount(5);
  await expect(page.getByTestId("button-tool-frame")).toHaveCount(0);
  await expect(page.getByTestId("frame-resize")).toHaveCount(0);
  await expect(page.getByTestId("button-arrange-frames")).toHaveCount(0);
  await key(page, "a");
  await expect(page.getByTestId("area-canvas")).not.toHaveAttribute("data-mode", "frame");

  // he selects a frame: its panel is read-only, with only “Zoom to frame”
  const sales = await namePoint(page, "Sales");
  await page.mouse.click(sales.x, sales.y);
  await expect(frameEl(page, "Sales")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("input-frame-name")).toHaveAttribute("readonly", "");
  for (const b of await page.getByTestId("seg-frame-kind").getByRole("button").all()) await expect(b).toBeDisabled();
  await expect(page.getByTestId("select-frame-concept")).toBeDisabled();
  await expect(page.getByTestId("button-frame-fit")).toHaveCount(0);
  await expect(page.getByTestId("button-frame-delete")).toHaveCount(0);
  await expect(page.getByTestId("button-frame-move-entity")).toHaveCount(0);
  const v0 = await viewOf(page);
  await page.getByTestId("button-frame-zoom").click();
  await expect.poll(() => viewOf(page)).not.toBe(v0);

  // the frame's toolbox offers “Select its cards” and “Zoom to frame”, and since slice 2c (item 11) “Collapse into one
  // block”, in his own tab only; selecting its cards works
  await openCanvas(page, canvasUrl(), FRAMED);
  // slice 3a: a reviewer writes notes (Łukasz's step 0 answer 1)
  expect(await toolboxLabels(page, await namePoint(page, "Sales"))).toEqual(["Collapse into one block", "Select its cards", "Zoom to frame", "Add a note to this frame"]);
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Select its cards" }).click();
  await expect(cardMarks(page)).toHaveCount(2);
  await expect(page.getByTestId("selection-kinds")).toHaveText("2 entities.");

  // dragging a frame, Delete on a selected frame, a lasso and Ctrl+A with frames change nothing
  const at = await namePoint(page, "Sales");
  await dragBetween(page, at, { x: at.x + 60, y: at.y + 40 });
  await page.mouse.click(at.x, at.y);
  await key(page, "Delete");
  await key(page, "Control+a");
  await expect(frameMarks(page)).toHaveCount(5);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  expect(await snapshot()).toEqual(before);

  // direct server calls are refused with the domain's message and change nothing
  const model = await loadModel();
  const frames = await loadFrames();
  const items = await loadItems();
  const f = (await frameNamed("Sales"))!;
  const members = items.filter((i) => i.frame_id === f.id);
  const ref = (i: (typeof items)[number]) => ({ canvasItemId: i.id, expectedVersion: i.version });
  const sized = (i: (typeof items)[number]) => ({ ...ref(i), height: heightOf(model, i) });
  const fref = { frameId: f.id, expectedVersion: f.version };
  const free = await item("web_users");
  const replies = {
    create: await callActionDirectly(page, createId, [RETAIL, CO, { x: 1600, y: 0, width: 480, height: 320, cards: items.map(sized) }]),
    update: await callActionDirectly(page, updateId, [RETAIL, { ...fref, name: "Renamed" }]),
    move: await callActionDirectly(page, moveId, [RETAIL, CO, { frames: [{ ...fref, x: f.x + 80, y: f.y }], items: [] }]),
    resize: await callActionDirectly(page, resizeId, [RETAIL, { ...fref, width: f.width + 80, height: f.height, cards: items.map(ref) }]),
    fit: await callActionDirectly(page, fitId, [RETAIL, { ...fref, cards: items.map(sized) }]),
    delete: await callActionDirectly(page, deleteId, [RETAIL, { ...fref, cards: members.map(ref) }]),
    put: await callActionDirectly(page, putId, [RETAIL, CO, { cards: [sized(free)] }]),
    arrange: await callActionDirectly(page, arrangeId, [RETAIL, CO, { frames: frames.map((x) => ({ frameId: x.id, expectedVersion: x.version })), cards: items.map(sized) }]),
  };
  for (const [k, reply] of Object.entries(replies)) expect(reply, k).toContain("As a reviewer you cannot change what is on a canvas.");
  expect(await snapshot()).toEqual(before);
});
