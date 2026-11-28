// S39-01's room (slice 39, step 4, C6): with InfoMate's InfoCatalog licence the top bar holds "All apps" (28 px, before
// the organization switcher), and S6A-10's and S38-02's widths still hold: from 2,560 to 800 px nothing reaches past the
// bar or under another control and nothing scrolls, every switcher keeps its 56 px (44 px up to 1,000 px), and at 1,280
// and 1,440 px with long names a cut name keeps at least 180 px of its text; the working context's label at least 40 px.
// The same views as those specs (Customer & orders, both panels, the working context on). The widths are printed.

import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { canvasUrl, openCanvas } from "../slice-01a/helpers";
import { WHOLE_CO } from "../slice-03a/helpers";
import { contextOn } from "../slice-03b/helpers";
import { expect, test, type Page } from "./fixtures";
import { grantCatalogLicence, SEED_IDS, signInTo } from "./helpers";

const WIDTHS = [2560, 2100, 1880, 1600, 1536, 1300, 1201, 1200, 1101, 1100, 1000, 800];
const ALWAYS = ["button-toggle-left", "button-all-apps", "button-context", "group-undo", "group-save", "button-toggle-right", "indicator-user"];
const SWITCHERS = ["switcher-organization", "switcher-workspace", "switcher-project"];

/** S6A-10's read: the bar's shown controls, past the bar, overlapping, the scroll; with each switcher's name cut or not. */
const barState = (page: Page) =>
  page.getByTestId("bar-top").evaluate((bar, switchers) => {
    const b = bar.getBoundingClientRect();
    const shown = [...bar.querySelectorAll<HTMLElement>("[data-testid]")].filter(
      (e) => e.offsetParent !== null && e.getClientRects().length > 0 && !e.parentElement?.closest("[data-testid^='group-'],[data-testid^='switch-'],[data-testid='indicator-user'],[data-testid^='switcher-']") && e.getAttribute("data-testid") !== "bar-tools",
    );
    const boxes = shown.map((e) => ({ id: e.getAttribute("data-testid")!, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: Math.round(e.getBoundingClientRect().width) }));
    const sorted = [...boxes].sort((x, y) => x.left - y.left);
    const names = Object.fromEntries(
      switchers.map((id) => {
        const span = bar.querySelector<HTMLElement>(`[data-testid="${id}"] span`)!;
        return [id, { name: Math.round(span.getBoundingClientRect().width), cut: span.scrollWidth > span.clientWidth }];
      }),
    );
    const label = [...bar.querySelectorAll<HTMLElement>('[data-testid="button-context"] span')].find((x) => x.textContent?.startsWith("Working on"));
    return {
      ids: boxes.map((x) => x.id),
      order: sorted.map((x) => x.id),
      widths: Object.fromEntries(boxes.map((x) => [x.id, x.width])),
      outside: boxes.filter((x) => x.left < b.left - 0.5 || x.right > b.right + 0.5).map((x) => x.id),
      overlapping: sorted.slice(1).filter((x, i) => x.left < sorted[i]!.right - 0.5).map((x) => x.id),
      scroll: bar.scrollWidth - bar.clientWidth,
      names,
      label: label ? Math.round(label.getBoundingClientRect().width) : 0,
    };
  }, SWITCHERS);

async function openWide(page: Page) {
  await grantCatalogLicence();
  await signInTo(page, "Łukasz");
  await contextOn(page, "CR-23");
  await page.setViewportSize({ width: 2560, height: 900 });
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("button-context")).toContainText("Working on CR-23");
  await expect(page.getByTestId("button-all-apps")).toBeVisible();
}

test("S39-01: with All apps nothing in the top bar is cut off or scrolls from 2,560 to 800 px, and every switcher keeps its minimum (S6A-10's widths)", async ({ page }) => {
  test.setTimeout(120_000);
  await openWide(page);
  const table: Record<number, unknown> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const s = await barState(page);
    table[width] = { scroll: s.scroll, widths: s.widths };
    expect(s.outside, `${width}: past the bar`).toEqual([]);
    expect(s.overlapping, `${width}: overlapping`).toEqual([]);
    expect(s.scroll, `${width}: the bar scrolls`).toBe(0);
    for (const id of ALWAYS) expect(s.ids, `${width}: ${id}`).toContain(id);
    expect(s.order.indexOf("button-all-apps"), `${width}: All apps before the organization`).toBe(s.order.indexOf("switcher-organization") - 1);
    expect(s.widths["button-all-apps"], `${width}: All apps`).toBe(28);
    for (const id of SWITCHERS) expect(s.widths[id], `${width}: ${id}`).toBeGreaterThanOrEqual(width > 1000 ? 56 : 44);
    expect(s.label, `${width}: the label`).toBeGreaterThanOrEqual(40);
  }
  console.log(`S39-01 room (S6A-10's widths): ${JSON.stringify(table)}`);
});

test("S39-01: with All apps long names are not cut to a few letters at 1,280 and 1,440 px (S38-02's widths)", async ({ page }) => {
  const db = await readDb(E2E_DB);
  db.organization.find((o) => o.id === SEED_IDS.orgInfoMate)!.name = "InfoMate Data Consulting Group";
  db.workspace.find((w) => w.id === SEED_IDS.wsRetailDwh)!.name = "Retail Co – Data warehouse for every sales channel";
  db.project.find((p) => p.id === SEED_IDS.projCustomer360)!.name = "Customer 360 and loyalty across every sales channel";
  await writeDb(E2E_DB, db);
  await openWide(page);
  const table: Record<number, unknown> = {};
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const s = await barState(page);
    table[width] = { names: s.names, label: s.label, scroll: s.scroll };
    expect(s.scroll, `${width}: the bar scrolls`).toBe(0);
    expect(s.label, `${width}: the label`).toBeGreaterThanOrEqual(40);
    if (width <= 1440) for (const id of SWITCHERS) if (s.names[id]!.cut) expect(s.names[id]!.name, `${width}: ${id}`).toBeGreaterThanOrEqual(180);
  }
  console.log(`S39-01 room (S38-02's widths): ${JSON.stringify(table)}`);
});

test("S39-01: on a phone (390 px) the top bar keeps All apps with the toggles, the path and the account, and nothing scrolls or overlaps (S38-06's view)", async ({ page }) => {
  await grantCatalogLicence();
  await page.setViewportSize({ width: 390, height: 844 });
  await signInTo(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl());
  for (const id of ["button-toggle-left", "button-all-apps", ...SWITCHERS, "button-toggle-right", "indicator-user"]) await expect(page.getByTestId("bar-top").getByTestId(id), id).toBeVisible();
  const s = await barState(page);
  console.log(`S39-01 room at 390 px: ${JSON.stringify(s.widths)}`);
  expect(s.outside).toEqual([]);
  expect(s.overlapping).toEqual([]);
  expect(s.scroll).toBe(0);
  for (const id of SWITCHERS) expect(s.widths[id], id).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
