import { expect, test } from "./fixtures";
import { cubeRowOf, entityIdOf, hydrated, openEntity, openStar, signInAs, undoButton } from "./helpers";

// S15-08b (B-4, the dimension's section): the SCD type 0, 1, 2 with its sentence; the Cube tab's "SCD n" follows, and
// so do a fact's "grain set" and "no grain"; one undo step each.

// slice 19 (D-74, answer 7): the History's sentences start "SCD n:", and the technical columns include the snapshot date
const TECHNICAL = "Technical columns (valid from, valid to, current, snapshot date) are a physical matter and are not modelled here.";
const treeItem = (page: import("@playwright/test").Page, name: string) => page.getByTestId("tree-item").filter({ hasText: name });

test("S15-08b: Dim Date's SCD type 0 → 2 with its sentence and the Cube tab's SCD 2; Fact Sales' grain cleared shows no grain; undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await page.getByTestId("tab-cube").click();
  await expect(treeItem(page, "Dim Date")).toContainText("SCD 0");
  await openEntity(page, "Dim Date");
  await expect(page.getByTestId("text-cube-scd")).toHaveText(`SCD 0: values never change once loaded. ${TECHNICAL}`);
  await page.getByTestId("seg-cube-scd").getByText("2 · history", { exact: true }).click();
  await expect(page.getByTestId("text-cube-scd")).toHaveText(`SCD 2: a change adds a new version; the old one stays with its validity. ${TECHNICAL}`);
  await expect.poll(async () => (await cubeRowOf(entityIdOf("date")))?.history).toBe("history");
  await expect(treeItem(page, "Dim Date")).toContainText("SCD 2");
  await page.getByTestId("seg-cube-scd").getByText("1 · overwrite", { exact: true }).click();
  await expect(page.getByTestId("text-cube-scd")).toHaveText(`SCD 1: a change overwrites the old value; no history. ${TECHNICAL}`);
  await expect.poll(async () => (await cubeRowOf(entityIdOf("date")))?.history).toBe("overwrite");
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRowOf(entityIdOf("date")))?.history).toBe("history");
  await undoButton(page).click();
  await expect.poll(async () => (await cubeRowOf(entityIdOf("date")))?.history).toBe("keep");
  await expect(treeItem(page, "Dim Date")).toContainText("SCD 0");
  // the segment shows the stored type again after the undos (useChoice forgets a stored choice, slice 15b)
  await expect(page.getByTestId("seg-cube-scd").getByText("0 · keep", { exact: true })).toHaveAttribute("aria-pressed", "true");

  await expect(treeItem(page, "Fact Sales")).toContainText("grain set");
  await openEntity(page, "Fact Sales");
  await page.getByTestId("input-cube-grain").fill("");
  await page.getByTestId("input-cube-grain").press("Tab");
  await expect(treeItem(page, "Fact Sales")).toContainText("no grain");
  await undoButton(page).click();
  await expect(treeItem(page, "Fact Sales")).toContainText("grain set");
});
