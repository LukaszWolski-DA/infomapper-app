// Slice 22, step 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-22-screens/<folder>/): Dim Customer's
// "Unknown member" with a value and a value that does not fit, the flag off, and Fact Sales' Dimensions; light and dark.
//
//   SCREENS=step-3 npx playwright test e2e/slice-22/S22-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { hydrated, openEntity, openStar, setUnknownAs, setValueAs, signInAs, unknownBad, unknownField, unknownSentence, OFF_SENTENCE } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-22-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

async function start(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`S22 screens (${scheme}): the section with a value and a value that does not fit`, async ({ page }) => {
    await setValueAs("cust.customer_key", "abc");
    await setValueAs("cust.segment_code", "n/a");
    await start(page, scheme);
    await openEntity(page, "Dim Customer");
    await expect(unknownBad(page, "cust.customer_key")).toBeVisible();
    await unknownField(page).scrollIntoViewIfNeeded();
    await page.getByTestId("section-cube-dimension").screenshot({ path: path.join(OUT, `section-${scheme}.png`) });
  });

  test(`S22 screens (${scheme}): the flag off`, async ({ page }) => {
    await setUnknownAs("cust", false);
    await start(page, scheme);
    await openEntity(page, "Dim Customer");
    await expect(unknownSentence(page)).toHaveText(OFF_SENTENCE);
    await page.getByTestId("section-cube-dimension").screenshot({ path: path.join(OUT, `off-${scheme}.png`) });
  });

  test(`S22 screens (${scheme}): Fact Sales' Dimensions`, async ({ page }) => {
    await start(page, scheme);
    await openEntity(page, "Fact Sales");
    await page.getByTestId("list-cube-dimensions").screenshot({ path: path.join(OUT, `dimensions-${scheme}.png`) });
  });
}
