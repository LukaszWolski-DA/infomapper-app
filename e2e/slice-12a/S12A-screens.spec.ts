// Slice 12a, step 4: screenshots of "Delete this project" at the end of the project home (runs only with
// SCREENS=<folder>, into docs/prd/slice-12a-screens/<folder>/): Order management with its own canvas and the shared one,
// the armed button, and the only project (Customer 360 deleted through the domain), each in light and dark mode; the
// workspace home's top bar with Undo and Redo.
//
//   SCREENS=step-4 npx playwright test e2e/slice-12a/S12A-screens.spec.ts

import path from "node:path";
import { deleteProject } from "../../src/domain/commands/project";
import { expect, test, type Page } from "./fixtures";
import { asLukasz, C360, deleteButton, deleteSection, OM_HOME, RETAIL, signInAs, store, WS_HOME } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-12a-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

/** The section with the open notes above it, as a person sees the end of the page. */
async function section(page: Page, name: string) {
  await deleteSection(page).scrollIntoViewIfNeeded();
  const b = (await deleteSection(page).boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 140), width: Math.min(1000, b.width + 48), height: b.height + 170 } });
}

test("S12A screens: the delete section (shared and own canvases, armed, the only project) and the homes' Undo, light and dark", async ({ page }) => {
  await signInAs(page, "Łukasz");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(WS_HOME);
    await page.screenshot({ path: path.join(OUT, `ws-home-top-bar-${scheme}.png`), clip: { x: 0, y: 0, width: 1536, height: 46 } });
    await page.goto(OM_HOME);
    await expect(deleteSection(page)).toBeVisible();
    await section(page, `section-${scheme}`);
    await deleteButton(page).click();
    await expect(deleteButton(page)).toHaveAttribute("data-armed", "true");
    await section(page, `section-armed-${scheme}`);
  }

  // the only project
  const s = store();
  const [project, projects, canvases, items, frames, notes, pins] = await Promise.all([
    s.projects.get(RETAIL, C360),
    s.projects.list(RETAIL),
    s.canvases.list(RETAIL),
    s.canvasItems.list(RETAIL),
    s.frames.list(RETAIL),
    s.notes.list(RETAIL),
    s.labels.listPins(RETAIL),
  ]);
  const links = (await Promise.all(canvases.map((c) => s.canvases.listLinksOfCanvas(RETAIL, c.id)))).flat();
  await asLukasz((ctx, access) => deleteProject(ctx, access, { project, projects, links, canvases, items, frames, notes, pins }, { projectId: C360, expectedVersion: project!.version }));
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(OM_HOME);
    await expect(deleteButton(page)).toBeDisabled();
    await section(page, `section-only-project-${scheme}`);
  }
});
