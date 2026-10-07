import { expect, test, type Page } from "./fixtures";
import {
  callActionDirectly,
  canvasIn,
  canvasTab,
  captureActionId,
  card,
  closeToolbox,
  dragCardBy,
  emptySpot,
  expectToast,
  headPoint,
  ids,
  lasso,
  loadItems,
  newSession,
  openCanvas,
  openCanvasMenu,
  SEED_IDS,
  store,
  toolboxAt,
  WHOLE,
} from "./helpers";

const ws = SEED_IDS.wsRetailDwh, om = SEED_IDS.projOrderManagement;
const here = SEED_IDS.canvasCustomerOrders, other = SEED_IDS.canvasOrderLines;

/** Everything a reviewer's direct calls could change: the canvases, their links and every card. */
async function snapshot() {
  const s = store();
  const canvases = await s.canvases.list(ws);
  return {
    canvases,
    links: await Promise.all(canvases.map((c) => s.canvases.listLinksOfCanvas(ws, c.id))),
    items: await s.canvasItems.list(ws),
  };
}

async function shiftClick(page: Page, name: string) {
  const at = await headPoint(page, name);
  await page.keyboard.down("Shift");
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up("Shift");
}

test("S2A-13: as Piotr (reviewer): lasso, Ctrl+A, Hand tool and layer buttons work and his layer choice is not saved; no group move, nudge, align, fit, remove, add-sources, duplicate, delete or look actions are offered; those commands called directly are refused and change nothing", async ({ browser }) => {
  test.setTimeout(180_000);
  const { entity, table } = await ids();

  // Łukasz (owner) uses each write once, so their action ids can be called again directly as Piotr
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, canvasIn(om, here), WHOLE);
  await o.getByTestId("card-name").getByText("Customer", { exact: true }).click();
  await shiftClick(o, "Sales Order");
  const moveId = await captureActionId(o, () => dragCardBy(o, "Sales Order", 40, 20));
  await toolboxAt(o, await headPoint(o, "Customer"));
  const arrangeId = await captureActionId(o, () => o.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Stack in a column" }).click());
  await o.keyboard.press("Control+a");
  await toolboxAt(o, await headPoint(o, "Customer"));
  const widthsId = await captureActionId(o, () => o.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Fit widths to names" }).click());
  await expectToast(o, "Fitted 7 cards to their names.");
  const removeId = await captureActionId(o, () => o.getByTestId("button-selection-remove").click());
  await expectToast(o, "Removed 7 cards from this canvas. They stay in the model with their mappings.");
  await o.getByTestId("toast").getByTestId("toast-action").click();
  await expectToast(o, "Undone: Remove 7 cards");
  await expect(o.locator(".react-flow__node")).toHaveCount(7);
  await card(o, "web_users").getByTestId("card-name").click();
  await o.getByTestId("button-remove-card").click();
  await expect(o.locator(".react-flow__node")).toHaveCount(6);
  await o.getByTestId("card-name").getByText("Customer", { exact: true }).click();
  await shiftClick(o, "Sales Order");
  const sourcesId = await captureActionId(o, () => o.getByTestId("button-selection-sources").click());
  await expect(o.locator(".react-flow__node")).toHaveCount(7);
  await o.keyboard.press("Escape");
  const lookId = await captureActionId(o, () => o.getByTestId("section-canvas-look").getByTestId("group-canvas-background").locator('[data-background="warm"]').click());
  let menu = await openCanvasMenu(o, "Customer & orders");
  const lookAllId = await captureActionId(o, () => menu.getByTestId("menu-item-look-all").click());
  await expectToast(o, "All canvases now use this look.");
  menu = await openCanvasMenu(o, "Customer & orders");
  const duplicateId = await captureActionId(o, () => menu.getByTestId("menu-item-duplicate").click());
  await expect(canvasTab(o, "Customer & orders (copy)")).toHaveAttribute("aria-selected", "true");
  menu = await openCanvasMenu(o, "Customer & orders (copy)");
  const deleteId = await captureActionId(o, () => menu.getByTestId("menu-item-delete-canvas").click());
  await expect(canvasTab(o, "Customer & orders (copy)")).toHaveCount(0);
  await owner.context.close();
  const before = await snapshot();

  // Piotr selects with the lasso and Ctrl+A; the panel and the group's toolbox offer only “Clear selection”
  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(page, canvasIn(om, here), WHOLE);
  await expect(page.getByTestId("button-canvas-menu")).toHaveCount(0); // no tab menu: no duplicate, delete or look
  await expect(page.getByTestId("section-canvas-look")).toHaveCount(0);
  const customerItem = (await loadItems()).find((i) => i.entity_id === entity("Customer").id)!;
  await lasso(page, { x: customerItem.x - 16, y: customerItem.y - 24 }, { x: customerItem.x + 600, y: customerItem.y + 1100 });
  await expect.poll(() => page.getByTestId("mark-selected").count()).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("mark-selected")).toHaveCount(7);
  await expect(page.getByTestId("button-selection-sources")).toHaveCount(0);
  await expect(page.getByTestId("button-selection-remove")).toHaveCount(0);
  await expect(page.getByTestId("button-selection-clear")).toBeVisible();
  expect(await toolboxAt(page, await headPoint(page, "Customer"))).toEqual(["Clear selection"]);
  await closeToolbox(page);
  // dragging a selected card or pressing an arrow key moves nothing
  await page.keyboard.press("Control+a");
  await dragCardBy(page, "Customer", 60, 30);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  expect(await snapshot()).toEqual(before);

  // the Hand tool pans
  await page.getByTestId("button-tool-hand").click();
  const t0 = await page.locator(".react-flow__viewport").evaluate((e) => (e as HTMLElement).style.transform);
  const spot = await emptySpot(page);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(spot.x - i * 15, spot.y - i * 5);
  await page.mouse.up();
  await expect.poll(() => page.locator(".react-flow__viewport").evaluate((e) => (e as HTMLElement).style.transform)).not.toBe(t0);
  await page.keyboard.press("v");

  // the layer buttons change his view only: nothing is saved, and a reload shows the saved mode again
  await page.getByTestId("switch-layer").locator('[data-layer="mappings"]').click();
  await expect(page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await store().canvases.get(ws, here))!.look.layer).toBe("all");
  await openCanvas(page, canvasIn(om, here));
  await expect(page.getByTestId("switch-layer").locator('[data-layer="all"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').count()).toBeGreaterThan(0);

  // direct server calls are refused with the domain's message and change nothing
  const items = await loadItems();
  const c = items.find((i) => i.entity_id === entity("Customer").id)!;
  const so = items.find((i) => i.entity_id === entity("Sales Order").id)!;
  const pos = (i: typeof c, dx: number) => ({ canvasItemId: i.id, expectedVersion: i.version, x: i.x + dx, y: i.y });
  const canvasRow = (await store().canvases.get(ws, here))!;
  const otherRow = (await store().canvases.get(ws, other))!;
  const replies = {
    move: await callActionDirectly(page, moveId, [ws, here, [pos(c, 80), pos(so, 80)]]),
    arrange: await callActionDirectly(page, arrangeId, [ws, here, [pos(c, 0), pos(so, 0)]]),
    widths: await callActionDirectly(page, widthsId, [ws, here, [{ canvasItemId: c.id, expectedVersion: c.version, width: 400 }]]),
    remove: await callActionDirectly(page, removeId, [ws, here, [{ canvasItemId: c.id, expectedVersion: c.version }]]),
    sources: await callActionDirectly(page, sourcesId, [ws, here, [{ sourceTableId: table("items").id, x: 0, y: 1200 }]]),
    look: await callActionDirectly(page, lookId, [ws, { canvasId: here, expectedVersion: canvasRow.version, background: "blue" }]),
    lookAll: await callActionDirectly(page, lookAllId, [{ workspaceId: ws, canvasId: here }]),
    duplicate: await callActionDirectly(page, duplicateId, [{ workspaceId: ws, projectId: om, canvasId: here }]),
    delete: await callActionDirectly(page, deleteId, [{ workspaceId: ws, projectId: om, canvasId: other, expectedVersion: otherRow.version }]),
  };
  for (const k of ["move", "arrange", "widths", "remove", "sources"] as const) expect(replies[k], k).toContain("As a reviewer you cannot change what is on a canvas.");
  expect(replies.look).toContain("As a reviewer you cannot change the look of a canvas.");
  expect(replies.lookAll).toContain("As a reviewer you cannot change the look of a canvas.");
  expect(replies.duplicate).toContain("As a reviewer you cannot create canvases.");
  expect(replies.delete).toContain("As a reviewer you cannot delete canvases.");
  expect(await snapshot()).toEqual(before);
});
