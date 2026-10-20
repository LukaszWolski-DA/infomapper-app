// S4B2-15's reads (slice 4b-2, section 6; measurement build only, no timing, no laptop preparation): drawing layers
// (CDP LayerTree, with the reasons of every layer composited by overlap), their megapixels and the elements in the
// viewport, at 30 % around ent:23 and in S1A-14's 100 % dense view, frames expanded and collapsed. On “100 cards” (no
// requirement cards; both sides) and, on this branch, “Performance test – requirements” (12 cards, placed by item 15's
// rule, which keeps frames clear), and the worst case by hand: REQ-102's card, then all nine cards of the 30 % view,
// moved over frame f4 (written to the data file before the page opens; a read only). Self-contained, so it runs in the
// `slice-04b1` worktree too (copy it there). Results in test-results/S4B2-15-layers.json.

import fs from "node:fs";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl } from "../slice-01a/helpers";
import { MEASURE_USE, saveResults } from "../slice-01b/measure";
import { signInAs } from "../slice-04a/helpers";

test.use(MEASURE_USE);

const REQUIREMENTS_CANVAS = (LARGE_IDS as Record<string, string>).canvasRequirements;

type L = { layerId: string; backendNodeId?: number; width: number; height: number; drawsContent: boolean };

async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("DOM.enable");
  await cdp.send("DOM.getDocument", { depth: 0 });
  await cdp.send("LayerTree.enable");
  await page.evaluate(() => document.body.style.setProperty("--im-diag", String(Math.random())));
  await page.waitForTimeout(1500);
  const drawing = list.filter((l) => l.drawsContent);
  const overlap: string[] = [];
  for (const l of drawing) {
    const reasons: string[] = ((await cdp.send("LayerTree.compositingReasons", { layerId: l.layerId }).catch(() => ({}))).compositingReasonIds ?? []) as string[];
    if (!reasons.some((r) => /overlap/i.test(r))) continue;
    let owner = "(no node)";
    if (l.backendNodeId) {
      const d = await cdp.send("DOM.describeNode", { backendNodeId: l.backendNodeId }).catch(() => null);
      const a: string[] = d?.node?.attributes ?? [];
      const cls = a.includes("class") ? a[a.indexOf("class") + 1]!.split(" ").slice(0, 2).join(".") : "";
      const tid = a.includes("data-testid") ? `#${a[a.indexOf("data-testid") + 1]}` : "";
      owner = `${d?.node?.localName ?? "?"}.${cls}${tid}`;
    }
    overlap.push(`${owner} ${Math.round(l.width)}x${Math.round(l.height)} [${reasons.join(",")}]`);
  }
  await cdp.send("LayerTree.disable");
  await cdp.detach();
  return {
    drawingLayers: drawing.length,
    drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1),
    viewportElements: await page.evaluate(() => document.querySelectorAll(".react-flow__viewport *").length),
    requirementCards: await page.locator('[data-testid="card-requirement"]').count(),
    traceLines: await page.locator('[data-testid="line-trace"]').count(),
    overlap,
  };
}

async function open(page: Page, canvasId: string, view: { x: number; y: number; zoom: number }, collapsed: boolean) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${canvasId}`, JSON.stringify(view)] as const);
  const url = canvasUrl(canvasId, LARGE_IDS.project, LARGE_IDS.workspace);
  await page.goto(collapsed ? `${url}?diag=collapsed` : url);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(2000);
}

/** Diagnosis data: requirement cards of the requirements canvas moved in the data file. */
function moveCards(moves: { requirementKey: string; x: number; y: number }[]) {
  const db = JSON.parse(fs.readFileSync(E2E_DB, "utf8"));
  const ws = LARGE_IDS.workspace;
  for (const m of moves) {
    const r = db.requirement.find((x: { workspace_id: string; key: string }) => x.workspace_id === ws && x.key === m.requirementKey);
    const item = db.canvas_item.find((i: { canvas_id: string; requirement_id: string | null }) => i.canvas_id === REQUIREMENTS_CANVAS && i.requirement_id === r.id);
    Object.assign(item, { x: m.x, y: m.y });
  }
  fs.writeFileSync(E2E_DB, JSON.stringify(db));
}

test("S4B2-15: drawing layers and viewport elements with and without requirement cards, and cards over a frame (worst case)", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(20 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, LARGE_IDS.canvas, { x: 0, y: 0, zoom: 1 }, false);
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  const around = { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 };
  const dense = { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 };
  const views = {
    "30 % around ent:23, expanded": { view: around, collapsed: false },
    "100 % dense, expanded": { view: dense, collapsed: false },
    "30 % around ent:23, collapsed": { view: around, collapsed: true },
    "100 % dense, collapsed": { view: dense, collapsed: true },
  };
  const out: Record<string, Record<string, unknown>> = {};
  const canvases: Record<string, string> = { "100 cards": LARGE_IDS.canvas, ...(REQUIREMENTS_CANVAS ? { "– requirements": REQUIREMENTS_CANVAS } : {}) };
  for (const [canvasName, canvasId] of Object.entries(canvases)) {
    out[canvasName] = {};
    for (const [name, v] of Object.entries(views)) {
      await open(page, canvasId, v.view, v.collapsed);
      out[canvasName]![name] = await layers(page);
    }
  }
  if (REQUIREMENTS_CANVAS) {
    // the worst case by hand: cards over frame f4 (ent:4, ent:7 and ent:19's frame), at 30 %, frames expanded
    const f4 = data.frames.find((f) => f.id === "f4")!;
    out["– requirements, cards over a frame"] = {};
    moveCards([{ requirementKey: "REQ-102", x: f4.x + 520, y: f4.y + 1100 }]);
    await open(page, REQUIREMENTS_CANVAS, around, false);
    const at102 = await page.evaluate(() => (document.querySelector('[data-testid="card-requirement"][data-key="REQ-102"]')?.closest(".react-flow__node") as HTMLElement | null)?.style.transform ?? null);
    out["– requirements, cards over a frame"]!["REQ-102's card over f4"] = { ...(await layers(page)), at102, expected: [f4.x + 520, f4.y + 1100] };
    const nine = ["REQ-101", "REQ-102", "REQ-104", "REQ-105", "REQ-106", "REQ-107", "REQ-108", "REQ-109", "REQ-112"];
    moveCards(nine.map((key, i) => ({ requirementKey: key, x: f4.x + 40 + (i % 3) * 400, y: f4.y + 900 + Math.floor(i / 3) * 200 })));
    await open(page, REQUIREMENTS_CANVAS, around, false);
    out["– requirements, cards over a frame"]!["all nine cards of the view over f4"] = await layers(page);
  }
  saveResults("S4B2-15-layers", { browser: browser.version(), pane, reads: out });
});
