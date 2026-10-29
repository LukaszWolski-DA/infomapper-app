import { expect, test } from "./fixtures";
import { canvasUrl, openCanvas, signInAs } from "./helpers";
import { canvasCommits, expectZoom, typeZoom, zoomField } from "./zoom";

// Performance of the zoom field (section 6, item 22), in the development build: typing in it adds no canvas commit
// (`window.__imCanvasCommits`); applying a typed zoom adds as many commits as + to the same zoom. The element guard's
// viewport counts against slice-08 and the top bar's widths are measured apart (S3B-15-elements with
// ELEMENTS_BASELINE, S6A-10).

/** The commit counter once it has not moved for half a second. */
async function settled(page: import("@playwright/test").Page): Promise<number> {
  let last = -1;
  for (;;) {
    const now = await canvasCommits(page);
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(500);
  }
}

test("S9-14: typing in the zoom field adds no canvas commit; applying adds as many as + to the same zoom", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await expectZoom(page, 100);

  const start = await settled(page);
  expect(start).toBeGreaterThan(0); // the development counter is there
  await zoomField(page).click();
  await page.keyboard.type("120");
  await expect(zoomField(page)).toHaveValue("120");
  expect(await settled(page)).toBe(start);
  await page.keyboard.press("Enter");
  await expectZoom(page, 120);
  const typed = (await settled(page)) - start;

  await typeZoom(page, "100");
  await expectZoom(page, 100);
  const before = await settled(page);
  await page.getByTestId("button-zoom-in").click();
  await expectZoom(page, 120);
  const plus = (await settled(page)) - before;

  // across 40 %, where the cards draw their plain blocks (AD-24 rule 1): a typed 38 % against − from 45 % (37.5 %)
  await typeZoom(page, "45");
  await expectZoom(page, 45);
  const from45 = await settled(page);
  await typeZoom(page, "38");
  await expectZoom(page, 38);
  const typedBelow = (await settled(page)) - from45;
  await typeZoom(page, "45");
  await expectZoom(page, 45);
  const again45 = await settled(page);
  await page.getByTestId("button-zoom-out").click();
  await expectZoom(page, 38);
  const minusBelow = (await settled(page)) - again45;

  console.log(`S9-14 canvas commits: typing 0; 100 to 120 %: typed ${typed}, + ${plus}; 45 to 38 %: typed ${typedBelow}, − ${minusBelow}`);
  expect(typed).toBe(plus);
  expect(typedBelow).toBe(minusBelow);
  expect(typedBelow).toBeGreaterThan(0);
});
