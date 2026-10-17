// S4B1-08 (slice 4b-1, PRD item 23; step 7): every role may use Focus and see coverage colours, which only change the
// view. Piotr (reviewer) and Kasia (reader) on “Customer & orders”: Focus on from the toolbar and off from the chip,
// Focus on from a card's menu (a reader's card menu offers it), REQ-105's coverage colours with Focus on; the data file
// is the same afterwards.

import fs from "node:fs";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { canvasUrl, card, openCanvas, openRequirement, signInAs, WHOLE } from "./helpers";

for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
  test(`S4B1-08: ${name} uses Focus and sees coverage colours; nothing is written`, async ({ page }) => {
    await signInAs(page, name);
    await openCanvas(page, canvasUrl(), WHOLE);
    const before = fs.readFileSync(E2E_DB, "utf8");

    // the toolbar and the chip
    await card(page, "Customer").locator(".c-head .c-l2").click();
    await page.getByTestId("button-focus").click();
    await expect(page.getByTestId("layer-fade")).toHaveCount(1);
    await page.getByTestId("chip-focus-off").click();
    await expect(page.getByTestId("layer-fade")).toHaveCount(0);

    // a card's menu
    await card(page, "Sales Order").locator(".c-head .c-l2").click({ button: "right" });
    await page.getByTestId("toolbox-focus").click();
    await expect(page.getByTestId("layer-fade")).toHaveCount(1);

    // a requirement's colours, with Focus on
    await openRequirement(page, "REQ-105");
    await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^focus:requirement:/);
    await expect(page.getByTestId("coverage-row-covered")).toHaveCount(3);
    await expect(page.getByTestId("coverage-row-gap")).toHaveCount(1);
    await page.getByTestId("button-focus").click();
    await expect(page.getByTestId("layer-fade")).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(fs.readFileSync(E2E_DB, "utf8") === before, "the data file is unchanged").toBe(true);
  });
}
