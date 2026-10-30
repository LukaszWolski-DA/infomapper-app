// Slice 10b's steps: relationships between source tables as lines on the canvas (D-62). Step 2: the lines on the page
// (`sourceLine`, their ends on the screen with `sourceShape`), a key imported into ERP as test data (`importKeys`,
// `employeesFile`), and a card's width as test data (`setWidth`).

import { expect, type Locator, type Page } from "@playwright/test";
import { moveOnCanvas } from "../../src/domain/commands/frame";
import { loadItems, loadModel, SEED_IDS, store } from "../slice-01a/helpers";
import { asLukasz } from "../slice-01b/helpers";
import { item } from "../slice-02b/helpers";
import { importAs } from "../slice-07b/helpers";
import { HEAD } from "../slice-07c/helpers";

export { canvasUrl, card, loadModel, openCanvas, RETAIL, SEED_IDS, signInAs } from "../slice-01a/helpers";
export { item, place } from "../slice-02b/helpers";
export { AROUND, collapse, collapsedFrame, removeCard } from "../slice-02c/helpers";
export { dragCardBy } from "../slice-02a/helpers";
export { setCard } from "../slice-06a/helpers";

/** The seeded key between order_line and order_header (slice 7a, F21) on "Customer & orders". */
export const FK_ORDER = "FK_order_line_order_header";

/** All the source lines on the page, or one by its relationship id. */
export const sourceLines = (page: Page): Locator => page.getByTestId("layer-lines").getByTestId("line-source");
export const sourceLine = (page: Page, id: string): Locator => page.getByTestId("layer-lines").locator(`[data-testid="line-source"][data-source-relationship="${id}"]`);

/** A source relationship's id by its name. */
export async function sourceRelationshipId(name: string): Promise<string> {
  const r = (await loadModel()).sourceRelationships.find((x) => x.name === name);
  expect(r, name).toBeDefined();
  return r!.id;
}

type Pt = { x: number; y: number };
export interface SourceShape {
  /** The line's start and end on the screen. */
  start: Pt;
  end: Pt;
  /** The arrow's tip and its base's middle on the screen. */
  tip: Pt;
  base: Pt;
  /** The two cards' boxes on the screen. */
  from: { left: number; right: number; top: number; bottom: number };
  to: { left: number; right: number; top: number; bottom: number };
}

/** A source line's ends, its arrow and its cards on the screen, read from the paths through their screen matrix. */
export const sourceShape = (page: Page, id: string, fromName: string, toName: string): Promise<SourceShape> =>
  page.evaluate(
    ([rid, fromCard, toCard]) => {
      const g = document.querySelector(`[data-testid="layer-lines"] [data-source-relationship="${rid}"]`)!;
      const path = g.querySelector("path.s") as SVGPathElement;
      const m = path.getScreenCTM()!;
      const scr = (x: number, y: number) => ({ x: x * m.a + m.e, y: y * m.d + m.f });
      const at = (l: number) => {
        const p = path.getPointAtLength(l);
        return scr(p.x, p.y);
      };
      const nums = (g.querySelector("path.ar")!.getAttribute("d") ?? "").match(/-?[\d.]+/g)!.map(Number);
      const [tx, ty, b1x, b1y, b2x, b2y] = nums as [number, number, number, number, number, number];
      const boxOf = (name: string) => {
        const el = [...document.querySelectorAll(".react-flow__node")].find((n) => n.querySelector('[data-testid="card-name"]')?.textContent === name)!.querySelector("[data-card]")!;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return { start: at(0), end: at(path.getTotalLength()), tip: scr(tx, ty), base: scr((b1x + b2x) / 2, (b1y + b2y) / 2), from: boxOf(fromCard), to: boxOf(toCard) };
    },
    [id, fromName, toName] as const,
  );

/** A file in the source standard with named keys: one row per column, `fk` as [name, referenced table, column]. */
type Row = [table: string, column: string, type: string, opts?: { pk?: boolean; fk?: [name: string, table: string, column: string] }];
export function keysFile(rows: Row[], database = "hrdb", schema = "dbo"): string {
  const ordinal = new Map<string, number>();
  const lines = rows.map(([table, column, type, o = {}]) => {
    const n = (ordinal.get(table) ?? 0) + 1;
    ordinal.set(table, n);
    const fk = o.fk ? `${o.fk[0]},${schema},${o.fk[1]},${o.fk[2]}` : ",,,";
    return `${database},${schema},${table},${column},${n},${type},yes,${o.pk ? "yes" : "no"},${fk},""`;
  });
  return [HEAD, ...lines].join("\n");
}

/** `employees` with a key to itself (as the HR sample's `FK_employees_manager`), and with `mentor` a second one. */
export const employeesFile = (keys: { manager?: boolean; mentor?: boolean } = { manager: true }) =>
  keysFile([
    ["employees", "emp_id", "int", { pk: true }],
    ["employees", "manager_id", "int", keys.manager ? { fk: ["FK_employees_manager", "employees", "emp_id"] } : {}],
    ["employees", "mentor_id", "int", keys.mentor ? { fk: ["FK_employees_mentor", "employees", "emp_id"] } : {}],
  ]);

/** Test data: a file imported into ERP as Łukasz, as the upload route does. */
export const importKeys = (text: string, label = "hr.csv") => importAs(SEED_IDS.userLukasz, "ERP", label, text);

const RETAIL_WS = SEED_IDS.wsRetailDwh;

/** Test data: a card's width on "Customer & orders" (D-37), as Łukasz through the domain. */
export async function setWidth(name: string, width: number): Promise<void> {
  const i = await item(name);
  const canvas = (await store().canvases.get(RETAIL_WS, i.canvas_id))!;
  const items = await loadItems(RETAIL_WS, i.canvas_id);
  await asLukasz((ctx, access) =>
    moveOnCanvas(ctx, access, { canvas, frames: [], items, entities: [], concepts: [] }, { canvasId: i.canvas_id, frames: [], items: [{ canvasItemId: i.id, expectedVersion: i.version, width, height: i.height }] }),
  );
}

// ---- step 3: clicks, Focus, live canvases ----

export { closeToolbox, pointOnLine, toolboxAt } from "../slice-01b/helpers";
export { backButton, clickCard, expectSelected, selected } from "../slice-06b/helpers";
export { expectHidden, togglePanel, viewportTransform } from "../slice-05a/helpers";
export { approvedMapping, fade, fadeTables } from "../slice-04b1/helpers";
export { labelItem, liveUrl, openLiveFor } from "../slice-03b/helpers";

/**
 * A point of a source line on the screen where the line itself takes the click (not a card above it): the first point
 * along its path, from `from` (0–1), whose topmost element is the line's hit target.
 */
export const freePointOn = (page: Page, id: string, from = 0.05): Promise<Pt> =>
  page.evaluate(
    ([rid, start]) => {
      const g = document.querySelector(`[data-testid="layer-lines"] [data-source-relationship="${rid}"]`)!;
      const path = g.querySelector("path.s") as SVGPathElement;
      const m = path.getScreenCTM()!;
      const len = path.getTotalLength();
      for (let l = len * start; l < len; l += 4) {
        const p = path.getPointAtLength(l);
        const x = p.x * m.a + m.e, y = p.y * m.d + m.f;
        if (document.elementFromPoint(x, y)?.closest("[data-source-relationship]") === g) return { x, y };
      }
      throw new Error("no free point on the line");
    },
    [id, from] as const,
  );
