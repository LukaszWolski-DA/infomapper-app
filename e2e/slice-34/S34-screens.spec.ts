// Slice 34's screenshots on the local adapter (demo data only): the editor's bar with "Markdown", the dialog on the
// dictionary with the star's diagrams, light and dark. On demand: SCREENS=<folder> npm run e2e -- e2e/slice-34/S34-screens.spec.ts
// (skipped otherwise).
import path from "node:path";
import { test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, markdownDialog, openDocument, openMarkdown, signInAs } from "./helpers";

const folder = process.env.SCREENS;
test.skip(!folder, "SCREENS=<folder> takes the screenshots.");
test.use({ seed: "full" });

for (const scheme of ["light", "dark"] as const) {
  test(`slice 34 screens (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "Łukasz");
    await openDocument(page, DEMO_DOCUMENT_NAMES.shared);
    await page.screenshot({ path: path.join(folder!, `editor-bar-${scheme}.png`), clip: { x: 0, y: 0, width: 1440, height: 120 } });
    await openMarkdown(page);
    // the box scrolled to the first diagram
    await markdownDialog(page)
      .getByTestId("text-markdown")
      .evaluate((pre) => {
        const at = (pre.textContent ?? "").indexOf("```mermaid");
        const lines = (pre.textContent ?? "").slice(0, Math.max(0, at)).split("\n").length;
        pre.scrollTop = Math.max(0, (lines - 3) * 18);
      });
    await page.screenshot({ path: path.join(folder!, `markdown-dialog-${scheme}.png`) });
  });
}
