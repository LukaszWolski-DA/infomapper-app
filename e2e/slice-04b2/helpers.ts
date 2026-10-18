// Slice 4b-2's e2e helpers: requirement cards on the page and in the data, and placing them as test data through the
// domain.

import type { Page } from "@playwright/test";
import { placeRequirementCards } from "../../src/domain/commands/canvas-item";
import { linkRequirement } from "../../src/domain/commands/requirement";
import { asLukasz, loadRequirementCards, loadRequirements, RETAIL, SEED_IDS, store } from "../slice-04b1/helpers";

export * from "../slice-04b1/helpers";

/** A requirement's card on the page, by its key. */
export const reqCard = (page: Page, key: string) => page.locator(`[data-testid="card-requirement"][data-key="${key}"]`);
/** Its React Flow node (the wrapper that carries the position). */
export const reqNode = (page: Page, key: string) => page.locator(".react-flow__node-req").filter({ has: reqCard(page, key) });

/** Test data: requirements' cards placed on a canvas by Łukasz through the domain, at canvas points. */
export async function placeReqCards(cards: { key: string; x: number; y: number }[], canvasId: string = SEED_IDS.canvasCustomerOrders): Promise<void> {
  const requirements = await loadRequirements();
  const items = await store().canvasItems.listOfCanvas(RETAIL, canvasId);
  const canvas = await store().canvases.get(RETAIL, canvasId);
  await asLukasz((ctx, access) =>
    placeRequirementCards(ctx, access, { canvas, requirements, items }, {
      canvasId,
      cards: cards.map((c) => ({ requirementId: requirements.find((r) => r.key === c.key)!.id, x: c.x, y: c.y })),
    }),
  );
}

/** A requirement's live card on a canvas in the data file, by key (undefined without one). */
export async function reqCardData(key: string, canvasId: string = SEED_IDS.canvasCustomerOrders) {
  const r = (await loadRequirements()).find((x) => x.key === key)!;
  return (await loadRequirementCards(RETAIL, canvasId)).find((i) => i.requirement_id === r.id);
}

/** Test data: a requirement linked to an element by Łukasz through the domain. */
export async function linkReq(key: string, target: { kind: "entity" | "attribute" | "mapping" | "source_table" | "source_column"; id: string }): Promise<void> {
  const [requirements, links, model] = await Promise.all([loadRequirements(), store().requirements.listLinks(RETAIL), store().model.load(RETAIL)]);
  const requirement = requirements.find((r) => r.key === key)!;
  await asLukasz((ctx, access) => linkRequirement(ctx, access, { requirement, links, ...model }, { requirementId: requirement.id, target }));
}

/** A trace line's two ends on the screen (its path's start and end). */
export const traceEnds = (line: import("@playwright/test").Locator) =>
  line.evaluate((p) => {
    const path = p as SVGPathElement;
    const m = path.getScreenCTM()!;
    const at = (q: DOMPoint) => ({ x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f });
    return { start: at(path.getPointAtLength(0)), end: at(path.getPointAtLength(path.getTotalLength())) };
  });

/** A requirement card's trace lines on the page. */
export const tracesOfCard = async (page: Page, key: string) => {
  const id = await reqCard(page, key).getAttribute("data-card");
  return page.locator(`[data-testid="line-trace"][data-trace^="${id}|"]`);
};
