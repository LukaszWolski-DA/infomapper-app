// Slice 15a, step 4: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-15a-screens/<folder>/): the
// Sales star with the roles and a fact's edge (100 % and 50 %), the Cube tab, the entity panel's Role, the InfoCube box
// (licensed, without the licence, the turn-off refusal), Dim Date's delete preview; each in light and dark.
//
//   SCREENS=step-4 npx playwright test e2e/slice-15a/S15A-screens.spec.ts

import path from "node:path";
import { test, type Page } from "./fixtures";
import { card, hydrated, infocubeBox, infocubeCheck, openCanvas, settingsUrl, signInAs, STAR_VIEW, starUrl } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-15a-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

const shot = (page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });

async function boxOf(page: Page, testId: string, pad = 8) {
  const b = (await page.getByTestId(testId).first().boundingBox())!;
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad };
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signInAs(page, "Łukasz");
    });

    test(`S15A screens (${scheme}): the star, the Cube tab, the Role, the delete preview`, async ({ page }) => {
      await openCanvas(page, starUrl(), STAR_VIEW);
      await hydrated(page);
      await page.mouse.move(5, 500);
      await shot(page, `star-50-${scheme}`);
      await openCanvas(page, starUrl(), { x: -700, y: 0, zoom: 1 });
      await hydrated(page);
      await page.mouse.move(5, 500);
      await shot(page, `star-100-${scheme}`);
      await page.getByTestId("tab-cube").click();
      await shot(page, `cube-tab-${scheme}`, await boxOf(page, "tree", 40));
      await card(page, "Fact Sales").getByTestId("card-name").click();
      await shot(page, `panel-role-fact-${scheme}`, await boxOf(page, "text-entity-role", 60));
      await card(page, "Dim Date").getByTestId("card-name").click();
      await page.getByTestId("button-delete-entity").click();
      await page.getByTestId("table-entity-impact").waitFor();
      await shot(page, `delete-dim-date-${scheme}`, await boxOf(page, "dialog-delete-entity", 8));
    });

    test(`S15A screens (${scheme}): the InfoCube box, licensed and refused`, async ({ page }) => {
      await page.goto(settingsUrl());
      await hydrated(page);
      await shot(page, `box-licensed-${scheme}`, await boxOf(page, "box-infocube"));
      await infocubeCheck(page).uncheck();
      await page.getByTestId("text-infocube-refusal").waitFor();
      await shot(page, `box-refused-${scheme}`, await boxOf(page, "box-infocube"));
      void infocubeBox;
    });
  });
}

test.describe("without the licence", () => {
  test.use({ star: false });
  for (const scheme of ["light", "dark"] as const) {
    test(`S15A screens (${scheme}): the InfoCube box without the licence`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signInAs(page, "Łukasz");
      await page.goto(settingsUrl());
      await hydrated(page);
      await shot(page, `box-no-licence-${scheme}`, await boxOf(page, "box-infocube"));
    });
  }
});
