// Slice 10b, step 3: screenshots of D-62's drawing (runs only with SCREENS=<folder>, into
// docs/prd/slice-10b-screens/<folder>/). On "Order lines & products", where nothing lies between the cards: order_header
// placed left of order_line (the seeded key), and below them an HR import into ERP: employees with two keys to itself,
// two keys to departments (one missing after a re-import) and one back. Light mode, then dark mode.
//
//   SCREENS=step-3 npx playwright test e2e/slice-10b/S10B-screens.spec.ts

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import {
  approvedMapping,
  canvasUrl,
  clickCard,
  fade,
  freePointOn,
  importKeys,
  keysFile,
  loadModel,
  openCanvas,
  place,
  SEED_IDS,
  signInAs,
  sourceRelationshipId,
} from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-10b-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const CANVAS = SEED_IDS.canvasOrderLines;
const URL = canvasUrl(CANVAS, SEED_IDS.projOrderManagement);

test.use({ viewport: { width: 1536, height: 864 } });

/** employees with two keys to itself, two to departments (the second left out with `withHome: false`), one back. */
const hrFile = (withHome: boolean) =>
  keysFile([
    ["departments", "dept_id", "int", { pk: true }],
    ["departments", "head_id", "int", { fk: ["FK_departments_head", "employees", "emp_id"] }],
    ["employees", "emp_id", "int", { pk: true }],
    ["employees", "manager_id", "int", { fk: ["FK_employees_manager", "employees", "emp_id"] }],
    ["employees", "mentor_id", "int", { fk: ["FK_employees_mentor", "employees", "emp_id"] }],
    ["employees", "dept_id", "int", { fk: ["FK_employees_dept", "departments", "dept_id"] }],
    ["employees", "home_dept_id", "int", withHome ? { fk: ["FK_employees_home_dept", "departments", "dept_id"] } : {}],
  ]);

async function shot(page: Page, name: string) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  await page.getByTestId("area-canvas").screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function at(page: Page, view: { x: number; y: number; zoom: number }) {
  await openCanvas(page, URL, view);
  await page.waitForTimeout(800);
}

const notation = (page: Page, n: "ie" | "uml") => page.getByTestId("switch-notation").locator(`[data-notation="${n}"]`).click();

const TOP_100 = { x: 600, y: 40, zoom: 1 };
const HR_100 = { x: 600, y: -620, zoom: 1 };
const ALL_30 = { x: 330, y: 60, zoom: 0.3 };

test("S10B screens: D-62's drawing", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  // the seeded key: order_header left of order_line, nothing between them
  await place("order_header", { x: -520, y: 40 }, CANVAS);
  // HR: two tables side by side below
  await importKeys(hrFile(true));
  await importKeys(hrFile(false), "hr-2.csv");
  await place("employees", { x: -520, y: 720 }, CANVAS);
  await place("departments", { x: 40, y: 720 }, CANVAS);
  // Order Line also reads order_header (Focus with both tables lit)
  const model = await loadModel();
  const header = model.sourceTables.find((t) => t.name === "order_header")!;
  const line = model.entities.find((e) => e.name === "Order Line")!;
  await approvedMapping(
    model.attributes.find((a) => a.entity_id === line.id && a.name === "order_id")!.id,
    model.sourceColumns.find((c) => c.source_table_id === header.id && c.name === "ord_id")!.id,
  );

  await signInAs(page, "Łukasz");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const s = scheme === "dark" ? "-dark" : "";
    for (const n of ["ie", "uml"] as const) {
      await at(page, TOP_100);
      await notation(page, n);
      await shot(page, `line-100-${n}${s}`);
      await at(page, ALL_30);
      await shot(page, `line-30-${n}${s}`);
    }
    await notation(page, "ie");
    // missing (dashed, the arrow solid), two keys between the same tables, the loops
    await at(page, HR_100);
    await shot(page, `keys-missing-loops${s}`);
    if (scheme === "dark") continue;

    // hover
    await at(page, TOP_100);
    const id = await sourceRelationshipId("FK_order_line_order_header");
    const p = await freePointOn(page, id, 0.3);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(400);
    await page.getByTestId("area-canvas").screenshot({ path: path.join(OUT, "hover.png") });

    // Focus: Order Line (both tables lit), then order_line alone (only one)
    await clickCard(page, "Order Line");
    await page.getByTestId("button-focus").click();
    await expect(page.getByTestId("layer-fade")).toBeAttached();
    await shot(page, "focus-both-lit");
    await clickCard(page, "order_line");
    await expect(page.getByTestId("layer-lit-lines").getByTestId("lit-source")).toHaveCount(0);
    await shot(page, "focus-one-lit");
    await fade(page, null);

    // a mapping selected: the other lines fade, the source line's arrow with it
    await at(page, TOP_100);
    // a point of a mapping line that is not under a card
    const m = await page.evaluate(() => {
      for (const path of document.querySelectorAll<SVGPathElement>('[data-testid="layer-lines"] [data-testid="line-mapping"] path.s')) {
        const g = path.closest("[data-mapping]"), tm = path.getScreenCTM()!, len = path.getTotalLength();
        for (let l = len * 0.1; l < len * 0.9; l += 4) {
          const p = path.getPointAtLength(l), x = p.x * tm.a + tm.e, y = p.y * tm.d + tm.f;
          if (document.elementFromPoint(x, y)?.closest("[data-mapping]") === g) return { x, y };
        }
      }
      throw new Error("no free point on a mapping line");
    });
    await page.mouse.click(m.x, m.y);
    await expect(page.getByTestId("layer-lines")).toHaveClass(/dimmed/);
    await shot(page, "mapping-selected");
  }
});
