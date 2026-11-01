// Slice 12b's smoke in Chromium, Firefox and WebKit (Łukasz, step 4; on demand: `BROWSERS=1 npx playwright test
// e2e/slice-12b/S12B-browsers.spec.ts`): the shapes an external `<use>` draws take the page's tokens, in light and in
// dark mode (PRD P5). Their styles are in the `<use>`'s shadow tree, which no script can read, so this one test reads
// pixels: a table card is painted `var(--im-physical)` at 55 % over the strip's `--im-canvas`, and that blend, from
// the page's own token values in each mode, must be among the thumbnail's pixels.

import { SEED_IDS } from "../../src/data/local/seed";
import { signInAs } from "../slice-00/helpers";
import { expect, test, type Page } from "./fixtures";

type Rgb = [number, number, number];

const hex = (s: string): Rgb => {
  const h = s.trim().replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const blend = (top: Rgb, under: Rgb, alpha: number): Rgb => top.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha))) as Rgb;

/** The thumbnail's pixels that lie within `tolerance` of `want`, read by drawing its screenshot into a canvas. */
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

for (const colorScheme of ["light", "dark"] as const) {
  test(`S12B browsers: a thumbnail's shapes take the page's tokens (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await signInAs(page, "Łukasz");
    await page.goto(`/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projOrderManagement}`);
    await expect(page.getByTestId("tile-thumbnail").first()).toBeVisible();
    const token = (name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), name);
    const want = blend(hex(await token("--im-physical")), hex(await token("--im-canvas")), 0.55);
    // the drawing arrives after the page: wait until its table cards are painted. Their insides are about 2,200 pixels
    // (9,600 in WebKit's 2× device); the antialiased edges of any shape hold about 100 near any blend, so the bar is 1,000
    await expect.poll(() => pixelsNear(page, want), { timeout: 10_000, message: `table cards in rgb(${want.join(", ")})` }).toBeGreaterThan(1000);
  });
}
