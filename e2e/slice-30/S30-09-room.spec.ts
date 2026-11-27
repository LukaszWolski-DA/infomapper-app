// S30-09 (slice 30, Q6's table): the top bar's room as the prototype: the brand from 1,601 px, the user's role and the
// badge's full label from 1,501 px (the short label below). Slice 38 (F15): the Hand, Entity, Note and Frame tools are
// in the canvas toolbar, icons only at every width (the prototype's `#ctb`), their names in `aria-label`.
// S6A-10 checks again that nothing is cut off from 800 to 2,560 px with the pair in the bar.
import { expect, test } from "./fixtures";
import { badge, canvasUrl, FULL, openCanvas, signInAs } from "./helpers";

const NAMES: Record<string, string> = { hand: "Hand tool (H)", entity: "Entity tool (E)", note: "Note tool (N)", frame: "Frame tool (A)" };

test("S30-09 (room): the tools icons only, the brand from 1,601 px, the role and the badge's label from 1,501 px", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.setViewportSize({ width: 2101, height: 900 });
  await openCanvas(page, canvasUrl(), FULL);
  for (const [tool, name] of Object.entries(NAMES)) {
    await expect(page.getByTestId(`button-tool-${tool}`)).toHaveText("");
    await expect(page.getByTestId(`button-tool-${tool}`)).toHaveAttribute("aria-label", name);
  }

  const brand = page.getByTestId("bar-top").getByText("InfoMapper", { exact: true });
  await page.setViewportSize({ width: 1601, height: 900 });
  await expect(brand).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(brand).toBeHidden();

  const role = page.getByTestId("indicator-user-role");
  await page.setViewportSize({ width: 1501, height: 900 });
  await expect(role).toBeVisible();
  await expect(badge(page).locator("span").first()).toBeVisible();
  await page.setViewportSize({ width: 1500, height: 900 });
  await expect(role).toBeHidden();
  await expect(badge(page).locator("span").first()).toBeHidden();
  await expect(badge(page).locator("span").nth(1)).toBeVisible();
  await expect(badge(page)).toBeVisible();
});
