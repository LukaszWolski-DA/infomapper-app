import { expect, test, type Page } from "./fixtures";
import { card, cubeEntities, emptySpot, liveEntityNamed, openCanvas, recordToasts, roleOf, signInAs, STAR_VIEW, starUrl, toasts, toolboxAt, pickConcept } from "./helpers";

// S15-07 (IC-03, B-2, without 15b's hints): New fact from the Cube tab makes a fact card with its name selected in the
// panel, Role Fact, a fact's edge; one undo removes it with its role. The same from the canvas's toolbox, for a
// dimension.

async function expectNameSelected(page: Page, name: string) {
  const field = page.getByTestId("input-entity-name");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(name);
  expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, name.length]);
}

test("S15-07: New fact in the Cube tab: a fact card, its name selected, Role Fact; one undo removes it. New dimension here from the toolbox the same", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const before = (await cubeEntities()).length;

  await page.getByTestId("tab-cube").click();
  await page.getByTestId("button-new-fact").click();
  // slice 17 (D-72): outside a concept frame the concept is chosen in a picker
  await pickConcept(page, "Sales");
  await expect(card(page, "New fact")).toHaveCount(1);
  await expectNameSelected(page, "New fact");
  await expect(roleOf(page, "New fact")).toHaveText("Fact");
  await expect(roleOf(page, "New fact")).toHaveAttribute("title", "Transaction fact (InfoCube)");
  await expect(card(page, "New fact").locator(".card")).toHaveClass(/\bdimn\b.*\bfact\b/);
  await expect(page.getByTestId("text-entity-role")).toHaveText("Fact");
  await expect(page.getByTestId("select-entity-stereotype")).toHaveCount(0);
  await expect.poll(() => toasts(page)).toContainEqual(expect.stringMatching(/^Created New fact in .+\. Type its name now; change the concept in the panel\.$/));
  const fact = (await liveEntityNamed("New fact"))!;
  expect(fact.model_level).toBe("dimensional");
  expect((await cubeEntities()).find((c) => c.entity_id === fact.id)).toMatchObject({ role: "fact", grain: null, fact_type: "transaction", is_factless: false, history: null });
  // it is listed among the facts
  await expect(page.getByTestId("tree-tab-section").first().getByTestId("tree-item").filter({ hasText: "New fact" })).toHaveText(/no grain/);

  await page.getByTestId("input-entity-name").press("Escape");
  await page.getByTestId("button-undo").click();
  await expect(card(page, "New fact")).toHaveCount(0);
  await expect.poll(async () => await liveEntityNamed("New fact")).toBeUndefined();
  await expect.poll(async () => (await cubeEntities()).length).toBe(before);

  // the canvas's toolbox: New dimension here
  const spot = await emptySpot(page);
  const items = await toolboxAt(page, spot);
  expect(items.slice(items.indexOf("New entity here"), items.indexOf("New entity here") + 3)).toEqual(["New entity here", "New fact here", "New dimension here"]);
  await page.getByTestId("menu-toolbox").getByTestId("toolbox-item").filter({ hasText: "New dimension here" }).click();
  await pickConcept(page, "Customer");
  await expect(card(page, "New dimension")).toHaveCount(1);
  await expectNameSelected(page, "New dimension");
  await expect(roleOf(page, "New dimension")).toHaveText("Dimension");
  await expect(page.getByTestId("text-entity-role")).toHaveText("Dimension");
  const dim = (await liveEntityNamed("New dimension"))!;
  expect((await cubeEntities()).find((c) => c.entity_id === dim.id)).toMatchObject({ role: "dimension", grain: null, dim_kind: "standard", history: "overwrite" });
  await page.getByTestId("input-entity-name").press("Escape");
  await page.getByTestId("button-undo").click();
  await expect(card(page, "New dimension")).toHaveCount(0);
  await expect.poll(async () => (await cubeEntities()).length).toBe(before);
});
