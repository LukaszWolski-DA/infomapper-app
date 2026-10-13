// S3B-15 is measured (docs/prd/slice-03b-acceptance.md): (a) S3B-15-elements.spec.ts, (b) a balanced `measure:canvas`
// sitting, (c) S3B-15-live.spec.ts, all in the measurement build. This spec checks the data (c) measures: `seed:large`
// gives “Performance test” the live canvas of PERF-2, made by the domain as “Open as live canvas” makes it, and the
// canvas draws it. S3B-15-idle.spec.ts is (d)'s idle guard on a live canvas.

import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS, LARGE_LIVE_LABEL } from "../../src/data/local/seed-large";
import { liveMembership } from "../../src/domain/model/live";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { canvasUrl, openCanvas, signInAs, store } from "./helpers";

test("S3B-15 (data): “Performance test” has the live canvas of PERF-2: exactly what PERF-2 marks, full and context cards with their filters, in frames, drawn on the canvas", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLargeData(E2E_DB);
  const ws = LARGE_IDS.workspace;
  const label = (await store().labels.list(ws)).find((l) => l.name === LARGE_LIVE_LABEL)!;
  const live = (await store().canvases.list(ws)).find((c) => c.live_label_id === label.id)!;
  expect(live.name).toBe("PERF-2");
  const items = await store().canvasItems.listOfCanvas(ws, live.id);
  const membership = liveMembership(label.id, { ...(await store().model.load(ws)), links: await store().labels.listLinks(ws) });
  expect(items).toHaveLength(membership.entities.size + membership.tables.size);
  expect(items).toHaveLength(22);
  for (const i of items) {
    const level = i.entity_id ? membership.entities.get(i.entity_id) : membership.tables.get(i.source_table_id!);
    expect([i.live_level, i.row_filter, !!i.frame_id]).toEqual([level, level === "full" ? "all" : "labeled", true]);
  }

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(live.id, LARGE_IDS.project, ws), { x: 20, y: 20, zoom: 0.3 });
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator("[data-card]")).toHaveCount(22);
  await expect(page.locator("[data-card][data-live=context]")).toHaveCount(items.filter((i) => i.live_level === "context").length);
  await expect(page.getByTestId("tab-canvas-live")).toHaveCount(1);
});
