// S27-02 (slice 27, PRD section 6): a figure's options in the figure editor: As on the canvas against Adjusted; the four
// row choices; the line kinds; status marks; the sizes and orientations, the parts' pages checked under print media
// emulation; "in parts" cuts, the whole sizes never do. Each choice is stored in the section's figures and redrawn.

import { expect, test, type Page } from "./fixtures";
import {
  canvasId,
  DEMO_DOCUMENT_NAMES,
  expectLayouts,
  figureEntries,
  figureImages,
  figuresOnly,
  formUrl,
  layouts,
  newFigure,
  openEditor,
  pageFigures,
  signInAs,
  storedDocument,
  svgOf,
} from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;

const stored = async () => ((await storedDocument(DOC))!.sections[0]!.options.figures as Record<string, unknown>[])[0]!;
/** One choice in the figure editor, then the new pages; the SVG the first image shows. */
async function choose(page: Page, change: () => Promise<unknown>) {
  const n = await layouts(page);
  await change();
  await expectLayouts(page, n + 1);
  return svgOf(page, (await figureImages(page))[0]!.src);
}
const rowNames = (svg: string) => (svg.match(/<text x="(36|52)" y="[\d.]+" font-size="12(\.5)?"/g) ?? []).length;

test("S27-02: Adjusted's rows, line kinds and status marks against As on the canvas", async ({ page }) => {
  await figuresOnly(DOC, [newFigure("f1", await canvasId("Customer & orders"))]);
  await signInAs(page, "Łukasz");
  // the exact pages after every change (the demo's layouts are near Auto's threshold on a busy runner)
  await openEditor(page, formUrl((await storedDocument(DOC))!.id));
  await page.getByTestId("select-preview-mode").selectOption("exact");
  await page.locator('[data-testid="editor-section"][data-section="figure"]').click();
  const entry = figureEntries(page).first();
  const asOnCanvas = await svgOf(page, (await figureImages(page))[0]!.src);
  // as on the canvas: the requirement card (D2), relationships, mappings and status dots; no row or line choices
  expect(asOnCanvas).toContain(">REQ-104</text>");
  await expect(entry.getByTestId("select-figure-rows")).toHaveCount(0);

  const adjusted = await choose(page, () => entry.getByTestId("select-figure-view").selectOption("custom"));
  expect(await stored()).toMatchObject({ view: "custom" });
  expect(adjusted).not.toContain(">REQ-104</text>");
  await expect(entry.getByTestId("select-figure-rows")).toHaveValue("canvas");
  // "Dimensional" only while InfoCube is on (D7): the demo's documents have it off
  await expect(entry.getByTestId("check-figure-line-cube")).toHaveCount(0);

  const all = await choose(page, () => entry.getByTestId("select-figure-rows").selectOption("all"));
  const keys = await choose(page, () => entry.getByTestId("select-figure-rows").selectOption("keys"));
  const none = await choose(page, () => entry.getByTestId("select-figure-rows").selectOption("none"));
  expect(rowNames(all)).toBeGreaterThan(rowNames(keys));
  expect(rowNames(keys)).toBeGreaterThan(0);
  expect(rowNames(none)).toBe(0);
  await choose(page, () => entry.getByTestId("select-figure-rows").selectOption("all"));

  const noRel = await choose(page, () => entry.getByTestId("check-figure-line-rel").uncheck());
  expect(noRel).not.toContain('<g class="rel">');
  expect(noRel).toContain('<g class="map');
  const noMap = await choose(page, () => entry.getByTestId("check-figure-line-map").uncheck());
  expect(noMap).not.toContain('<g class="map');
  expect(noMap).toContain('<g class="srel');
  const noSrc = await choose(page, () => entry.getByTestId("check-figure-line-src").uncheck());
  expect(noSrc).not.toContain('<g class="srel');
  expect(/<circle cx="[\d.]+" cy="[\d.]+" r="5"/.test(noSrc)).toBe(true);
  const noStatus = await choose(page, () => entry.getByTestId("check-figure-status").uncheck());
  expect(/<circle cx="[\d.]+" cy="[\d.]+" r="5"/.test(noStatus)).toBe(false);
  expect(await stored()).toMatchObject({ view: "custom", rows: "all", lines: { rel: false, map: false, src: false, cube: true }, status: false });

  // back to As on the canvas: the canvas's own rows, lines and marks again
  const back = await choose(page, () => entry.getByTestId("select-figure-view").selectOption("canvas"));
  expect(back).toBe(asOnCanvas);
});

