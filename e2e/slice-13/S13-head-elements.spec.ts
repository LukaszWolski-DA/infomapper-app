// Slice 13, step 4 (Łukasz's question): where S3B-15's page total differs from slice 12b's. The same view as S3B-15's
// first one ("Performance test", 30 %, frames expanded), measurement build only; it writes what `<head>` holds (each
// child's tag and its src, href, rel or name, without query strings) and the counts of `<head>`, `<body>` and the
// canvas's viewport to test-results/S13-head-elements.json. Run it on both sides and compare the files:
//
//   MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-13/S13-head-elements.spec.ts
import fs from "node:fs";
import path from "node:path";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { expect, test } from "../slice-01a/fixtures";
import { canvasUrl, signInAs } from "../slice-01a/helpers";

test.use({
  channel: "chrome",
  headless: false,
  viewport: { width: 1536, height: 864 },
  launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
});

const OUT = path.resolve("test-results", "S13-head-elements.json");

test("S13 head elements: what <head> and <body> hold on Performance test at 30 %", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const zoom = 0.3;
  await page.goto("/sign-in");
  const view = { x: 768 - src57.x * zoom, y: 300 - src57.y * zoom, zoom };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  const read = await page.evaluate(() => {
    const strip = (v: string | null) => (v ? v.replace(/\?.*$/, "") : "");
    const head = [...document.head.querySelectorAll("*")].map((el) =>
      [el.tagName.toLowerCase(), strip(el.getAttribute("src")), strip(el.getAttribute("href")), el.getAttribute("rel") ?? "", el.getAttribute("name") ?? "", el.getAttribute("as") ?? ""].filter(Boolean).join(" "),
    );
    return {
      page: document.querySelectorAll("*").length,
      head: head.length,
      body: document.body.querySelectorAll("*").length,
      viewport: document.querySelectorAll(".react-flow__viewport *").length,
      headElements: head,
    };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(read, null, 2));
  console.log(`S13 head elements: page ${read.page}, head ${read.head}, body ${read.body}, viewport ${read.viewport}`);
});
