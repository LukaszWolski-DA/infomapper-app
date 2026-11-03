// Slice 13, step 3: screenshots of the marks under a field after a refusal (runs only with SCREENS=<folder>, into
// docs/prd/slice-13-screens/<folder>/): a conflict on a short field (an entity's name), a long text in the rich-text
// dialog (a requirement's description), "Not saved" (the name and the alias cut behind a conflict) and "Cleared
// meanwhile." (an alias cleared by Anna), each in light and dark mode.
//
//   SCREENS=step-3 npx playwright test e2e/slice-13/S13-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  changeEntityAsAnna,
  changeRequirementAsAnna,
  conflictLine,
  FULL,
  hydrated,
  notSaved,
  openCanvas,
  openEntityFromTree,
  openRequirement,
  setEntityAlias,
  signInAs,
} from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-13-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

/** The top of the details panel, where the entity's fields are. */
async function panelTop(page: Page, name: string) {
  const b = (await page.getByTestId("panel-entity").boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: b.x - 16, y: b.y - 16, width: b.width + 32, height: 330 } });
}

async function customer(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  return page.getByTestId("panel-entity");
}

for (const scheme of ["light", "dark"] as const) {
  test(`S13 screens (${scheme}): a conflict on an entity's name`, async ({ page }) => {
    const panel = await customer(page, scheme);
    await changeEntityAsAnna("Customer", { name: "Client" });
    await panel.getByTestId("input-entity-name").fill("Kunde");
    await panel.getByTestId("input-entity-name").press("Enter");
    await expect(conflictLine(panel)).toBeVisible();
    await page.mouse.move(0, 0);
    await panelTop(page, `conflict-short-${scheme}`);
  });

  test(`S13 screens (${scheme}): Not saved on the name and the alias`, async ({ page }) => {
    const panel = await customer(page, scheme);
    await changeEntityAsAnna("Customer", { stereotype: "context" });
    await panel.getByTestId("input-entity-name").fill("Kunde");
    await panel.getByTestId("input-entity-name").press("Tab");
    await panel.getByTestId("input-entity-alias").fill("Klient");
    await panel.getByTestId("input-entity-alias").press("Enter");
    await expect(notSaved(panel)).toHaveCount(2);
    await page.mouse.move(0, 0);
    await panelTop(page, `not-saved-${scheme}`);
  });

  test(`S13 screens (${scheme}): Cleared meanwhile on the alias`, async ({ page }) => {
    await setEntityAlias("Customer", "Klient");
    const panel = await customer(page, scheme);
    await changeEntityAsAnna("Customer", { alias: null });
    await panel.getByTestId("input-entity-alias").fill("Kunde");
    await panel.getByTestId("input-entity-alias").press("Enter");
    await expect(conflictLine(panel)).toContainText("Cleared meanwhile.");
    await page.mouse.move(0, 0);
    await panelTop(page, `cleared-${scheme}`);
  });

  test(`S13 screens (${scheme}): a long text in the rich-text dialog`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signInAs(page, "Łukasz");
    await openCanvas(page);
    await openRequirement(page, "REQ-103");
    await changeRequirementAsAnna(
      "REQ-103",
      "description",
      "<p>Every active customer has exactly one e-mail address, checked when the customer is created and on every change.</p><p>Two customers may not share an address, in any case; the CRM's duplicates are merged before the load.</p><p>An address that bounces three times is marked, not removed, so the history stays.</p><p>Owner: the CRM team. Reviewed every quarter with the web shop.</p>",
    );
    await page.getByTestId("field-req-description-edit").click();
    const dialog = page.getByTestId("dialog-rich-text");
    await dialog.getByTestId("rte-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" My own sentence.");
    await dialog.getByTestId("button-rte-save").click();
    await expect(conflictLine(dialog)).toBeVisible();
    await page.mouse.move(0, 0);
    await dialog.screenshot({ path: path.join(OUT, `conflict-long-dialog-${scheme}.png`) });
  });
}
