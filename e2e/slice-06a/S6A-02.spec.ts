// S6A-02 (slice 6a, items 3, 7; Łukasz's step 1 answers 5, 6): each removable chip's × turns its item off with the same
// result as the switch it reuses: Focus (no fading, the button up), the layer (“Everything”, saved), collapsed frames
// (expanded and saved for an editor, in the tab only for a reader), resolved notes (shown, remembered in the browser),
// the tool (back to selecting). The chips are buttons in tab order after the breadcrumbs; Enter works (no Delete key).
// Who cannot edit sees the filter and collapsed-card chips without ×, their tooltip saying why.
// The filter and collapsed-card chips' × for editors come with step 3's command (one undo step each).

import { SEED_IDS } from "../../src/data/local/seed";
import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  canvasUrl,
  card,
  chip,
  chipOff,
  collapsedFrame,
  DEMO_NOTES,
  expectChips,
  loadFrames,
  noteEl,
  openCanvas,
  setCard,
  signInAs,
  WHOLE_CO,
} from "./helpers";

test("S6A-02: a chip's × does what its switch does, and the chips are reached with Tab", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const canvas = page.getByTestId("area-canvas");

  // resolved notes hidden from the overview panel (nothing selected), then Focus on Customer, so it fades the rest
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await card(page, "Customer").locator(".c-head .c-l2").click();
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Focus", "Mappings only", "1 frame collapsed", "Resolved notes hidden", "Hand tool"]);
  await expect(page.getByTestId("layer-fade")).toHaveCount(1);
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(0);

  // Tab from the last breadcrumb reaches the first chip's ×; Enter turns Focus off
  await page.getByTestId("breadcrumb").last().focus();
  await page.keyboard.press("Tab");
  await expect(chipOff(page, "focus")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip(page, "focus")).toHaveCount(0);
  await expect(page.getByTestId("layer-fade")).toHaveCount(0);
  await expect(page.getByTestId("button-focus")).toHaveAttribute("aria-pressed", "false");

  await chipOff(page, "layer").click();
  await expect(page.locator('[data-testid="switch-layer"] [data-layer="all"]')).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-layer", "all");

  await chipOff(page, "collapsed-frames").click();
  await expect(blockEl(page, "Orders")).toHaveCount(0);
  await expect.poll(async () => (await loadFrames()).find((f) => f.name === "Orders")?.collapsed).toBe(false);

  await chipOff(page, "notes-hidden").click();
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), `infomapper:notes:hide-resolved:${SEED_IDS.userLukasz}`)).toBe("0");

  await chipOff(page, "tool").click();
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).not.toHaveAttribute("data-mode");
  await expectChips(page, []);

  // the layer was saved as “Everything”: a reload keeps it
  await page.reload();
  await expect(canvas).toHaveAttribute("data-layer", "all");
});

test("S6A-02: a reader's filter and collapsed-card chips have no ×; a reader's frame chip expands in the tab only", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await setCard("Customer", { rowFilter: "keys" });
  await setCard("customers", { collapsed: true });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  await expectChips(page, ["1 card filtered", "1 card collapsed", "1 frame collapsed"]);
  await expect(chipOff(page, "filtered")).toHaveCount(0);
  await expect(chipOff(page, "collapsed-cards")).toHaveCount(0);
  await expect(chip(page, "filtered")).toHaveAttribute("title", /Only editors can change this\.$/);
  await expect(chip(page, "collapsed-cards")).toHaveAttribute("title", /Only editors can change this\.$/);

  await chipOff(page, "collapsed-frames").click();
  await expect(blockEl(page, "Orders")).toHaveCount(0);
  await expectChips(page, ["1 card filtered", "1 card collapsed"]);
  expect((await loadFrames()).find((f) => f.name === "Orders")?.collapsed).toBe(true);
});
