import { expect, test } from "@playwright/test";
import { HEAD_H } from "../src/data/generate";
import { checkMappingEnds, fitNodes, openCanvas } from "./helpers";

/*
 * C-05: hidden rows (collapse, filter) re-anchor their lines to the card header.
 * Reads the rendered line ends and compares with the card's header middle.
 */
interface EndInfo { id: string; row: string; atHeader: boolean; faded: boolean; rowShown: boolean }
const endsOn = (page: import("@playwright/test").Page, card: string): Promise<EndInfo[]> =>
  page.evaluate(([card, head]) => {
    const { data, rf } = (window as any).__spike;
    const n = rf.getInternalNode(card);
    const top = n.internals.positionAbsolute.y;
    return data.mappings
      .filter((m: any) => m.srcCard === card || m.entCard === card)
      .map((m: any) => {
        const g = document.querySelector(`[data-edge="${m.id}"]`) as SVGGElement;
        const y = +(m.srcCard === card ? g.dataset.y0! : g.dataset.y1!);
        const row = m.srcCard === card ? m.column : m.attribute;
        return { id: m.id, row, atHeader: Math.abs(y - (top + (head as number) / 2)) < 0.5, faded: g.classList.contains("part"),
          rowShown: !!document.querySelector(`[data-card="${card}"] [data-row="${row}"]`) };
      });
  }, [card, HEAD_H] as const);

test("C-05 collapsing a card re-anchors all its lines to the header; expanding puts them back", async ({ page }) => {
  await openCanvas(page);
  await fitNodes(page, ["src:25"], 1);
  await page.click('[data-card="src:25"] [data-act="collapse"]');
  await page.waitForTimeout(200);
  const collapsed = await endsOn(page, "src:25");
  expect(collapsed.length).toBeGreaterThan(5);
  expect(collapsed.every(e => e.atHeader && e.faded)).toBe(true);
  await page.screenshot({ path: "report/c05-collapsed-card.png" });
  await page.click('[data-card="src:25"] [data-act="collapse"]');
  await page.waitForTimeout(200);
  const res = await checkMappingEnds(page);
  expect(res.bad).toEqual([]);
});

test("C-05 filtering rows re-anchors exactly the hidden rows' lines", async ({ page }) => {
  await openCanvas(page);
  await fitNodes(page, ["ent:33"], 1);
  await page.click('[data-card="ent:33"] [data-act="filter"]'); // → mapped
  await page.click('[data-card="ent:33"] [data-act="filter"]'); // → keys
  await page.waitForTimeout(200);
  const ends = await endsOn(page, "ent:33");
  expect(ends.some(e => e.rowShown)).toBe(true);
  expect(ends.some(e => !e.rowShown)).toBe(true);
  for (const e of ends) expect(e.atHeader, e.id).toBe(!e.rowShown);
  await page.screenshot({ path: "report/c05-filtered-card.png" });
});
