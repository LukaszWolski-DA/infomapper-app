import { createConcept } from "../../src/domain/commands/concept";
import { expect, test } from "./fixtures";
import {
  asLukasz,
  canvasTab,
  canvasUrl,
  emptyIn,
  expectToast,
  item,
  key,
  loadFrames,
  loadItems,
  loadModel,
  makeFrame,
  openCanvas,
  openCanvasMenu,
  RETAIL,
  SEED_IDS,
  signInAs,
  FRAMED,
} from "./helpers";

test("S2B-12: the Entity tool inside the Sales frame creates an entity of Sales in that frame; deleting a concept turns its frames into free frames on every canvas; Duplicate layout copies frames and memberships", async ({ page }) => {
  // a Sales concept frame around Sales Order and Order Line, with room below them
  const sales = await makeFrame({ x: 472, y: 520, width: 680, height: 560 }, { concept: "Sales" });
  expect((await item("Sales Order")).frame_id).toBe(sales);
  // a concept with no entities, standing for a frame on each canvas
  const model0 = await loadModel();
  const { conceptId: temp } = await asLukasz((ctx, access) => createConcept(ctx, access, { concepts: model0.concepts }, { name: "Temp" }));
  const tempHere = await makeFrame({ x: 1600, y: 0, width: 320, height: 200 }, { concept: "Temp" });
  const tempThere = await makeFrame({ x: 900, y: 0, width: 320, height: 200 }, { concept: "Temp", canvasId: SEED_IDS.canvasOrderLines });
  const tempColor = (await loadModel()).concepts.find((c) => c.id === temp)!.color;

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // the Entity tool (E), a click on an empty spot inside the Sales frame
  const entitiesBefore = (await loadModel()).entities.length;
  await key(page, "e");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "entity");
  const spot = await emptyIn(page, "Sales");
  await page.mouse.click(spot.x, spot.y);
  await expectToast(page, /^Created .+ in Sales\./);
  await expect.poll(async () => (await loadModel()).entities.length).toBe(entitiesBefore + 1);
  const model = await loadModel();
  const created = model.entities.find((e) => !model0.entities.some((x) => x.id === e.id))!;
  expect(created.concept_id).toBe(model.concepts.find((c) => c.name === "Sales")!.id);
  await expect.poll(async () => (await loadItems()).find((i) => i.entity_id === created.id)?.frame_id).toBe(sales);
  await page.keyboard.press("Escape");

  // deleting the concept Temp in the left panel: its frames become free frames on both canvases, name and place kept
  const concept = page.locator(`[data-testid="tree-concept"][data-concept-id="${temp}"]`);
  await concept.hover();
  await concept.getByTestId("button-concept-menu").click();
  await page.getByRole("menuitem", { name: "Delete concept…" }).click();
  await expect(page.getByTestId("dialog-delete-concept")).toBeVisible();
  await page.getByTestId("button-confirm-delete-concept").click();
  await expect.poll(async () => (await loadModel()).concepts.some((c) => c.id === temp)).toBe(false);
  const here = (await loadFrames()).find((f) => f.id === tempHere)!;
  const there = (await loadFrames(SEED_IDS.canvasOrderLines)).find((f) => f.id === tempThere)!;
  for (const [f, x] of [[here, 1600], [there, 900]] as const) {
    expect(f).toMatchObject({ kind: "free", concept_id: null, source_system_id: null, name: "Temp", x, y: 0, width: 320, height: 200, color: tempColor });
  }

  // Duplicate layout: the copy has the same frames (new ids) and each card in the copy of its frame
  const originals = await loadFrames();
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("menu-item-duplicate").click();
  await expect(canvasTab(page, "Customer & orders (copy)")).toHaveAttribute("aria-selected", "true");
  const copyId = new URL(page.url()).pathname.split("/c/")[1]!;
  const copies = await loadFrames(copyId);
  const shape = (f: (typeof originals)[number]) => ({ name: f.name, kind: f.kind, concept_id: f.concept_id, color: f.color, x: f.x, y: f.y, width: f.width, height: f.height });
  const byPlace = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x - b.x || a.y - b.y;
  expect(copies.map(shape).sort(byPlace)).toEqual(originals.map(shape).sort(byPlace));
  expect(copies.some((c) => originals.some((o) => o.id === c.id))).toBe(false);
  const frameName = (list: typeof originals, id: string | null) => (id ? list.find((f) => f.id === id)!.name : null);
  const target = (i: { entity_id: string | null; source_table_id: string | null }) => i.entity_id ?? i.source_table_id;
  const originalItems = await loadItems(RETAIL, SEED_IDS.canvasCustomerOrders);
  const copyItems = await loadItems(RETAIL, copyId);
  expect(copyItems).toHaveLength(originalItems.length);
  for (const o of originalItems) {
    const c = copyItems.find((x) => target(x) === target(o))!;
    expect(frameName(copies, c.frame_id), String(target(o))).toBe(frameName(originals, o.frame_id));
  }
  await expect(page.getByTestId("frame")).toHaveCount(copies.length);
});
