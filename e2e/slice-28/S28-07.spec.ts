// S28-07 (slice 28, findings 3 to 12, F2, F5, F6): the right panel. Figure selects show their whole choice (view and
// orientation on one row, the size on its own; the star's size as wide as its row) and the entry has its padding; every
// segment group is on one line at 340 px; the Document panel's folds, Header and footer and Cover folded at first and
// remembered; Heading and "Start on a new page" at the end of a section's panel; Sharing after Cover; the long texts'
// labels name the section's own long texts. "full": the star, so the Dimensional model draws its star options.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, openDocument, rowOfType, setSections, signInAs, storedDocument } from "./helpers";

test.use({ seed: "full" });

/** The panel's selects whose shown choice does not fit, and its segment groups on more than one line. */
const fitOf = (page: Page) =>
  page.getByTestId("editor-right").evaluate((panel) => {
    const c = document.createElement("canvas").getContext("2d")!;
    const cut: string[] = [];
    for (const s of panel.querySelectorAll("select")) {
      if (!(s as HTMLElement).offsetParent) continue;
      const cs = getComputedStyle(s);
      c.font = `${cs.fontSize} ${cs.fontFamily}`;
      // the text, the padding and the arrow (about 20 px)
      const need = c.measureText(s.options[s.selectedIndex]?.text ?? "").width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 20;
      if (need > s.getBoundingClientRect().width) cut.push(`${s.dataset.testid}: ${s.options[s.selectedIndex]?.text}`);
    }
    const wraps: string[] = [];
    for (const g of panel.querySelectorAll('[role="group"]')) {
      const buttons = [...g.querySelectorAll(":scope > button")] as HTMLElement[];
      if (buttons.length && buttons[0]!.offsetParent && new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size > 1) wraps.push((g as HTMLElement).dataset.testid ?? "?");
    }
    return { cut, wraps };
  });

test("S28-07: figure selects show their whole choice; every segment group is on one line at 340 px", async ({ page }) => {
  // Diagrams keeps its stored figures (they are made with the section, F7 of slice 27)
  const stored = (await storedDocument(DEMO_DOCUMENT_NAMES.s2t))!;
  const figures = stored.sections.find((x) => x.type === "diagrams")!.options;
  await setSections(DEMO_DOCUMENT_NAMES.s2t, [
    { type: "diagrams", options: figures },
    { type: "overview" },
    { type: "dict" },
    { type: "s2t" },
    { type: "sources" },
    { type: "classreg" },
    { type: "reqs", options: { layout: "table" } },
    { type: "dq" },
    { type: "trace" },
    { type: "cube.dim" },
  ]);
  await signInAs(page, "Łukasz");
  await openDocument(page);
  expect(await page.getByTestId("editor-right").evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(340);
  expect(await fitOf(page)).toEqual({ cut: [], wraps: [] });
  for (const type of ["diagrams", "overview", "dict", "s2t", "sources", "classreg", "reqs", "dq", "trace", "cube.dim"]) {
    await rowOfType(page, type).click();
    await expect(page.locator(`[data-testid="panel-section"][data-section="${type}"]`)).toBeVisible();
    expect(await fitOf(page), type).toEqual({ cut: [], wraps: [] });
  }
  // Diagrams: view and orientation on one row, the size on its own; the entry has its padding (F6)
  await rowOfType(page, "diagrams").click();
  const entry = page.getByTestId("figure-entry").first();
  await expect(entry.getByTestId("figure-row-view").locator("select")).toHaveCount(2);
  await expect(entry.getByTestId("figure-row-size").locator("select")).toHaveCount(1);
  expect(await entry.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("8px");
  // the dictionary's Layout and the long texts with their short labels, the full sentence in the hint
  await rowOfType(page, "dict").click();
  await expect(page.getByTestId("seg-dict-layout").getByRole("button")).toHaveText(["Under row", "Column", "Blocks"]);
  await expect(page.locator('[data-testid="panel-section"][data-section="dict"]')).toContainText("Definition under each row: the row keeps the short properties");
  await rowOfType(page, "s2t").click();
  await expect(page.getByTestId("seg-s2t-longTexts").getByRole("button")).toHaveText(["Under row", "Numbered", "Column"]);
  await expect(page.locator('[data-testid="panel-section"][data-section="s2t"]')).toContainText("Long texts (rule, note)");
  await rowOfType(page, "sources").click();
  await expect(page.locator('[data-testid="panel-section"][data-section="sources"]')).toContainText("Long texts (column notes)");
  await rowOfType(page, "dq").click();
  await expect(page.locator('[data-testid="panel-section"][data-section="dq"]')).toContainText("Long texts (rule, description)");
});

test("S28-07: the Document panel folds, Header and footer and Cover at first, remembered; Sharing last; the header's hint", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  const fold = (name: string) => page.getByTestId(`fold-document-${name}`).getByRole("button").first();
  await expect(fold("scope")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("style")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("sharing")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("header-footer")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("cover")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("input-cover-title")).toBeHidden();
  // the order: Scope, Style, Header and footer, Cover, Sharing
  const order = await page.getByTestId("panel-document").evaluate((el) => [...el.querySelectorAll('[data-testid^="fold-document-"]')].map((f) => f.getAttribute("data-testid")));
  expect(order).toEqual(["fold-document-scope", "fold-document-style", "fold-document-header-footer", "fold-document-cover", "fold-document-sharing"]);

  // opened and shut by hand: remembered after a reload
  await fold("cover").click();
  await fold("scope").click();
  await expect(page.getByTestId("input-cover-title")).toBeVisible();
  await expect(page.getByTestId("checks-projects")).toBeHidden();
  await page.reload();
  await expect(fold("cover")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("scope")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("header-footer")).toHaveAttribute("aria-expanded", "false");

  // the header's right part: a grey hint, not a word that looks stored
  await fold("header-footer").click();
  await expect(page.getByTestId("input-style-header-right")).toHaveAttribute("placeholder", "Nothing by default");
  await expect(page.getByTestId("input-style-header-right")).toHaveValue("");
});

test("S28-07: Heading and Start on a new page at the end of a section's panel", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await rowOfType(page, "s2t").click();
  const panel = page.locator('[data-testid="panel-section"][data-section="s2t"]');
  const last = await panel.evaluate((el) => (el.lastElementChild as HTMLElement).dataset.testid);
  expect(last).toBe("section-heading-options");
  const options = (await panel.getByTestId("section-options").boundingBox())!;
  const heading = (await panel.getByTestId("input-section-heading").boundingBox())!;
  expect(heading.y).toBeGreaterThan(options.y + options.height - 1);
  await expect(panel.getByTestId("section-heading-options").getByTestId("check-section-new-page")).toHaveCount(1);
});
