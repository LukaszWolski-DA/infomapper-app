import { expect, test } from "./fixtures";
import { AROUND, collapse, collapsedFrame, item, openCanvas, signInAs, sourceLines } from "./helpers";

// S10B-05: collapsed frames (item 6, D-07; F3). With an unrelated frame collapsed (Customer only), the line is still
// drawn. With order_header's card in a collapsed frame there is no line, and no bundle stands for it: the frame around
// the three tables on the left holds no entity, so no relationship bundle may appear, and no bundle ends at order_line's
// card.

test("S10B-05: drawn with an unrelated frame collapsed; no line and no bundle with a card in a collapsed frame", async ({ page }) => {
  const unrelated = await collapsedFrame(AROUND.customer, { name: "Unrelated" });
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await expect(page.getByTestId("block")).toHaveCount(1);
  await expect(sourceLines(page)).toHaveCount(1);

  await collapse(unrelated, false);
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  const ordline = (await item("order_line")).id;
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("block")).toHaveCount(1);
  await expect(sourceLines(page)).toHaveCount(0);
  await expect(page.locator(".lnk.rel.bundle")).toHaveCount(0);
  const keys = await page.getByTestId("line-bundle").evaluateAll((els) => els.map((e) => e.getAttribute("data-bundle") ?? ""));
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter((k) => k.includes(`e:${ordline}`))).toEqual([]);
});
