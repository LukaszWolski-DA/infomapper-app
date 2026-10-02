import { expect, test, type Page } from "@playwright/test";
import { allPositions, drag, fitNodes, nodeBox, openCanvas, selectedIds, toScreen, type Box } from "./helpers";

/*
 * C-07: the lasso selects only fully enclosed cards; Shift-click and group move work.
 * Uses the free cards below the frames (the lasso starts on empty canvas).
 */

async function freeCards(page: Page) {
  const ids: string[] = await page.evaluate(() =>
    (window as any).__spike.data.cards.filter((c: any) => !c.frameId && c.id !== "ent:40").map((c: any) => c.id));
  const boxes: Record<string, Box> = {};
  for (const id of ids) boxes[id] = await nodeBox(page, id);
  return boxes;
}

const inside = (b: Box, r: Box) => b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
const overlaps = (b: Box, r: Box) => b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;

/** A lasso around two neighbouring cards that also cuts through the card below one of them. */
function planLasso(boxes: Record<string, Box>) {
  const list = Object.entries(boxes).sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x);
  const [aId, A] = list[0];
  const [bId, B] = list.filter(([id, b]) => id !== aId && Math.abs(b.y - A.y) < 1).sort((p, q) => p[1].x - q[1].x)[0];
  const shorter = A.h <= B.h ? A : B;
  const [cId, C] = list.filter(([, b]) => Math.abs(b.x - shorter.x) < 1 && b.y > shorter.y + shorter.h).sort((p, q) => p[1].y - q[1].y)[0];
  const x = Math.min(A.x, B.x) - 20, y = Math.min(A.y, B.y) - 20;
  const right = Math.max(A.x + A.w, B.x + B.w) + 20;
  const bottom = Math.max(Math.max(A.y + A.h, B.y + B.h) + 20, C.y + Math.min(60, C.h / 2));
  return { lasso: { x, y, w: right - x, h: bottom - y }, a: aId, b: bId, partial: cId };
}

test("C-07 lasso selects only fully enclosed cards, Shift-click adds, the group moves together", async ({ page }) => {
  await openCanvas(page);
  let boxes = await freeCards(page);
  const plan = planLasso(boxes);
  await fitNodes(page, [plan.a, plan.b, plan.partial], 0.3);
  boxes = await freeCards(page);
  const enclosed = Object.keys(boxes).filter(id => inside(boxes[id], plan.lasso)).sort();
  const partial = Object.keys(boxes).filter(id => overlaps(boxes[id], plan.lasso) && !inside(boxes[id], plan.lasso));
  expect(enclosed).toEqual([plan.a, plan.b].sort());
  expect(partial).toContain(plan.partial);

  // lasso from empty canvas
  const s0 = await toScreen(page, plan.lasso.x, plan.lasso.y);
  const s1 = await toScreen(page, plan.lasso.x + plan.lasso.w, plan.lasso.y + plan.lasso.h);
  const startOn = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [s0.x, s0.y]);
  expect(String(startOn)).toContain("react-flow__pane");
  await drag(page, s0, s1, 16);
  await page.screenshot({ path: "report/c07-lasso.png" });
  expect(await selectedIds(page)).toEqual(enclosed);

  // Shift-click the partly covered card adds it
  await page.locator(`[data-card="${plan.partial}"] .c-name`).click({ modifiers: ["Shift"] });
  const sel = await selectedIds(page);
  expect(sel).toEqual([...enclosed, plan.partial].sort());

  // Shift-click again removes it, then add back
  await page.locator(`[data-card="${plan.partial}"] .c-name`).click({ modifiers: ["Shift"] });
  expect(await selectedIds(page)).toEqual(enclosed);
  await page.locator(`[data-card="${plan.partial}"] .c-name`).click({ modifiers: ["Shift"] });

  // group drag by one card: all selected move by the same amount, nothing else moves
  const before = await allPositions(page);
  const h = (await page.locator(`[data-card="${plan.a}"] .c-name`).boundingBox())!;
  await drag(page, { x: h.x + 20, y: h.y + 6 }, { x: h.x + 140, y: h.y + 66 });
  const after = await allPositions(page);
  const d0 = [after[plan.a][0] - before[plan.a][0], after[plan.a][1] - before[plan.a][1]];
  expect(Math.hypot(d0[0], d0[1])).toBeGreaterThan(50);
  for (const id of Object.keys(before)) {
    const d = [after[id][0] - before[id][0], after[id][1] - before[id][1]];
    const exp = sel.includes(id) ? d0 : [0, 0];
    expect(Math.abs(d[0] - exp[0]) + Math.abs(d[1] - exp[1]), id).toBeLessThan(1e-6);
  }
  expect(await selectedIds(page)).toEqual(sel);

  // arrow-key nudge moves the whole selection
  const n0 = await allPositions(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const n1 = await allPositions(page);
  const nd = sel.map(id => [n1[id][0] - n0[id][0], n1[id][1] - n0[id][1]]);
  expect(nd.every(d => d[0] === nd[0][0] && d[1] === nd[0][1] && d[0] > 0 && d[1] > 0)).toBe(true);

  // click on empty canvas clears the selection
  await page.mouse.click(s0.x - 10, s0.y - 10);
  expect(await selectedIds(page)).toEqual([]);
});

test("C-07 a lasso that only touches cards selects nothing", async ({ page }) => {
  await openCanvas(page);
  const boxes = await freeCards(page);
  const plan = planLasso(boxes);
  await fitNodes(page, [plan.a, plan.b, plan.partial], 0.3);
  const A = await nodeBox(page, plan.a);
  // from empty space above-left into the middle of card A
  const s0 = await toScreen(page, A.x - 30, A.y - 30);
  const s1 = await toScreen(page, A.x + A.w / 2, A.y + A.h / 2);
  await drag(page, s0, s1);
  expect(await selectedIds(page)).toEqual([]);
});
