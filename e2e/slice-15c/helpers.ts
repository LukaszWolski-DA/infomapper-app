// Slice 15c's helpers: the star's dimensional mappings (their ids, their lines on the page, their rows in the e2e data
// file), a free point of a line to hover or click, a dimensional mapping's panel, and InfoCube's commands as test data
// through the composed store (the default store does not know InfoCube's tables).

import type { Locator, Page } from "@playwright/test";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { starId } from "../../src/modules/infocube/data/sales-star";
import type { CubeMapping, CubeMappingInput } from "../../src/modules/infocube/domain/types";
import { RETAIL, SEED_IDS } from "../slice-01a/helpers";
import { cubeStore } from "../slice-15a/helpers";

export * from "../slice-15b/helpers";
export { makeFrame, place } from "../slice-02b/helpers";
export { collapse } from "../slice-02c/helpers";
export { backButton, forwardButton } from "../slice-06b/helpers";

/** A star's dimensional mapping by its target: `sales.net_amount`, `cust.city` … */
export const cubeMappingId = (target: string) => starId(RETAIL, `cube-mapping:${target}`);

/** The dimensional lines in the line layer, and one by its mapping. */
export const cubeLines = (page: Page): Locator => page.getByTestId("layer-lines").locator('[data-testid="line-module"]');
export const cubeLine = (page: Page, mappingId: string): Locator => page.getByTestId("layer-lines").locator(`[data-testid="line-module"][data-ext="${mappingId}"]`);

/** The dimensional mapping's panel (step 4: its kind and trace). */
export const cubePanel = (page: Page): Locator => page.getByTestId("panel-cube-mapping");

/**
 * A point on the screen along one of a line's paths that no card covers (a line runs under the cards): its own hit
 * path is under it there. `path`: which input's path (0 the first).
 */
export async function freePoint(line: Locator, path = 0): Promise<{ x: number; y: number }> {
  return line.evaluate((g, n) => {
    const hit = g.querySelectorAll<SVGPathElement>("path.hit")[n]!;
    const len = hit.getTotalLength();
    const m = hit.getScreenCTM()!;
    for (let t = 0.5, step = 0; step < 40; step++, t = 0.5 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.0225) {
      const q = hit.getPointAtLength(len * t);
      const x = q.x * m.a + q.y * m.c + m.e, y = q.x * m.b + q.y * m.d + m.f;
      if (document.elementFromPoint(x, y) === hit) return { x, y };
    }
    throw new Error("no free point on the line");
  }, path);
}

/** Clicks a line where no card covers it; its panel shows. */
export async function clickCubeLine(page: Page, mappingId: string): Promise<void> {
  const p = await freePoint(cubeLine(page, mappingId));
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("panel-cube-mapping").and(page.locator(`[data-mapping="${mappingId}"]`)).waitFor();
}

/** InfoCube's live mapping rows in the e2e data file. */
export async function liveCubeMappings(): Promise<CubeMapping[]> {
  return (await cubeStore().modules.list(RETAIL, "cube_mapping")).filter((m) => m.deleted_at === null);
}
export async function liveCubeInputs(): Promise<CubeMappingInput[]> {
  return (await cubeStore().modules.list(RETAIL, "cube_mapping_input")).filter((i) => i.deleted_at === null);
}

/** A domain command as a person through the composed store (InfoCube's tables known): test data, applied at once. */
export async function asPersonOnCube<T>(userId: string, command: (ctx: CommandContext, access: WorkspaceAccess, store: ReturnType<typeof cubeStore>) => Promise<CommandResult<T>> | CommandResult<T>): Promise<T> {
  const s = cubeStore();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = await command(ctx, access, s);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** The mapping model a command reads, from the e2e data file. */
export async function mappingModel(s = cubeStore()) {
  const [model, cubeMappings, cubeMappingInputs] = await Promise.all([s.model.load(RETAIL), s.modules.list(RETAIL, "cube_mapping"), s.modules.list(RETAIL, "cube_mapping_input")]);
  return { entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs };
}

/** Test data: a dimensional mapping deleted elsewhere (as Łukasz, through the domain), so the page does not know. */
export async function deleteCubeMappingElsewhere(mappingId: string): Promise<void> {
  const { deleteCubeMapping } = await import("../../src/modules/infocube/domain/mappings");
  await asPersonOnCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const state = await mappingModel(s);
    const m = state.cubeMappings.find((x) => x.id === mappingId)!;
    return deleteCubeMapping(ctx, access, state, { mappingId, expectedVersion: m.version });
  });
}

/** The fading veil's key and how many cards it keeps lit (null: no fading). */
export async function veil(page: Page): Promise<{ key: string; litCards: number } | null> {
  const v = page.getByTestId("layer-fade");
  if (!(await v.count())) return null;
  return { key: (await v.getAttribute("data-fade")) ?? "", litCards: Number(await v.getAttribute("data-lit-cards")) };
}

/** Presses on an element's middle and moves the mouse past the drag's start, without releasing: a drag in progress. */
export async function startDrag(page: Page, from: Locator): Promise<{ x: number; y: number }> {
  const b = (await from.boundingBox())!;
  const start = { x: b.x + Math.min(40, b.width / 2), y: b.y + b.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(start.x + i * 5, start.y + i * 3);
  return start;
}
