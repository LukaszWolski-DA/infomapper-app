// S28-06 (slice 28, finding 1): every input, select, text area and group of the editor's panels has an accessible name
// (a list from the page, each checked with Playwright's computed accessible name; the repository has no axe): the
// Document panel with every fold open, and every section type's panel. "full": the star, so InfoCube's types draw.

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, openDocument, openFold, rowOfType, setSections, signInAs } from "./helpers";

test.use({ seed: "full" });

const ALL = ["text", "overview", "dict", "diagrams", "figure", "s2t", "sources", "classreg", "reqs", "ready", "conv", "trace", "dq", "cube.dim", "cube.bus"];

/** Every control and group in a panel, each with its test id or tag for the failure's message. */
async function expectNamed(page: Page, panel: Locator, where: string) {
  const controls = panel.locator('input, select, textarea, [role="group"], [role="separator"]');
  const n = await controls.count();
  expect(n, where).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const c = controls.nth(i);
    if (!(await c.isVisible())) continue;
    const id = (await c.getAttribute("data-testid")) ?? (await c.evaluate((el) => el.outerHTML.slice(0, 80)));
    await expect(c, `${where}: ${id}`).toHaveAccessibleName(/\S/);
  }
}

test("S28-06: every control of the Document panel and of each section type's panel is named", async ({ page }) => {
  // fifteen panels, each control's name computed one by one
  test.setTimeout(240_000);
  await setSections(
    DEMO_DOCUMENT_NAMES.shared,
    ALL.map((type) => ({ type, ...(type === "reqs" ? { options: { layout: "table" } } : {}) })),
  );
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.shared);
  for (const fold of ["scope", "style", "header-footer", "cover", "sharing"]) await openFold(page, `fold-document-${fold}`);
  await expectNamed(page, page.getByTestId("editor-right"), "Document");
  await expectNamed(page, page.getByTestId("editor-top"), "top bar");
  for (const type of ALL) {
    await rowOfType(page, type).click();
    await expect(page.locator(`[data-testid="panel-section"][data-section="${type}"]`)).toBeVisible();
    await expectNamed(page, page.getByTestId("editor-right"), type);
  }
});
