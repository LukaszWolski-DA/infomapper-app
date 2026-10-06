// Shared steps for slice 1b: slice 1a's helpers (open a canvas at a view, read the model, find cards, rows and
// lines), plus a column dragged onto an entity card with a real mouse, the right-click toolbox, a point on a line,
// and test data made through the domain.

import { expect, type Locator, type Page } from "@playwright/test";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { box, card, loadModel, RETAIL, SEED_IDS, store } from "../slice-01a/helpers";

export * from "../slice-01a/helpers";

/** A view of Customer & orders at 100% with the source tables on the left and Customer in view. */
export const LEFT_AT_100 = { x: 0, y: 0, zoom: 1 };

/** A row of a card by the row's name. */
export const rowNamed = (page: Page, cardName: string, rowName: string) =>
  card(page, cardName).locator(".row[data-row]").filter({ has: page.locator(`.nm[title="${rowName}"]`) });

/** Ids from the demo model by name. */
export async function ids() {
  const model = await loadModel();
  const entity = (name: string) => model.entities.find((e) => e.name === name)!;
  const table = (name: string) => model.sourceTables.find((t) => t.name === name)!;
  return {
    model,
    entity,
    table,
    attribute: (entityName: string, name: string) => model.attributes.find((a) => a.entity_id === entity(entityName).id && a.name === name)!,
    column: (tableName: string, name: string) => model.sourceColumns.find((c) => c.source_table_id === table(tableName).id && c.name === name)!,
  };
}

/** Drags with a real mouse in small steps from one element's middle to a point on another (default: its middle). */
export async function dragTo(page: Page, from: Locator, to: Locator, at?: { x: number; y: number }) {
  const a = await box(from), b = await box(to);
  const start = { x: a.x + Math.min(40, a.width / 2), y: a.y + a.height / 2 };
  const end = at ? { x: b.x + at.x, y: b.y + at.y } : { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(start.x + ((end.x - start.x) * i) / 12, start.y + ((end.y - start.y) * i) / 12);
  await page.mouse.up();
}

/** Opens the toolbox with a right-click at a point and returns the labels of its actions (without shortcuts). */
export async function toolboxAt(page: Page, point: { x: number; y: number }): Promise<string[]> {
  await page.mouse.click(point.x, point.y, { button: "right" });
  const menu = page.getByTestId("menu-toolbox");
  await expect(menu).toBeVisible();
  return menu.locator('[data-testid="toolbox-item"] span.min-w-0').allInnerTexts();
}

export async function closeToolbox(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("menu-toolbox")).toHaveCount(0);
}

/** A point on the screen along a line's first drawn path (`at`: 0 start, 1 end; a relationship's label is in the middle). */
export async function pointOnLine(line: Locator, at = 0.5): Promise<{ x: number; y: number }> {
  return line
    .locator("path.s")
    .first()
    .evaluate((p, at) => {
      const path = p as SVGPathElement;
      const m = path.getScreenCTM()!;
      const q = path.getPointAtLength(path.getTotalLength() * at);
      return { x: q.x * m.a + q.y * m.c + m.e, y: q.x * m.b + q.y * m.d + m.f };
    }, at);
}

/** A point on the empty canvas: the pane itself is under it (no card, line or panel), searched on a grid. */
export async function emptySpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane")!;
    const r = pane.getBoundingClientRect();
    for (let y = r.top + 40; y < r.bottom - 40; y += 24) {
      for (let x = r.right - 40; x > r.left + 40; x -= 24) {
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    return null;
  });
  expect(spot, "an empty spot on the canvas").not.toBeNull();
  return spot!;
}

/** Runs a domain command as a person, through the e2e data file (test data only). */
export async function asUser<T>(
  userId: string,
  command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>,
): Promise<T> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = command(ctx, access);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

export const asLukasz = <T>(command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>) => asUser(SEED_IDS.userLukasz, command);
