import { clickVisible } from "../canvas-click";
import { expect, test } from "../slice-16/fixtures";
import { canvasUrl, card, hydrated, openCanvas, signInAs, WHOLE_CO } from "../slice-16/helpers";
import { loadRequirements, openRequirementsTab } from "../slice-04a/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-remaining (the S15-24 entry's list, known-limitations.md): "New requirement" in the left panel's
// Requirements tab opened the details panel, focused the new requirement's name and selected it when its answer
// arrived, whatever had been selected by then. The answer is held until a card has been clicked, so the click always
// comes first. Its action is sent with no options (`createRequirementAction(workspace, {})`), which the hold matches.

const nameFields = "[data-testid=input-req-name], [data-testid=input-entity-name]";

test("a card clicked while 'New requirement' is on its way stays selected, and no name is focused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await openRequirementsTab(page);
  const before = (await loadRequirements()).length;

  const hold = await holdUntil(page, ",{}]");
  await page.getByTestId("button-new-requirement").click();
  await expect.poll(() => hold.held()).toBe(true);
  await clickVisible(card(page, "Sales Order").getByTestId("card-name"));
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");

  hold.release();
  await hold.given;
  // the answer has been applied: the requirement is stored and its row drawn in the tab
  await expect.poll(async () => (await loadRequirements()).length).toBe(before + 1);
  await expect(page.getByTestId("tree-req")).toHaveCount(before + 1);
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.getByTestId("panel-requirement")).toHaveCount(0);
  await expect(page.locator(nameFields).and(page.locator(":focus"))).toHaveCount(0);
});

test("'New requirement' selects the requirement with its name focused when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await openRequirementsTab(page);
  await page.getByTestId("button-new-requirement").click();
  await expect(page.getByTestId("panel-requirement")).toBeVisible();
  await expect(page.getByTestId("input-req-name")).toBeFocused();
});
