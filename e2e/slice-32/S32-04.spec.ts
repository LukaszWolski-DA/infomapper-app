// S32-04 (slice 32, D-85, criterion 4): with no choice everything looks as before the slice: no attribute on `<html>`,
// the palette's light values under a light system and its dark values under a dark one (on the homes, the canvas and
// the sign-in page), the notes' papers, the canvas looks and the rich text's colours included; the one intended change
// is `color-scheme: light dark` (P1). S32-05 (CI, the Schema workflow, the full run) is in the step's report.

import { expect, test, type Page } from "./fixtures";
import { BODY_BG, CANVAS, OM_HOME, bodyBg, colorSchemeOf, expectTokens, signInAs, themeAttr } from "./helpers";

test.use({ seed: "plain" });

/** Rules that live outside the palette's block (the notes' papers, a canvas look, the rich text's colours, the coverage fill). */
const extras = (page: Page) =>
  page.evaluate(() => {
    const probe = (cls: string, attr?: [string, string]) => {
      const e = document.createElement("div");
      e.className = cls;
      if (attr) e.setAttribute(attr[0], attr[1]);
      document.body.append(e);
      const s = getComputedStyle(e);
      const out = { np: s.getPropertyValue("--np").trim(), canvas: s.getPropertyValue("--im-canvas").trim(), color: s.color };
      e.remove();
      return out;
    };
    return { note: probe("nt c-blue").np, warm: probe("x", ["data-bg", "warm"]).canvas, warn: probe("tc-warn").color };
  });

const LIGHT = { note: "#dcebff", warm: "#f4f1eb", warn: "rgb(194, 65, 12)" };
const DARK = { note: "#1f3550", warm: "#1c1a17", warn: "rgb(255, 139, 78)" };

for (const scheme of ["light", "dark"] as const) {
  test(`S32-04: no choice is System, as before the slice (${scheme} system)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/sign-in");
    expect(await themeAttr(page)).toBeNull();
    await expectTokens(page, scheme);
    await signInAs(page, "Łukasz");
    for (const url of [OM_HOME, CANVAS]) {
      await page.goto(url);
      expect(await themeAttr(page)).toBeNull();
      await expectTokens(page, scheme);
      expect(await bodyBg(page)).toBe(BODY_BG[scheme]);
      // the notes' papers are canvas.css's, loaded with the canvas
      const want = scheme === "light" ? LIGHT : DARK;
      expect(await extras(page)).toEqual(url === CANVAS ? want : { ...want, note: "" });
      expect(await colorSchemeOf(page)).toBe("light dark");
    }
  });
}
