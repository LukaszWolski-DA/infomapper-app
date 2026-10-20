// Slice 4b-2's measuring steps on “Performance test – requirements” (PRD item 26), shared by S4B2-11 to S4B2-13 (this
// branch only; S4B2-10 keeps its own copy, because it also runs in the `slice-04b1` worktree). Measurement build only.

import { generate } from "../../src/data/local/large-generator";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { seedId } from "../../src/data/local/seed-model";
import { canvasUrl } from "../slice-01a/helpers";
import { MEASURE } from "../slice-01b/measure";
import { expect, type Page } from "./fixtures";

export const REQ_CANVAS = LARGE_IDS.canvasRequirements;
export const REQ_URL = canvasUrl(REQ_CANVAS, LARGE_IDS.project, LARGE_IDS.workspace);
const WS = LARGE_IDS.workspace;
export const entityId = (card: string) => seedId(WS, `entity:${card}`);
export const requirementId = (key: string) => seedId(WS, `requirement:${key}`);

export type View = { x: number; y: number; zoom: number };

/** Opens the requirements canvas at a view (pane coordinates), frames expanded or all collapsed, and lets it settle. */
export async function openReq(page: Page, view: View, collapsed = false) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${REQ_CANVAS}`, JSON.stringify(view)] as const);
  await page.goto(collapsed ? `${REQ_URL}?diag=collapsed` : REQ_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

/** The pane's size (the measuring window: 932 × 740 with both panels open). */
export const paneSize = (page: Page) => page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));

/** A view with a canvas point in the pane's middle. */
export const centredOn = (pane: { w: number; h: number }, x: number, y: number, zoom: number): View => ({ x: pane.w / 2 - x * zoom, y: pane.h / 2 - y * zoom, zoom });

/** ent:23's views (S4P-fading's): its middle, 200 px down. */
export function aroundEnt23(pane: { w: number; h: number }, zoom: number): View {
  const c = generate().cards.find((x) => x.id === "ent:23")!;
  return centredOn(pane, c.x + c.w / 2, c.y + 200, zoom);
}

/** Switches fading with the measuring hook and waits until the page shows it (or none). */
export const fade = (page: Page, request: unknown, key: string) =>
  page.evaluate(
    async ([request, key]) => {
      (window as unknown as { __imFade: (r: unknown) => void }).__imFade(request);
      const t0 = performance.now();
      const shown = () => (key ? !!document.querySelector(`[data-testid="layer-fade"][data-fade="${key}"]`) : !document.querySelector('[data-testid="layer-fade"]'));
      while (!shown() && performance.now() - t0 < 5000) await new Promise((res) => setTimeout(res, 10));
      return shown();
    },
    [request, key] as const,
  );

/** A Focus request and its key (`fadeKey`). */
export const focusEntity = (card: string) => ({ request: { focus: entityId(card) }, key: `focus:${entityId(card)}` });
export const focusRequirement = (key: string) => ({ request: { focus: { t: "requirement", id: requirementId(key) } }, key: `focus:requirement:${requirementId(key)}` });
