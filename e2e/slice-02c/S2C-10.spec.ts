import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  bundleWithCount,
  callActionDirectly,
  canvasUrl,
  captureActionId,
  CO,
  collapse,
  frameEl,
  frameNamed,
  loadFrames,
  makeFrame,
  newSession,
  openCanvas,
  pointOnLine,
  RETAIL,
  store,
  key,
  FRAMED,
} from "./helpers";

const saved = async () => (await store().frames.list(RETAIL)).map((f) => ({ id: f.id, collapsed: f.collapsed, version: f.version }));

test("S2C-10: as Piotr (reviewer), collapsing and expanding work in his tab only and are not saved; bundle panels and links work; the collapse commands called directly are refused", async ({ browser }) => {
  test.setTimeout(180_000);
  await makeFrame(AROUND.tables, { name: "Tables" });
  const people = await makeFrame(AROUND.customer, { name: "People" });

  // Łukasz (owner) collapses one frame and uses Collapse all once, so their action ids can be called again as Piotr
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, canvasUrl(), FRAMED);
  const collapseId = await captureActionId(o, () => frameEl(o, "People").getByTestId("button-frame-collapse").click());
  await expect.poll(async () => (await frameNamed("People"))!.collapsed).toBe(true);
  const allId = await captureActionId(o, () => o.locator('[data-testid="button-frames-collapse-all"]:visible').click());
  await expect.poll(async () => (await frameNamed("Tables"))!.collapsed).toBe(true);
  await owner.context.close();
  // the saved state Piotr starts from: Tables collapsed, People expanded
  await collapse(people, false);
  const before = await saved();

  const { page } = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(blockEl(page, "Tables")).toBeVisible();
  await expect(frameEl(page, "People")).toBeVisible();

  // a bundle and its links work for him: customers.email_addr and web_users.email into Customer.email
  const two = bundleWithCount(page, 2);
  const at = await pointOnLine(two, 0.5);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-bundle");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("2 mappings");
  await panel.getByTestId("item-bundle-mapping").first().click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();

  // he collapses People (label button) and expands Tables (block's Expand): his tab only, nothing saved, no undo
  await frameEl(page, "People").getByTestId("button-frame-collapse").click();
  await expect(blockEl(page, "People")).toBeVisible();
  await blockEl(page, "Tables").getByTestId("button-block-expand").click();
  await expect(frameEl(page, "Tables")).toBeVisible();
  await expect(page.getByTestId("button-undo")).toBeDisabled();
  // Collapse all, in his tab (the canvas overview shows with nothing selected)
  await key(page, "Escape");
  await page.locator('[data-testid="button-frames-collapse-all"]:visible').click();
  await expect(page.getByTestId("block")).toHaveCount(2);
  await page.waitForTimeout(500);
  expect(await saved()).toEqual(before);

  // a reload shows the saved state again
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(blockEl(page, "Tables")).toBeVisible();
  await expect(frameEl(page, "People")).toBeVisible();
  await expect(page.getByTestId("block")).toHaveCount(1);

  // the commands called directly are refused with the domain's message and change nothing
  const p = (await loadFrames()).find((f) => f.id === people)!;
  const replies = {
    collapse: await callActionDirectly(page, collapseId, [RETAIL, { frameId: people, expectedVersion: p.version, collapsed: true }]),
    all: await callActionDirectly(page, allId, [RETAIL, CO, { frames: (await loadFrames()).map((f) => ({ frameId: f.id, expectedVersion: f.version })), collapsed: false }]),
  };
  for (const [k, reply] of Object.entries(replies)) expect(reply, k).toContain("As a reviewer you cannot change what is on a canvas.");
  expect(await saved()).toEqual(before);
});
