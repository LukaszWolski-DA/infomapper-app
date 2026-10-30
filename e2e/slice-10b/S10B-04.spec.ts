import { expect, test } from "./fixtures";
import { openCanvas, signInAs, sourceLines } from "./helpers";

// S10B-04: layers (item 5, D-22). Everything and Relationships show the line; Mappings hides it.

test("S10B-04: the line shows in Everything and Relationships, not in Mappings", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  const layer = (name: string) => page.getByTestId("switch-layer").locator(`[data-layer="${name}"]`);
  await expect(sourceLines(page)).toHaveCount(1);
  for (const [name, count] of [["mappings", 0], ["relationships", 1], ["all", 1]] as const) {
    await layer(name).click();
    await expect(layer(name)).toHaveAttribute("aria-pressed", "true");
    await expect(sourceLines(page)).toHaveCount(count);
  }
});
