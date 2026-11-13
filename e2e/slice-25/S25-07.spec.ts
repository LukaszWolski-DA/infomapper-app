// S25-07 (slice 25, D2, D3, D6, F29): the document page has a title page, contents with page numbers that match the
// pages, the running header and footer, "Page n of m", the watermark on every page but the title page, each section on a
// new page; print uses A4 portrait and shows the pages alone. Read in the DOM Paged.js lays out, and with print media.

import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, laidOut, marginContent, pagesOf, signInAs, storedDocument, unnumbered, viewUrl } from "./helpers";

const A4 = { width: 793.7, height: 1122.5 }; // 210 × 297 mm at 96 px per inch

test("S25-07: title page, contents with matching page numbers, header and footer, watermark, sections on new pages", async ({ page }) => {
  // slice 26, step 4: slice 25's look, the sections unnumbered (numbered by default since)
  await unnumbered(DEMO_DOCUMENT_NAMES.shared);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(viewUrl(doc.id));
  const n = await laidOut(page);
  expect(n).toBeGreaterThanOrEqual(4);
  // step 4b: the breadcrumbs, Documentation's link back to the tab
  await expect(page.getByTestId("breadcrumb")).toHaveText(["InfoMate", "Retail Co – DWH", "Documentation", DEMO_DOCUMENT_NAMES.shared]);
  await expect(page.getByTestId("breadcrumb").nth(2)).toHaveAttribute("href", /\?tab=docs$/);
  await expect(page.getByTestId("text-pages")).toHaveText(`${n} pages`);
  await expect(pagesOf(page)).toHaveCount(n);

  // the title page: its own named page, nothing in its margins
  const first = pagesOf(page).first();
  await expect(first).toHaveClass(/pagedjs_cover_page/);
  await expect(first.locator("h1")).toHaveText(DEMO_DOCUMENT_NAMES.shared);
  await expect(first.getByTestId("cover-state")).toContainText(/^Model stateLive model on \d{4}-\d{2}-\d{2}$/);
  for (const box of ["top-left", "top-center", "bottom-left", "bottom-right"]) expect(await marginContent(page, 0, box), box).toBe("none");

  // every other page: header, watermark, footer, "Page n of m"
  for (let i = 1; i < n; i++) {
    expect(await marginContent(page, i, "top-left")).toBe(`"InfoMate · ${DEMO_DOCUMENT_NAMES.shared}"`);
    expect(await marginContent(page, i, "top-center")).toBe('"DRAFT · live model"');
    expect(await marginContent(page, i, "bottom-left")).toMatch(/^"Retail Co – DWH · Live model on \d{4}-\d{2}-\d{2}"$/);
    expect(await marginContent(page, i, "bottom-right")).toBe('"Page " counter(page) " of " counter(pages)');
  }

  // the contents' numbers are the pages its sections start on; each section starts a page
  const toc = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="document-host"]')!;
    const pages = [...host.querySelectorAll(".pagedjs_page")];
    return [...host.querySelectorAll(".dtoc a")].map((a) => {
      const target = host.querySelector(a.getAttribute("href")!)!;
      const page = target.closest(".pagedjs_page")!;
      const content = page.querySelector(".pagedjs_page_content")!;
      // Paged.js resolves target-counter() into a counter it resets on the link's ::after (or the link)
      const reset = [getComputedStyle(a, "::after").counterReset, getComputedStyle(a).counterReset].find((r) => r && r !== "none") ?? "";
      return {
        text: a.textContent,
        number: Number(reset.split(" ").at(-1)),
        page: pages.indexOf(page) + 1,
        first: content.textContent!.trim().startsWith(target.textContent!),
      };
    });
  });
  // slice 26 (D2): the dictionary preset's sections
  expect(toc.map((t) => t.text)).toEqual(["Introduction", "Model overview", "Conventions and notation", "Data dictionary", "Requirements and coverage", "Data quality rules", "Classification register"]);
  for (const t of toc) {
    expect(t.number, t.text!).toBe(t.page);
    expect(t.first, t.text!).toBe(true);
  }
  expect(toc[0]!.page).toBe(3);
});

test("S25-07: print uses A4 portrait, the pages alone, no watermark on the title page", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await page.goto(viewUrl(doc.id));
  const n = await laidOut(page);
  await page.emulateMedia({ media: "print" });
  // A4 portrait: the page size rule Paged.js gives the printer, and every page box
  const size = await page.evaluate(() =>
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
      .filter(Boolean),
  );
  // Paged.js writes its default (letter) first and the document's size after it, which wins: A4, portrait by default
  expect(size.at(-1)).toMatch(/^a4( portrait)?$/i);
  await expect(pagesOf(page)).toHaveCount(n);
  for (const box of await pagesOf(page).evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect()).map((r) => ({ width: r.width, height: r.height })))) {
    expect(box.width).toBeCloseTo(A4.width, 0);
    expect(box.height).toBeCloseTo(A4.height, 0);
  }
  // only the pages print: the top bar, the breadcrumbs and the page's own buttons are hidden
  await expect(page.getByTestId("bar-top")).toBeHidden();
  await expect(page.getByTestId("button-print")).toBeHidden();
  await expect(pagesOf(page).first()).toBeVisible();
  expect(await marginContent(page, 0, "top-center")).toBe("none");
  expect(await marginContent(page, 1, "top-center")).toBe('"DRAFT · live model"');
});
