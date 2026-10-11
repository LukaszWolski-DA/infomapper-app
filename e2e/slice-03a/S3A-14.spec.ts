// S3A-14 is a measurement round (docs/prd/slice-03a-acceptance.md): `npm run measure:canvas` against slice-02c, with
// the labels and notes that `seed:large` adds to “Performance test”. This spec checks that data part: what the round
// measures is on the canvas. S3A-14-idle.spec.ts guards the canvas while idle with notes below 40 % zoom.

import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { LARGE_URL } from "../slice-01b/measure";
import { expect, test } from "./fixtures";
import { openCanvas, signInAs, store } from "./helpers";

test("S3A-14 (data): “Performance test” carries at least 20 notes, half of them pinned, and labels on 50 rows and 30 mappings, and the canvas draws them", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLargeData(E2E_DB);
  const ws = LARGE_IDS.workspace;
  const notes = await store().notes.listOfCanvas(ws, LARGE_IDS.canvas);
  const links = await store().labels.listLinks(ws);
  expect(notes.length).toBeGreaterThanOrEqual(20);
  expect(notes.filter((n) => n.pin_canvas_item_id || n.pin_frame_id)).toHaveLength(notes.length / 2);
  expect(links.filter((k) => k.attribute_id || k.source_column_id)).toHaveLength(50);
  expect(links.filter((k) => k.mapping_id)).toHaveLength(30);

  // at 100 % on the top left: notes, row marks and line tags are drawn
  await signInAs(page, "Łukasz");
  await openCanvas(page, LARGE_URL, { x: 40, y: 80, zoom: 1 });
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.getByTestId("note")).toHaveCount(notes.length);
  await expect(page.locator(".row[data-row] [data-testid=mark-label]").first()).toBeVisible();
  expect(await page.getByTestId("mark-label-line").count()).toBeGreaterThan(0);
});
