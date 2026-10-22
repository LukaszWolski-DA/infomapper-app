// S6A-04 (slice 6a, D-39; closes “Live canvases without the view-state bar”): on CR-23's live canvas “Live: CR-23” is
// the first chip and has no ×; the context card's Labeled filter alone shows no filter chip (and no “Show all”); a chip
// switched on comes after “Live”. On Customer & orders there is no live chip.

import { expect, test } from "./fixtures";
import { canvasUrl, cardEl, chip, chipOff, expectChips, ids, labelItem, liveUrl, openCanvas, openLiveFor, signInAs } from "./helpers";

test("S6A-04: a live canvas's chip comes first without ×, and its Labeled filter is not counted", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  const { attribute, table } = await ids();
  // Sales Order comes as context, with the Labeled filter; customers whole
  await labelItem("CR-23", { kind: "attribute", id: attribute("Sales Order", "order_date").id });
  await labelItem("CR-23", { kind: "source_table", id: table("customers").id });
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 0.6 });

  await expect(cardEl(page, "Sales Order")).toHaveAttribute("data-filter", "labeled");
  await expectChips(page, ["Live: CR-23"]);
  await expect(chip(page, "live")).toHaveAttribute("title", "This canvas follows the label");
  await expect(chipOff(page, "live")).toHaveCount(0);
  await expect(chip(page, "filtered")).toHaveCount(0);
  await expect(page.getByTestId("button-view-show-all")).toHaveCount(0);

  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Live: CR-23", "Hand tool"]);

  // another filter on the live canvas counts
  await page.keyboard.press("Escape");
  await cardEl(page, "customers").getByTestId("button-card-filter").click();
  await expectChips(page, ["Live: CR-23", "1 card filtered"]);

  await openCanvas(page, canvasUrl());
  await expectChips(page, []);
});
