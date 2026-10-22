// S6A-03 (slice 6a, item 5 as amended): “Show all” shows from two removable chips and removes every removable item in
// one action: Focus, the layer, hidden notes and the tool in the browser, filters, collapsed cards and collapsed frames
// saved as one change; the toast “Showing everything on this canvas.” offers Undo when that change exists. On a live
// canvas “Live: CR-23” and the Labeled filter stay. A reader's “Show all” counts and removes only what a reader may.

import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  canvasUrl,
  card,
  cardEl,
  chip,
  collapsedFrame,
  DEMO_NOTES,
  expectChips,
  expectToast,
  ids,
  item,
  labelItem,
  liveUrl,
  loadFrames,
  noteEl,
  openCanvas,
  openLiveFor,
  setCard,
  signInAs,
  WHOLE_CO,
} from "./helpers";

const showAll = (page: import("./fixtures").Page) => page.getByTestId("button-view-show-all");

test("S6A-03: “Show all” from two chips removes everything removable, the layout part saved in one change", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await setCard("Customer", { rowFilter: "keys" });
  await setCard("customers", { collapsed: true });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(showAll(page)).toHaveAttribute("title", "Remove everything that hides or fades things on this canvas");

  await page.getByTestId("checkbox-show-resolved").uncheck();
  await card(page, "web_users").locator(".c-head .c-l2").click();
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="relationships"]').click();
  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Focus", "Relationships only", "1 card filtered", "1 card collapsed", "1 frame collapsed", "Resolved notes hidden", "Hand tool"]);

  await showAll(page).click();
  await expectToast(page, "Showing everything on this canvas.");
  await expect(page.getByTestId("toast-action")).toHaveText("Undo");
  await expectChips(page, []);
  await expect(showAll(page)).toHaveCount(0);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  await expect(page.getByTestId("button-focus")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-layer", "all");
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "false");
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(1);
  await expect(blockEl(page, "Orders")).toHaveCount(0);
  await expect(cardEl(page, "Customer")).toHaveAttribute("data-filter", "all");
  await expect.poll(async () => [(await item("Customer")).row_filter, (await item("customers")).collapsed, (await loadFrames()).find((f) => f.name === "Orders")?.collapsed]).toEqual(["all", false, false]);

  // one removable chip: no “Show all”; with nothing to save, the toast has no Undo
  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Hand tool"]);
  await expect(showAll(page)).toHaveCount(0);
  await page.getByTestId("button-focus").click();
  await showAll(page).click();
  await expectToast(page, "Showing everything on this canvas.");
  await expect(page.getByTestId("toast-action")).toHaveCount(0);
  await expectChips(page, []);
});

test("S6A-03: on a live canvas “Show all” keeps “Live: CR-23” and the Labeled filter", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  const { attribute, table } = await ids();
  await labelItem("CR-23", { kind: "attribute", id: attribute("Sales Order", "order_date").id });
  await labelItem("CR-23", { kind: "source_table", id: table("customers").id });
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 0.6 });

  await cardEl(page, "customers").getByTestId("button-card-filter").click();
  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Live: CR-23", "1 card filtered", "Hand tool"]);
  await showAll(page).click();
  await expectChips(page, ["Live: CR-23"]);
  await expect(cardEl(page, "Sales Order")).toHaveAttribute("data-filter", "labeled");
  await expect(cardEl(page, "customers")).toHaveAttribute("data-filter", "all");
  await expect.poll(async () => (await item("Sales Order", live)).row_filter).toBe("labeled");
});

test("S6A-03: a reader's “Show all” counts and removes only what a reader may", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await setCard("Customer", { rowFilter: "keys" });
  await setCard("customers", { collapsed: true });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  // the filter and collapsed-card chips are not the reader's to remove: one removable chip, no “Show all”
  await expectChips(page, ["1 card filtered", "1 card collapsed", "1 frame collapsed"]);
  await expect(showAll(page)).toHaveCount(0);
  await page.getByTestId("button-tool-hand").click();
  await showAll(page).click();
  await expectToast(page, "Showing everything on this canvas.");
  await expect(page.getByTestId("toast-action")).toHaveCount(0);
  await expectChips(page, ["1 card filtered", "1 card collapsed"]);
  await expect(chip(page, "collapsed-frames")).toHaveCount(0);
  expect((await loadFrames()).find((f) => f.name === "Orders")?.collapsed).toBe(true);
  expect([(await item("Customer")).row_filter, (await item("customers")).collapsed]).toEqual(["keys", true]);
});
