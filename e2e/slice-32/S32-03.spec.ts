// S32-03 (slice 32, D-85, criterion 3): the special places. A canvas thumbnail takes the chosen theme's tokens through its
// `<use>` (Q4: no change to the drawing or its key), before and after a switch without a reload. InfoDocumenter's pages
// stay light in Dark (their own tokens and `color-scheme: light`, Q5) while the editor around them turns dark. Native
// controls follow the choice (`color-scheme`, P1).

import { expect, test, type Page } from "./fixtures";
import { thumbnailHref, tileOf } from "../slice-12b/helpers";
import { OM_HOME, chooseTheme, colorSchemeOf, expectTokens, laidOut, openDocument, pagesOf, signInAs, tokenOf, viewUrl } from "./helpers";

type Rgb = [number, number, number];
const hex = (s: string): Rgb => [0, 2, 4].map((i) => parseInt(s.trim().replace("#", "").slice(i, i + 2), 16)) as Rgb;
const blend = (top: Rgb, under: Rgb, alpha: number): Rgb => top.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha))) as Rgb;

/** The thumbnail's pixels near `want` (S12B-browsers' method: the `<use>`'s shadow tree has no styles a script can read). */
async function pixelsNear(page: Page, want: Rgb, tolerance = 6): Promise<number> {
  const png = (await page.getByTestId("tile-thumbnail").first().screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, want, tolerance }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]! - want[0]) <= tolerance && Math.abs(d[i + 1]! - want[1]) <= tolerance && Math.abs(d[i + 2]! - want[2]) <= tolerance) n++;
      return n;
    },
    { png, want, tolerance },
  );
}

/** A table card in the thumbnail: `--im-physical` at 55 % over the strip's `--im-canvas`, by the page's current tokens. */
const tableCard = async (page: Page) => blend(hex(await tokenOf(page, "--im-physical")), hex(await tokenOf(page, "--im-canvas")), 0.55);

test.use({ seed: "plain" });

test("S32-03: a thumbnail takes the chosen theme against the system, and follows a switch at once", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await expect(page.getByTestId("tile-thumbnail").first()).toBeVisible();
  const href = await thumbnailHref(tileOf(page, "Customer & orders"));

  await chooseTheme(page, "light");
  await page.keyboard.press("Escape");
  await expectTokens(page, "light");
  const light = await tableCard(page);
  await expect.poll(() => pixelsNear(page, light), { timeout: 10_000, message: `light table cards rgb(${light.join(", ")})` }).toBeGreaterThan(1000);

  await chooseTheme(page, "dark");
  await page.keyboard.press("Escape");
  await expectTokens(page, "dark");
  const dark = await tableCard(page);
  await expect.poll(() => pixelsNear(page, dark), { timeout: 10_000, message: `dark table cards rgb(${dark.join(", ")})` }).toBeGreaterThan(1000);
  expect(await pixelsNear(page, light)).toBeLessThan(100);

  // the same address (the drawing's key): the file holds no colour of the theme (AD-32 unchanged)
  expect(await thumbnailHref(tileOf(page, "Customer & orders"))).toBe(href);
});

test.describe("InfoDocumenter", () => {
  test.use({ seed: "docs" });

  const pageColours = (page: Page) =>
    pagesOf(page)
      .first()
      .evaluate((p) => {
        const s = getComputedStyle(p);
        const th = p.querySelector("table.dt th");
        return { bg: s.backgroundColor, ink: s.color, scheme: s.colorScheme, th: th ? getComputedStyle(th).backgroundColor : null };
      });

  test("S32-03: the editor's pages and the print preview stay light in Dark; the editor around them turns dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signInAs(page, "Łukasz");
    const doc = await openDocument(page);
    const light = await pageColours(page);
    const options = () => page.getByTestId("editor-right").evaluate((e) => getComputedStyle(e).backgroundColor);
    const optionsLight = await options();
    expect(light).toMatchObject({ bg: "rgb(255, 255, 255)", scheme: "light" });

    await chooseTheme(page, "dark");
    await page.keyboard.press("Escape");
    await expectTokens(page, "dark");
    expect(await pageColours(page)).toEqual(light);
    expect(await options()).not.toBe(optionsLight);
    // a native control in the editor follows the choice; the pages keep theirs
    expect(await colorSchemeOf(page, '[data-testid="select-preview-zoom"]')).toBe("dark");

    // the print preview (the document page) is laid out light under Dark too
    await page.goto(viewUrl(doc.id));
    await laidOut(page);
    expect(await pageColours(page)).toEqual(light);
  });
});

test("S32-03: color-scheme follows the choice: light dark for System, light or dark when chosen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signInAs(page, "Łukasz");
  expect(await colorSchemeOf(page)).toBe("light dark");
  await chooseTheme(page, "light");
  expect(await colorSchemeOf(page)).toBe("light");
  expect(await colorSchemeOf(page, "button")).toBe("light");
  await chooseTheme(page, "dark");
  expect(await colorSchemeOf(page)).toBe("dark");
  expect(await colorSchemeOf(page, "button")).toBe("dark");
});
