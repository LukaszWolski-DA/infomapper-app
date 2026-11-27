// S38-02 (slice 38, step 3): the top bar says where you are. With the canvas's controls in its toolbar the bar holds the
// path (the organization, workspace and project switchers), the working context, the save pair ("Local"), Undo and Redo,
// the panels' toggles and the account. At 1,280 and 1,440 px with both panels and the working context on, no name in the
// path is cut to a few letters: a long name may end with an ellipsis, its full name starting the switcher's title. The
// measured widths at 1,280, 1,440 and 1,920 px are printed (the step's table). S16-08 checks the label's 40 px at its 13
// widths, S6A-10 that nothing is cut off from 2,560 to 800 px.

import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, contextOn, openCanvas, SEED_IDS, signInAs, topBar } from "./helpers";

const NAMES = {
  organization: "InfoMate Data Consulting Group",
  workspace: "Retail Co – Data warehouse for every sales channel",
  project: "Customer 360 and loyalty across every sales channel",
};
const SWITCHERS = ["switcher-organization", "switcher-workspace", "switcher-project"] as const;

/** Each switcher's width, its name's shown width and whether the browser cuts it; the label's width; the bar's scroll. */
const pathOf = (page: Page) =>
  page.evaluate((ids) => {
    const out: Record<string, { width: number; name: number; cut: boolean }> = {};
    for (const id of ids) {
      const b = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      const span = b.querySelector<HTMLElement>("span")!;
      out[id] = { width: Math.round(b.getBoundingClientRect().width), name: Math.round(span.getBoundingClientRect().width), cut: span.scrollWidth > span.clientWidth };
    }
    const label = [...document.querySelectorAll<HTMLElement>('[data-testid="button-context"] span')].find((x) => x.textContent?.startsWith("Working on"))!;
    const bar = document.querySelector<HTMLElement>('[data-testid="bar-top"]')!;
    return { switchers: out, label: Math.round(label.getBoundingClientRect().width), scroll: bar.scrollWidth - bar.clientWidth };
  }, [...SWITCHERS]);

test("S38-02: the top bar holds the path, the context, Undo and Redo, the save pair, the toggles and the account; long names are not cut to a few letters at 1,280 and 1,440 px", async ({ page }) => {
  const db = await readDb(E2E_DB);
  db.organization.find((o) => o.id === SEED_IDS.orgInfoMate)!.name = NAMES.organization;
  db.workspace.find((w) => w.id === SEED_IDS.wsRetailDwh)!.name = NAMES.workspace;
  db.project.find((p) => p.id === SEED_IDS.projCustomer360)!.name = NAMES.project;
  await writeDb(E2E_DB, db);

  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl());

  // what the bar holds, and nothing of the canvas's
  for (const id of ["button-toggle-left", ...SWITCHERS, "button-context", "group-undo", "group-save", "button-toggle-right", "indicator-user"]) await expect(topBar(page).getByTestId(id)).toBeVisible();
  await expect(topBar(page).getByTestId("group-save")).toContainText("Local");
  for (const id of ["switch-layer", "group-zoom", "button-names", "button-more-tools"]) await expect(topBar(page).getByTestId(id)).toHaveCount(0);
  // a switcher's title starts with its full name
  await expect(page.getByTestId("switcher-workspace")).toHaveAttribute("title", `${NAMES.workspace}: switch workspace, open the workspace home or create a workspace`);
  await expect(page.getByTestId("switcher-project")).toHaveAttribute("title", `${NAMES.project}: switch project, open the project home or create a project`);
  await expect(page.getByTestId("switcher-organization")).toHaveAttribute("title", `${NAMES.organization}: switch organization`);

  const table: Record<number, unknown> = {};
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const p = await pathOf(page);
    table[width] = p;
    expect(p.scroll, `${width}: the bar scrolls`).toBe(0);
    expect(p.label, `${width}: the label`).toBeGreaterThanOrEqual(40);
    // never a few letters: a cut name keeps 180 px of its text (about 25 characters) at least
    if (width <= 1440) for (const id of SWITCHERS) if (p.switchers[id]!.cut) expect(p.switchers[id]!.name, `${width}: ${id}`).toBeGreaterThanOrEqual(180);
  }
  console.log(`S38-02 widths: ${JSON.stringify(table)}`);
});
