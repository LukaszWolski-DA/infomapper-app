// Slice 10a, step 4: screenshots of the loop for D-61's drawing (runs only with SCREENS=<folder>, into
// docs/prd/slice-10a-screens/<folder>/). On “Customer & orders”, with a self-relationship on Customer ("refers"):
// crow's foot and UML at 100 % and at 30 %; Customer collapsed; two nested loops; the loop selected with its panel; the
// loop lit in Focus on Customer, and in Focus on the loop with the other lines faded.

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, expectSelected, openCanvas, relationshipLine, selfRelationship, setCard, signInAs } from "./helpers";
import { pointOnLine } from "../slice-01b/helpers";

const OUT = path.resolve("docs", "prd", "slice-10a-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const AT_100 = { x: -260, y: 140, zoom: 1 };
const AT_30 = { x: 260, y: 160, zoom: 0.3 };

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

const notation = (page: Page, n: "ie" | "uml") => page.getByTestId("switch-notation").locator(`[data-notation="${n}"]`).click();

test("S10A-08 screenshots: the loop in both notations at 100 % and 30 %, collapsed, nested, selected, in Focus", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (name: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  };
  const rel = await selfRelationship("Customer", { label: "refers" });
  await signInAs(page, "Łukasz");

  for (const n of ["ie", "uml"] as const) {
    await openCanvas(page, canvasUrl(), AT_100);
    await notation(page, n);
    await expect(relationshipLine(page, rel.id)).toHaveCount(1);
    await shot(`loop-${n}-100`);
    await openCanvas(page, canvasUrl(), AT_30);
    await shot(`loop-${n}-30`);
  }
  await openCanvas(page, canvasUrl(), AT_100);
  await notation(page, "ie");

  // Customer collapsed
  await setCard("Customer", { collapsed: true });
  await openCanvas(page, canvasUrl(), AT_100);
  await shot("loop-collapsed-card");
  await setCard("Customer", { collapsed: false });

  // two nested loops
  await selfRelationship("Customer", { label: "replaces" });
  await openCanvas(page, canvasUrl(), AT_100);
  await shot("loops-nested");

  // the first loop selected, its panel open
  const at = await pointOnLine(relationshipLine(page, rel.id), 0.5);
  await page.mouse.click(at.x, at.y);
  await expectSelected(page, "relationship");
  await shot("loop-selected-panel");

  // Focus on Customer: its loops lit, the other lines faded
  const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await page.mouse.click(head.x + 30, head.y + head.height / 2, { button: "right" });
  await page.getByTestId("toolbox-focus").click();
  await expect(page.getByTestId("layer-lit-lines").locator(`[data-relationship="${rel.id}"]`)).toHaveCount(1);
  await shot("loop-focus-entity");

  // Focus on the loop itself: the loop and Customer lit, every other line faded
  await page.getByTestId("button-focus").click(); // off
  await openCanvas(page, canvasUrl(), { x: -40, y: 120, zoom: 0.8 });
  const on = await pointOnLine(relationshipLine(page, rel.id), 0.5);
  await page.mouse.click(on.x, on.y);
  await expectSelected(page, "relationship");
  await page.getByTestId("button-focus").click();
  await expect(page.getByTestId("layer-lit-lines").locator(`[data-relationship="${rel.id}"]`)).toHaveCount(1);
  await shot("loop-focus-loop");
});
