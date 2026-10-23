import { expect, test } from "./fixtures";
import { archive, canvasUrl, openCanvas, signInAs } from "./helpers";

for (const user of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
  test(`S7A-12: ${user} (a ${user.startsWith("Piotr") ? "reviewer" : "reader"}) sees the Sources tab without “Import sources…”`, async ({ page }) => {
    await signInAs(page, user);
    await openCanvas(page, canvasUrl());
    await page.getByTestId("tab-sources").click();
    await expect(page.getByTestId("tree-system").first()).toBeVisible();
    await expect(page.getByTestId("button-import-sources")).toHaveCount(0);
  });
}

test("S7A-12: an archived workspace offers no import, even to its owner", async ({ page }) => {
  await archive();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await page.getByTestId("tab-sources").click();
  await expect(page.getByTestId("tree-system").first()).toBeVisible();
  await expect(page.getByTestId("button-import-sources")).toHaveCount(0);
});
