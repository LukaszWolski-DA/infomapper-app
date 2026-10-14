// Screenshots for S4P-04 (slice 4p): the app beside the prototype, on “Customer & orders”, for Łukasz to judge. Not a
// check: it only writes PNGs to docs/prd/slice-04p-screens/<SCREENS>/. Runs only when asked (the normal run leaves it
// out), e.g. on trial A's branch:
//
//   SCREENS=step-1-trial-a npx playwright test e2e/slice-04p/S4P-04-screens.spec.ts
//
// Step 1 (trial A): the hover at 100 % (on the row Customer.email) and at 30 % (below 40 % the app draws no rows, so on
// the mapping line customers.email_addr → Customer.email), frames expanded.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "../slice-02c/fixtures";
import { canvasUrl, mappingId, openCanvas, rowNamed, signInAs } from "../slice-02c/helpers";

const OUT = path.resolve("docs", "prd", "slice-04p-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-model-prototype.html")).href;
const VIEWS = { "100": { x: 0, y: 0, zoom: 1 }, "30": { x: 40, y: 40, zoom: 0.3 } } as const;

test.use({ viewport: { width: 1536, height: 864 } });

/** The middle of a path on the screen. */
const middleOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const p = el as SVGPathElement;
    const pt = p.getPointAtLength(p.getTotalLength() / 2);
    const m = p.getScreenCTM()!;
    return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
  });

async function prototypeAt(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(800);
  // it may open on its workspace home: open “Customer & orders” as its own home page's tile would
  await page.evaluate(() => (0, eval)("openCanvasFromHome")("dia_main"));
  await page.waitForTimeout(300);
  await page.evaluate((v) => {
    const V = (0, eval)("V") as { zoom: number; px: number; py: number };
    V.zoom = v.zoom;
    V.px = v.x;
    V.py = v.y;
    (0, eval)("applyT")();
  }, view);
  await page.waitForTimeout(300);
}

test("S4P-04 screenshots: the hover at 100 % and 30 %, app and prototype", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await signInAs(page, "Łukasz");
  const map = await mappingId("customers.email_addr", "Customer.email");

  // the app at 100 %: the row Customer.email
  await openCanvas(page, canvasUrl(), VIEWS["100"]);
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  await expect(page.getByTestId("hover-row")).toHaveCount(3);
  await shot("hover-100-app");
  // the app at 30 %: the line customers.email_addr → Customer.email
  await page.mouse.move(5, 5);
  await openCanvas(page, canvasUrl(), VIEWS["30"]);
  const mid = await middleOf(page, `[data-testid="line-mapping"][data-mapping="${map}"] path.s`);
  await page.mouse.move(mid.x, mid.y);
  await expect(page.getByTestId("layer-hover-lines")).toHaveCount(1);
  await shot("hover-30-app");

  // the prototype, same views (its own demo model, the same cards)
  await prototypeAt(page, VIEWS["100"]);
  const protoRow = page.locator('.card[data-id="lent_customer"] .row', { hasText: /^\s*email/ }).first();
  const pr = (await protoRow.boundingBox())!;
  await page.mouse.move(pr.x + 40, pr.y + pr.height / 2);
  await page.waitForTimeout(300);
  await shot("hover-100-prototype");
  await prototypeAt(page, VIEWS["30"]);
  const protoMap = await page.evaluate(() => {
    const S = (0, eval)("S") as { mappings: { id: string; columnId: string; attributeId: string }[] };
    return S.mappings.find((m) => m.columnId === "src_customers__email_addr" && m.attributeId === "latr_customer_email")?.id ?? null;
  });
  expect(protoMap).not.toBeNull();
  const pm = await middleOf(page, `g.lnk[data-t="map"][data-id="${protoMap}"] path.s`);
  await page.mouse.move(pm.x, pm.y);
  await page.waitForTimeout(300);
  await shot("hover-30-prototype");
});
