// S26-08 (slice 26, PRD section 2 "Style", step 4): the style chosen in the editor's Style panel (template, accent,
// colours, paper and orientation, numbering, banded rows, keep-rows, running header, the draft mark, the header and
// footer fields with {page} and {pages}); the document page and print follow it, the page size and orientation checked
// with print media emulation.

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, formUrl, keepOnly, laidOut, marginContent, openEditor, pagesOf, signInAs, storedDocument, viewUrl } from "./helpers";

const SHARED = DEMO_DOCUMENT_NAMES.shared;
const MM = 96 / 25.4;

const styleOf = async () => (await storedDocument(SHARED))!.style;

/** A choice in the Style panel, and its value stored. */
async function choose(page: Page, seg: string, label: string, check: (s: Awaited<ReturnType<typeof styleOf>>) => unknown) {
  await page.getByTestId(`seg-style-${seg}`).getByRole("button", { name: label, exact: true }).click();
  await expect.poll(async () => check(await styleOf())).toBe(true);
}

/** The page rule Paged.js gives the printer: the last `@page size`. */
const printedSize = (page: Page) =>
  page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules];
        } catch {
          return [];
        }
      })
      .filter((r) => r instanceof CSSPageRule)
      .map((r) => (r as CSSPageRule).style.getPropertyValue("size"))
      .filter(Boolean)
      .at(-1),
  );

test("S26-08: a Formal A3 landscape document in black and white, numbered and banded, with its own header and footer; the page and print follow it", async ({ page }) => {
  await keepOnly(SHARED, ["text", "dict"]);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await expect(page.getByTestId("panel-style")).toBeVisible();

  await choose(page, "template", "Formal", (s) => s.template === "formal");
  await expect(page.getByTestId("panel-style")).toContainText("Serif body text for reading, ruled cover; for client deliverables.");
  await page.getByTestId("choice-style-accent").getByRole("button", { name: "burgundy" }).click();
  await expect.poll(async () => (await styleOf()).accent).toBe("burgundy");
  await choose(page, "paper", "A3", (s) => s.paper === "A3");
  await choose(page, "orientation", "Landscape", (s) => s.orientation === "landscape");
  await choose(page, "colours", "Black and white", (s) => s.colours === "mono");
  await page.getByTestId("check-style-banded").check();
  await expect.poll(async () => (await styleOf()).banded).toBe(true);
  await page.getByTestId("select-style-keepRows").selectOption("40");
  await expect.poll(async () => (await styleOf()).keepRows).toBe(40);
  await page.getByTestId("check-style-watermark").uncheck();
  await expect.poll(async () => (await styleOf()).watermark).toBe(false);
  await page.getByTestId("input-style-header-right").fill("{date}");
  await page.getByTestId("input-style-header-right").press("Enter");
  await page.getByTestId("input-style-footer-right").fill("{page}/{pages}");
  await page.getByTestId("input-style-footer-right").press("Enter");
  await expect.poll(async () => (await styleOf()).footer.right).toBe("{page}/{pages}");
  // the header's left part drops the page tokens (D6)
  await page.getByTestId("input-style-header-left").fill("{title} · {page}");
  await page.getByTestId("input-style-header-left").press("Enter");
  await expect.poll(async () => (await styleOf()).header.left).toBe("{title} · {page}");

  await page.goto(viewUrl(doc.id));
  const n = await laidOut(page);
  const host = page.getByTestId("document-host");
  // numbered sections and subsections
  await expect(host.locator("h2[id] .dnum")).toHaveText(["1", "2"]);
  await expect(host.locator("h3.dh3 .dnum").first()).toHaveText("2.1");
  // Formal: serif body text, sans headings; black and white: the accent is black
  expect(await host.locator(".dsec p").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Georgia/);
  expect(await host.locator("h2[id]").first().evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/Georgia/);
  expect(await host.locator("h2[id]").first().evaluate((el) => getComputedStyle(el).borderBottomColor)).toBe("rgb(17, 17, 17)");
  // banded: every second row; keep-rows: a short entity's block stays together
  expect(await host.locator("tbody.dat.even td").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(242, 242, 242)");
  await expect(host.locator(".dent.keep").first()).toBeAttached();
  // the header and footer: their fields, the page counters, no draft mark
  const today = new Date().toLocaleDateString("sv-SE");
  expect(await marginContent(page, 2, "top-left")).toBe(`"${SHARED}"`);
  expect(await marginContent(page, 2, "top-right")).toBe(`"${today}"`);
  expect(await marginContent(page, 2, "top-center")).toBe("none");
  expect(await marginContent(page, 2, "bottom-right")).toBe('counter(page) "/" counter(pages)');

  // print: A3 landscape, every page box that size
  await page.emulateMedia({ media: "print" });
  expect(await printedSize(page)).toMatch(/^a3 landscape$/i);
  for (const box of await pagesOf(page).evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect()).map((r) => ({ width: r.width, height: r.height })))) {
    expect(box.width).toBeCloseTo(420 * MM, 0);
    expect(box.height).toBeCloseTo(297 * MM, 0);
  }
  await expect(pagesOf(page)).toHaveCount(n);
});

test("S26-08: Compact runs sections on; the title page, the contents and the running header turned off", async ({ page }) => {
  await keepOnly(SHARED, ["text", "dict"]);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await openEditor(page, formUrl(doc.id));
  await choose(page, "template", "Compact", (s) => s.template === "compact");
  for (const k of ["cover", "contents", "runningHeader", "numbers"]) {
    await page.getByTestId(`check-style-${k}`).uncheck();
    await expect.poll(async () => (await styleOf())[k as "cover"]).toBe(false);
  }
  // a section's "Start on a new page" is disabled, with the reason
  await page.locator('[data-testid="editor-section"][data-section="dict"]').click();
  await expect(page.getByTestId("check-section-new-page")).toBeDisabled();
  await expect(page.getByTestId("panel-section")).toContainText("The Compact template runs sections on.");

  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  const host = page.getByTestId("document-host");
  await expect(host.getByTestId("document-cover")).toHaveCount(0);
  await expect(host.getByTestId("document-contents")).toHaveCount(0);
  await expect(host.locator(".dnum")).toHaveCount(0);
  // the dictionary runs on: it starts on the Text's page
  const pageOf = (heading: string) => host.locator(".pagedjs_page").filter({ has: page.locator("h2[id]", { hasText: heading }) }).first().getAttribute("data-page-number");
  expect(await pageOf("Data dictionary")).toBe(await pageOf("Introduction"));
  // no header; the footer stays
  expect(await marginContent(page, 0, "top-left")).toBe("none");
  expect(await marginContent(page, 0, "bottom-right")).toBe('"Page " counter(page) " of " counter(pages)');
  // Compact's smaller tables
  expect(parseFloat(await host.locator("table.dt").first().evaluate((el) => getComputedStyle(el).fontSize))).toBeCloseTo((7.8 * 96) / 72, 1);
  // A4 portrait still, as printed
  await page.emulateMedia({ media: "print" });
  // Paged.js writes "a4" for portrait, its default orientation (as S25-07 reads it)
  expect(await printedSize(page)).toMatch(/^a4( portrait)?$/i);
});
