// S20-05 (the status bar and the details panel without a selection, PRD items 4–5, A, C): "Model checks {n}" counts the
// lines that name an entity with a card on the canvas (all groups, answer 4), orange with a High line, absent with none;
// a click with a card selected and the details panel hidden clears the selection, shows the panel at its "Model checks"
// group (opened if folded) and flashes it once; a line there selects its object and centres its card.

import { SEED_IDS } from "../../src/data/local/seed";
import { expect, test } from "./fixtures";
import { canvasCheckItems, canvasChecks, canvasUrl, card, hydrated, openCanvas, signInAs, statusChecks, WHOLE_CO } from "./helpers";
import { expectHidden, panel, togglePanel } from "../slice-05a/helpers";

test("S20-05: the status bar's count, the panel's group and its lines", async ({ page }) => {
  await signInAs(page, "Łukasz");

  // per canvas: its cards' lines; orange with a High one
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), WHOLE_CO);
  await expect(statusChecks(page)).toHaveText("Model checks 9");
  await expect(statusChecks(page)).not.toHaveAttribute("data-high");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await expect(statusChecks(page)).toHaveText("Model checks 9");
  await expect(statusChecks(page)).toHaveAttribute("data-high", "true");
  await expect(statusChecks(page)).toHaveAttribute("title", "Show the model checks for the cards on this canvas");

  // the group folded (nothing selected yet), then a card selected and the details panel hidden: the click shows the
  // panel at the group, opened again
  await expect(canvasChecks(page)).toBeVisible();
  await canvasChecks(page).getByRole("button", { name: /Model checks/ }).click();
  await expect(canvasCheckItems(page).first()).toBeHidden();
  await card(page, "Customer").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await togglePanel(page, "right");
  await expectHidden(page, "right");
  // the flash lasts 900 ms: recorded as it happens
  await page.evaluate(() => {
    const w = window as unknown as { __flashes: string[] };
    w.__flashes = [];
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        if (el.dataset?.testid === "section-canvas-checks") w.__flashes.push(el.getAttribute("data-flash") ?? "off");
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-flash"] });
  });
  await statusChecks(page).click();
  await expect(panel(page, "right")).toBeVisible();
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await expect(canvasChecks(page)).toBeInViewport();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __flashes: string[] }).__flashes)).toEqual(["true", "off"]);
  await expect(canvasCheckItems(page)).toHaveCount(9);
  await expect(canvasCheckItems(page).first()).toBeVisible();
  await expect(canvasChecks(page)).toContainText("For the cards on this canvas. Click one to select it.");
  // High first, with its short label and the whole text as the title
  await expect(canvasCheckItems(page).first()).toContainText("Customer.last_order_id");
  await expect(canvasCheckItems(page).first()).toContainText("wrong way");
  await expect(canvasCheckItems(page).first()).toHaveAttribute("title", "Keys copied the wrong way: copy of Sales Order.order_id, but Customer is the one side of “places”");

  // a line selects its object: the calculated row's attribute panel; a dimensional mapping's panel
  await canvasCheckItems(page).filter({ hasText: "calculated and mapped" }).click();
  await expect(page.getByTestId("input-attribute-name")).toHaveValue("total_amount");
  await statusChecks(page).click();
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await canvasCheckItems(page).filter({ hasText: "Customer.segment_code → Dim Customer.segment_code" }).click();
  await expect(page.getByTestId("panel-cube-mapping")).toBeVisible();

  // a canvas without lines: no count
  await openCanvas(page, canvasUrl(SEED_IDS.canvasBankFirst, SEED_IDS.projBankFirst, SEED_IDS.wsBankX));
  await expect(page.getByTestId("status-notes")).toBeVisible();
  await expect(statusChecks(page)).toHaveCount(0);
});
