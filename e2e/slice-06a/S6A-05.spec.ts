// S6A-05 (slice 6a, item 6 as amended): the filter chip's ×, the collapsed-card chip's × and “Show all”'s layout part
// are one undo step each: Ctrl+Z after a × puts back every card it changed; Ctrl+Z after “Show all” puts back the
// filters, collapsed cards and collapsed frames at once. Focus, the layer, hidden notes and the tool are view state and
// do not come back (as in the prototype).

import { expect, test, type Page } from "./fixtures";
import { AROUND, blockEl, canvasUrl, cardEl, chipOff, collapsedFrame, expectChips, item, loadFrames, openCanvas, setCard, signInAs, WHOLE_CO } from "./helpers";

/** Ctrl+Z with nothing focused, once the top bar's Undo is enabled (the step has been saved). */
async function ctrlZ(page: Page) {
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
}

const stored = async () => ({
  customer: (await item("Customer")).row_filter,
  webUsers: (await item("web_users")).row_filter,
  customers: (await item("customers")).collapsed,
  order: (await item("order_header")).collapsed,
  frame: (await loadFrames()).find((f) => f.name === "Orders")?.collapsed,
});

test("S6A-05: a chip's × and “Show all” are one undo step each", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await setCard("Customer", { rowFilter: "keys" });
  await setCard("web_users", { rowFilter: "mapped" });
  await setCard("customers", { collapsed: true });
  await setCard("order_header", { collapsed: true });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const all = { customer: "keys", webUsers: "mapped", customers: true, order: true, frame: true };
  await expectChips(page, ["2 cards filtered", "2 cards collapsed", "1 frame collapsed"]);

  // the filter chip: both filters in one step, back with one Ctrl+Z
  await chipOff(page, "filtered").click();
  await expectChips(page, ["2 cards collapsed", "1 frame collapsed"]);
  await expect.poll(stored).toEqual({ ...all, customer: "all", webUsers: "all" });
  await ctrlZ(page);
  await expectChips(page, ["2 cards filtered", "2 cards collapsed", "1 frame collapsed"]);
  await expect.poll(stored).toEqual(all);

  // the collapsed-card chip: both cards in one step
  await chipOff(page, "collapsed-cards").click();
  await expect.poll(stored).toEqual({ ...all, customers: false, order: false });
  await ctrlZ(page);
  await expect.poll(stored).toEqual(all);
  await expectChips(page, ["2 cards filtered", "2 cards collapsed", "1 frame collapsed"]);

  // “Show all” with Focus on: the layout part comes back with one Ctrl+Z, Focus does not
  await page.getByTestId("button-focus").click();
  await page.getByTestId("button-view-show-all").click();
  await expectChips(page, []);
  await expect.poll(stored).toEqual({ customer: "all", webUsers: "all", customers: false, order: false, frame: false });
  await ctrlZ(page);
  await expect.poll(stored).toEqual(all);
  await expectChips(page, ["2 cards filtered", "2 cards collapsed", "1 frame collapsed"]);
  await expect(blockEl(page, "Orders")).toBeVisible();
  await expect(cardEl(page, "Customer")).toHaveAttribute("data-filter", "keys");
  await expect(page.getByTestId("button-focus")).toHaveAttribute("aria-pressed", "false");
});
