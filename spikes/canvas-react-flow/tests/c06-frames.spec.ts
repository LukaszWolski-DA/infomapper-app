import { expect, test } from "@playwright/test";
import { allPositions, drag, fitNodes, openCanvas } from "./helpers";

/*
 * C-06: frame drag moves its cards; collapse merges lines per target with a count; expand restores the exact layout.
 */

test("C-06 dragging each frame by its label moves exactly its cards, by the same amount", async ({ page }) => {
  await openCanvas(page);
  const frames: { id: string; cards: string[] }[] = await page.evaluate(() => (window as any).__spike.data.frames.map((f: any) => ({ id: f.id, cards: f.cards })));
  for (const f of frames) {
    await openCanvas(page); // fresh layout each time, so earlier drags don't cover the next frame's label
    await fitNodes(page, [f.id], 0.3);
    const before = await allPositions(page);
    // grab the frame where nothing lies on top of it (lines are drawn above frames and can cover the label)
    const grab = await page.evaluate(id => {
      const el = document.querySelector(`[data-frame="${id}"]`)!;
      const r = el.getBoundingClientRect();
      const cands = [...el.querySelectorAll(".f-name, .f-dot, .f-kind")].map(e => e.getBoundingClientRect())
        .map(b => [b.left + b.width / 2, b.top + b.height / 2]);
      for (let y = r.top + 4; y < r.bottom; y += 6) for (let x = r.left + 4; x < r.right; x += 6) cands.push([x, y]);
      return cands.find(([x, y]) => x > 0 && y > 50 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y)?.closest("[data-frame]") === el) ?? null;
    }, f.id);
    expect(grab, `no free spot to grab ${f.id}`).not.toBeNull();
    await drag(page, { x: grab![0], y: grab![1] }, { x: grab![0] + 120, y: grab![1] + 60 });
    const after = await allPositions(page);
    const fd = [after[f.id][0] - before[f.id][0], after[f.id][1] - before[f.id][1]];
    expect(Math.hypot(fd[0], fd[1]), `${f.id} did not move`).toBeGreaterThan(50);
    for (const id of Object.keys(before)) {
      const d = [after[id][0] - before[id][0], after[id][1] - before[id][1]];
      const expected = id === f.id || f.cards.includes(id) ? fd : [0, 0];
      expect(Math.abs(d[0] - expected[0]) + Math.abs(d[1] - expected[1]), `${id} while dragging ${f.id}`).toBeLessThan(1e-6);
    }
  }
});

/** What the collapsed frame should show: one merged line per (frame, other card), counting links that leave the frame. */
const expectedMerge = (page: import("@playwright/test").Page, frameId: string) =>
  page.evaluate(frameId => {
    const { data } = (window as any).__spike;
    const f = data.frames.find((x: any) => x.id === frameId);
    const inF = new Set(f.cards);
    const groups: Record<string, number> = {};
    for (const m of data.mappings) if (inF.has(m.srcCard) !== inF.has(m.entCard)) {
      const k = "m|" + (inF.has(m.srcCard) ? frameId : m.srcCard) + "|" + (inF.has(m.entCard) ? frameId : m.entCard);
      groups[k] = (groups[k] ?? 0) + 1;
    }
    for (const r of data.relationships) if (inF.has(r.from) !== inF.has(r.to)) {
      const k = "r|" + [inF.has(r.from) ? frameId : r.from, inF.has(r.to) ? frameId : r.to].sort().join("|");
      groups[k] = (groups[k] ?? 0) + 1;
    }
    return { groups, members: f.cards as string[] };
  }, frameId);

const renderedBundles = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const o: Record<string, { count: number; chip: string | null }> = {};
    document.querySelectorAll<SVGGElement>(".lnk.bundle").forEach(g => {
      o[g.dataset.edge!.slice(2)] = { count: +g.dataset.count!, chip: g.querySelector(".chip text")?.textContent ?? null };
    });
    return o;
  });

test("C-06 each frame collapses into a block with merged, counted lines and expands to the exact layout", async ({ page }) => {
  await openCanvas(page);
  const ids: string[] = await page.evaluate(() => (window as any).__spike.data.frames.map((f: any) => f.id));
  const initial = await allPositions(page);
  for (const id of ids) {
    await page.evaluate(id => (window as any).__spike.toggleFrame(id), id);
    await page.waitForTimeout(150);
    const exp = await expectedMerge(page, id);
    // cards hidden, block shown
    for (const c of exp.members) await expect(page.locator(`[data-card="${c}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-frame="${id}"].fblock`)).toBeVisible();
    // merged lines: one per target, with the right count and a chip when > 1
    const got = await renderedBundles(page);
    expect(Object.keys(got).sort()).toEqual(Object.keys(exp.groups).sort());
    for (const [k, n] of Object.entries(exp.groups)) {
      expect(got[k].count, k).toBe(n);
      if (k.startsWith("m|") && n > 1) expect(got[k].chip, k).toBe(String(n));
    }
    if (id === "f1") {
      await fitNodes(page, [id], 1.2);
      await page.screenshot({ path: "report/c06-collapsed-frame.png" });
    }
    await page.evaluate(id => (window as any).__spike.toggleFrame(id), id);
    await page.waitForTimeout(150);
    const after = await allPositions(page);
    expect(after, `layout after expanding ${id}`).toEqual(initial);
  }
});

test("C-06 collapsing all frames at once, then expanding, restores the exact layout and all 340 lines", async ({ page }) => {
  await openCanvas(page);
  const ids: string[] = await page.evaluate(() => (window as any).__spike.data.frames.map((f: any) => f.id));
  const initial = await allPositions(page);
  for (const id of ids) await page.evaluate(id => (window as any).__spike.toggleFrame(id), id);
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__spike.rf.fitView());
  await page.waitForTimeout(300);
  await page.screenshot({ path: "report/c06-all-collapsed.png" });
  // frame ↔ frame lines exist when two collapsed frames are linked
  const ff = await page.evaluate(() => [...document.querySelectorAll<SVGGElement>(".lnk.bundle")].filter(g => /\|f\d+\|f\d+$|^b:r\|f\d+\|f\d+$/.test(g.dataset.edge!)).length);
  expect(ff).toBeGreaterThan(0);
  for (const id of ids) await page.evaluate(id => (window as any).__spike.toggleFrame(id), id);
  await page.waitForTimeout(300);
  expect(await allPositions(page)).toEqual(initial);
  expect(await page.locator(".lnk.map:not(.bundle)").count()).toBe(300);
  expect(await page.locator(".lnk.rel:not(.bundle)").count()).toBe(40);
});

test("C-06 the collapse button in the frame label works with the mouse", async ({ page }) => {
  await openCanvas(page);
  await fitNodes(page, ["f2"], 0.3);
  await page.click('[data-frame="f2"] [data-act="frame-collapse"]');
  await expect(page.locator('[data-frame="f2"].fblock')).toBeVisible();
  await page.click('[data-frame="f2"] [data-act="frame-collapse"]');
  await expect(page.locator('[data-frame="f2"].frame')).toBeVisible();
});
