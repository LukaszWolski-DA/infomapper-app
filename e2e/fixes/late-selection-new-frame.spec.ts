import { clickVisible } from "../canvas-click";
import { expect, test } from "../slice-16/fixtures";
import { canvasUrl, card, emptySpot, hydrated, openCanvas, signInAs, toolboxAt, WHOLE_CO } from "../slice-16/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-canvas (the S15-24 entry's list, known-limitations.md): "New frame here" (`createFrame`) selected
// the new frame and, through the host (`frameCreated`), opened the details panel and focused its name when its answer
// arrived, whatever had been selected by then. The answer is held until a card has been clicked, so the click always
// comes first. Its input is the frame's rectangle and the free cards (`"cards":[`), which the hold matches.

const frameName = "[data-testid=input-frame-name]";

test("a card clicked while 'New frame here' is on its way stays selected, and the frame's name is not focused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  const hold = await holdUntil(page, ',"cards":[');
  await toolboxAt(page, await emptySpot(page));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "New frame here" }).click();
  await expect.poll(() => hold.held()).toBe(true);
  await clickVisible(card(page, "Sales Order").getByTestId("card-name"));
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");

  hold.release();
  await hold.given;
  // the answer has been applied: its toast shows and the frame is drawn
  await expect(page.getByTestId("toast")).toContainText("Frame added.");
  await expect(page.locator("[data-frame]")).not.toHaveCount(0);
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.getByTestId("panel-frame")).toHaveCount(0);
  await expect(page.locator(frameName).and(page.locator(":focus"))).toHaveCount(0);
});

test("'New frame here' selects the new frame with its name focused when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await toolboxAt(page, await emptySpot(page));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "New frame here" }).click();
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("panel-frame").locator(frameName)).toBeFocused();
});