test("S27-02: the sizes and orientations; only a size in parts cuts, and every part fits its page under print media", async ({ page }) => {
  await figuresOnly(DOC, [newFigure("f1", await canvasId("Customer & orders"))]);
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl((await storedDocument(DOC))!.id));
  await page.getByTestId("select-preview-mode").selectOption("exact");
  await page.locator('[data-testid="editor-section"][data-section="figure"]').click();
  const entry = figureEntries(page).first();
  const size = entry.getByTestId("select-figure-size"), orientation = entry.getByTestId("select-figure-orientation");
  await expect(size.locator("option")).toHaveText(["Whole, as large as fits", "Whole, upright", "Page width, in parts", "100 %, in parts", "75 %, in parts", "50 %, in parts"]);
  await expect(orientation.locator("option")).toHaveText(["As the document", "Portrait", "Landscape, turned"]);

  const set = async (s: string, o: string) => {
    const n = await layouts(page);
    const changed = (await size.inputValue()) !== s || (await orientation.inputValue()) !== o;
    if ((await size.inputValue()) !== s) await size.selectOption(s);
    if ((await orientation.inputValue()) !== o) {
      await expect.poll(async () => (await stored()).size).toBe(s);
      await orientation.selectOption(o);
    }
    await expect.poll(async () => [(await stored()).size, (await stored()).orientation]).toEqual([s, o]);
    if (changed) await expect.poll(() => layouts(page)).toBeGreaterThan(n);
    await expectLayouts(page, await layouts(page));
  };
  /** Each figure image inside its page's content box, under print media; the images, the turned ones and the captions. */
  const check = async () => {
    await page.emulateMedia({ media: "print" });
    const out = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="document-host"] figure[data-testid="figure"]')].map((f) => {
        const box = f.closest(".pagedjs_page")!.querySelector(".pagedjs_page_content")!.getBoundingClientRect();
        const img = (f.querySelector(".drotw") ?? f.querySelector("img"))!.getBoundingClientRect();
        return { inside: img.left >= box.left - 1 && img.right <= box.right + 1 && img.top >= box.top - 1 && img.bottom <= box.bottom + 1, turned: f.classList.contains("drot"), caption: f.querySelector("figcaption")!.textContent };
      }),
    );
    await page.emulateMedia({ media: null });
    expect(out.every((x) => x.inside)).toBe(true);
    return out;
  };

  for (const [s, o] of [
    ["auto", "doc"],
    ["page", "doc"],
    ["page", "portrait"],
  ] as const) {
    await set(s, o);
    const out = await check();
    expect(out).toHaveLength(1);
    expect(out[0]!.caption).toBe("Figure 1. Customer & orders");
  }
  await set("page", "landscape");
  expect((await check())[0]!.turned).toBe(true);
  await set("page", "portrait");
  expect((await check())[0]!.turned).toBe(false);

  // in parts: cut into parts, each one an image of the same SVG with its own region, each fitting its page
  // (the demo canvas fits one page at page width: "Page width, in parts" cuts it into one part, the prototype's rule)
  for (const s of ["100", "75"]) {
    await set(s, "portrait");
    const out = await check();
    expect(out.length).toBeGreaterThan(1);
    expect(out[0]!.caption).toBe(`Figure 1a. Customer & orders (part 1 of ${out.length})`);
    const imgs = await figureImages(page);
    expect(new Set(imgs.map((i) => i.src.split("#")[0])).size).toBe(1);
    expect(imgs.every((i) => /#svgView\(viewBox\([\d.,-]+\)\)$/.test(i.src))).toBe(true);
  }
  await expect(pageFigures(page).first()).toHaveClass(/dtile/);
});
