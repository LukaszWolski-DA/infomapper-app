// S7B-14: the Changes view (items 26–27, P11; step 1 answers Q2, Q6, F16–F18): the toolbar button, the bar with the
// select per import and the counts, the fade through the fade layer, the chip, Close; it and Focus turn each other off,
// “Show all” turns it off; “Show what it touched on the canvas” from the system panel, reached from a home page through
// model consistency; momentary; no data or layout changes and no canvas commit.

import type { Page } from "@playwright/test";
import { counters } from "../slice-04p/helpers";
import { expect, test } from "./fixtures";
import { canvasUrl, crmChanges, loadModel, openCanvas, RETAIL, SEED_IDS, signInAs, store } from "./helpers";

const bar = (page: Page) => page.getByTestId("bar-changes");
const fade = (page: Page) => page.getByTestId("layer-fade");
const button = (page: Page) => page.getByTestId("button-changes");
const chip = (page: Page) => page.getByTestId("chip-changes");
const counts = (page: Page) => page.getByTestId("text-changes-counts");
const stored = async () => {
  const s = store();
  const [items, canvases, model] = await Promise.all([s.canvasItems.list(RETAIL), s.canvases.list(RETAIL), loadModel()]);
  return JSON.stringify([items, canvases, model]);
};
/** The chip's date: the date in the select's option for that import, as the server wrote it (“Import into CRM, 25 Oct 2026, 09:44, …”). */
const dateOf = async (page: Page, label: string) => {
  const text = await page.getByTestId("select-changes").locator("option").filter({ hasText: label }).textContent();
  return /^Import into CRM, ([^,]+),/.exec(text ?? "")![1]!;
};

test("S7B-14: the button, the bar, the select per import, the counts, the fade, the chip and Close; nothing stored changes", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const before = await stored();
  const c0 = await counters(page);

  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect(bar(page)).toBeVisible();
  await expect(page.getByTestId("select-changes")).toHaveValue("open");
  await expect(counts(page)).toHaveText("3 tables, 3 mappings, 3 attributes");
  await expect(fade(page)).toHaveAttribute("data-fade", /^lit:changes:open:/);
  // customers and the Customer entity stay lit; the rest of the canvas fades
  await expect(fade(page)).toHaveAttribute("data-lit-cards", "2");
  await expect(chip(page)).toContainText("Changes: all open");

  // one import: its changes, open or resolved
  const options = page.getByTestId("select-changes").locator("option");
  await expect(options).toHaveText(["All open changes", /^Import into CRM, .*, crm_snapshot_2026-10-20\.csv$/, /^Import into CRM, .*, crm_partial\.tsv$/]);
  const partial = await options.nth(2).getAttribute("value");
  await page.getByTestId("select-changes").selectOption(partial!);
  await expect(counts(page)).toHaveText("2 tables, 0 mappings, 0 attributes");
  await expect(fade(page)).toHaveAttribute("data-fade", new RegExp(`^lit:changes:${partial}:`));
  await expect(fade(page)).toHaveAttribute("data-lit-cards", "1");
  await expect(chip(page)).toContainText(`Changes: import into CRM, ${await dateOf(page, "crm_partial.tsv")}`);

  await page.getByTestId("button-changes-close").click();
  await expect(bar(page)).toHaveCount(0);
  await expect(fade(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");

  // a view, not an edit (P11): nothing stored changed, and the canvas and its miniature drew nothing again
  expect(await stored()).toBe(before);
  const c1 = await counters(page);
  expect([c1.canvas, c1.miniature]).toEqual([c0.canvas, c0.miniature]);
});

test("S7B-14: the Changes view and Focus turn each other off; the chip's × and “Show all” turn it off; a reload too", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await button(page).click();
  await expect(chip(page)).toBeVisible();
  await page.getByTestId("button-focus").click();
  await expect(bar(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  await expect(page.getByTestId("chip-focus")).toBeVisible();
  await button(page).click();
  await expect(page.getByTestId("button-focus")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chip-focus")).toHaveCount(0);
  await expect(fade(page)).toHaveAttribute("data-fade", /^lit:changes:open:/);

  await page.getByTestId("chip-changes-off").click();
  await expect(bar(page)).toHaveCount(0);

  // “Show all” (with the Hand tool as a second chip)
  await button(page).click();
  await page.keyboard.press("h");
  await expect(page.getByTestId("chip-tool")).toBeVisible();
  await page.getByTestId("button-view-show-all").click();
  await expect(chip(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);

  // momentary (D-22): off after a reload
  await button(page).click();
  await expect(bar(page)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(bar(page)).toHaveCount(0);
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
});

test("S7B-14: “Show what it touched on the canvas” from the system panel, reached from the project home", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Łukasz");
  // the home page has no panel (F16): model consistency's system line opens the system's panel on a canvas
  await page.goto(`/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`);
  await page.getByTestId("section-consistency").getByTestId("consistency-line").filter({ hasText: "CRM" }).click();
  await expect(page.getByTestId("panel-source-system")).toBeVisible();
  const entry = page.getByTestId("import-entry").filter({ hasText: "crm_snapshot_2026-10-20.csv" });
  await entry.getByTestId("button-show-touched").click();
  await expect(bar(page)).toBeVisible();
  const snapshot = (await store().model.listImports(RETAIL)).find((i) => i.source_label === "crm_snapshot_2026-10-20.csv")!;
  await expect(page.getByTestId("select-changes")).toHaveValue(snapshot.id);
  await expect(counts(page)).toHaveText("3 tables, 3 mappings, 3 attributes");
  await expect(chip(page)).toContainText(`Changes: import into CRM, ${await dateOf(page, "crm_snapshot_2026-10-20.csv")}`);
});

test("S7B-14: every role has the Changes view; with nothing on record everything fades", async ({ page }) => {
  // no imports: nothing on record
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl());
  await button(page).click();
  await expect(counts(page)).toHaveText("Nothing on record");
  await expect(fade(page)).toHaveAttribute("data-lit-cards", "0");
});
