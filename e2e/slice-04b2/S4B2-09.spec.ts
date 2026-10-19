// S4B2-09 (slice 4b-2, PRD item 24; AD-05): a reviewer (Piotr) and a reader (Kasia) see requirement cards and trace lines,
// select them and use Focus; none of placing, moving, linking or removing is offered to them, and nothing is written.

import fs from "node:fs";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { box, canvasUrl, openCanvas, openEntityFromTree, openRequirement, reqCard, requirementRow, signInAs, tracesOfCard } from "./helpers";

// REQ-104's card (1176, 1136) in the view's middle, clear of the Overview
const VIEW = { x: 300 - 1176 * 0.6, y: 200 - 1136 * 0.6, zoom: 0.6 };

for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
  test(`S4B2-09: ${name} sees and selects requirement cards and uses Focus; no placing, moving, linking or removing; nothing written`, async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, name);
    await openCanvas(page, canvasUrl(), VIEW);
    const before = fs.readFileSync(E2E_DB, "utf8");

    // seen: the card and its four trace lines
    await expect(reqCard(page, "REQ-104")).toBeVisible();
    await expect(await tracesOfCard(page, "REQ-104")).toHaveCount(4);

    // selected: the mark and the requirement's panel, without “Place its card” or “Remove its card”
    const name104 = await box(reqCard(page, "REQ-104").getByTestId("card-name"));
    await page.mouse.click(name104.x + 20, name104.y + name104.height / 2);
    await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
    await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-104");
    await expect(page.getByTestId("button-requirement-uncard")).toHaveCount(0);
    await expect(page.getByTestId("button-requirement-card")).toHaveCount(0);

    // Focus on it
    await page.getByTestId("button-focus").click();
    await expect(page.getByTestId("layer-fade")).toHaveAttribute("data-fade", /^focus:requirement:/);
    await expect(page.getByTestId("lit-trace")).toHaveCount(4);
    await page.getByTestId("button-focus").click();
    await expect(page.getByTestId("layer-fade")).toHaveCount(0);

    // Delete does nothing; a right-click offers no “Remove its card” (with nothing to offer, no menu opens)
    await page.keyboard.press("Delete");
    await expect(reqCard(page, "REQ-104")).toBeVisible();
    await page.mouse.click(name104.x + 20, name104.y + name104.height / 2, { button: "right" });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("toolbox-requirement-remove")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // a drag does not move it
    await page.mouse.move(name104.x + 20, name104.y + name104.height / 2);
    await page.mouse.down();
    await page.mouse.move(name104.x + 80, name104.y + 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await box(reqCard(page, "REQ-104").getByTestId("card-name"))).x).toBeCloseTo(name104.x, 0);

    // the left panel's requirement rows do not drag (no link by dropping, no card)
    await openRequirement(page, "REQ-105");
    await expect(requirementRow(page, "REQ-105")).not.toHaveAttribute("draggable", "true");
    await expect(page.getByTestId("button-requirement-card")).toHaveCount(0);

    // an element panel's Requirements section: no “Place card”, no drag, no “Add all”
    await openEntityFromTree(page, "Customer");
    const rows = page.getByTestId("panel-entity").getByTestId("item-requirement");
    await expect(rows.first()).toBeVisible();
    await expect(page.getByTestId("button-requirement-place")).toHaveCount(0);
    await expect(page.getByTestId("button-requirements-add-all")).toHaveCount(0);
    for (const r of await rows.all()) await expect(r).not.toHaveAttribute("draggable", "true");

    // an entity not on this canvas: no “Add to this canvas”
    await openEntityFromTree(page, "Product");
    await expect(page.getByTestId("button-add-card")).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(fs.readFileSync(E2E_DB, "utf8") === before, "the data file is unchanged").toBe(true);
  });
}
