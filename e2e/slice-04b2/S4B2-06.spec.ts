// S4B2-06 (slice 4b-2, PRD items 17–19): dragging a requirement from the left panel. Onto an attribute row, a column row,
// an entity card, a table card and a mapping line it links the requirement (the hint says “Link to {name}” while the
// target is outlined; the toast “Linked {key} to {name}.” has Undo); where it is already linked nothing is written and
// the toast says so; onto empty canvas and onto a collapsed frame's block it places the requirement's card (“Place
// card”), selected, with its toast; dropped again it moves the card (“Move card”).

import { expect, test, type Page } from "./fixtures";
import {
  AROUND,
  blockEl,
  box,
  canvasUrl,
  commitCounters,
  card,
  collapsedFrame,
  emptySpot,
  expectToast,
  headPoint,
  loadModel,
  loadRequirementLinks,
  mappingLine,
  openCanvas,
  openRequirementsTab,
  pointOnLine,
  reqCardData,
  requirementByKey,
  requirementRow,
  row,
  signInAs,
} from "./helpers";

const VIEW = { x: 10, y: 10, zoom: 0.6 };

/**
 * In Playwright's drag, Chromium sends `dragover` only now and then and never while the mouse rests (a real browser
 * sends one about every 50 ms): nudge by a pixel at a point until one lands there.
 */
async function nudgeTo(page: Page, to: { x: number; y: number }) {
  await expect
    .poll(async () => {
      await page.mouse.move(to.x + 1, to.y);
      await page.mouse.move(to.x, to.y);
      return page.evaluate(([x, y]) => {
        const [lx, ly] = ((window as unknown as { __imLastDragOver?: string }).__imLastDragOver ?? "").split(",").map(Number);
        return Math.abs(lx! - x) <= 1.5 && Math.abs(ly! - y) <= 1.5;
      }, [to.x, to.y] as const);
    }, { intervals: [60] })
    .toBe(true);
}

/** Drags a requirement's row of the left panel to a point with the real mouse; the hint must read `hint` before the drop. */
async function dragRequirement(page: Page, key: string, to: { x: number; y: number }, hint: string | RegExp, beforeDrop?: () => Promise<void>): Promise<void> {
  const from = await box(requirementRow(page, key));
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  // as Playwright's own dragTo: press on the row, a small move to start the drag, then to the target
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y);
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await nudgeTo(page, to);
  await expect(page.getByTestId("hint-drop")).toHaveText(hint);
  if (beforeDrop) await beforeDrop();
  await page.mouse.up();
  await expect(page.getByTestId("hint-drop")).toBeHidden();
}

/**
 * Drags a requirement over points without dropping it (released over the left panel, where nothing happens); `count`
 * is read once the drag is over the canvas and again after the last point, before the release.
 */
async function dragOverOnly<T>(page: Page, key: string, points: { x: number; y: number }[], count: () => Promise<T>): Promise<{ before: T; after: T }> {
  const from = await box(requirementRow(page, key));
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y);
  await page.mouse.move(points[0]!.x, points[0]!.y, { steps: 4 });
  await nudgeTo(page, points[0]!);
  await expect(page.getByTestId("hint-drop")).toBeVisible();
  const before = await count();
  for (const p of points) {
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await nudgeTo(page, p);
  }
  const after = await count();
  await page.mouse.move(start.x, start.y, { steps: 4 });
  await page.mouse.up();
  return { before, after };
}

const linksOf = async (key: string) => {
  const r = await requirementByKey(key);
  return (await loadRequirementLinks()).filter((k) => k.requirement_id === r.id && k.deleted_at === null);
};

/** Records where the last `dragover` was, so the helper knows one landed at the target. */
const recordDragOver = (page: Page) =>
  page.addInitScript(() =>
    document.addEventListener("dragover", (e) => ((window as unknown as { __imLastDragOver?: string }).__imLastDragOver = `${e.clientX},${e.clientY}`), true),
  );

test("S4B2-06: dragging a requirement links it to a row, a column, an entity, a table and a mapping, with Undo; already linked changes nothing; empty canvas and a collapsed block place its card; the hints", async ({ page }) => {
  test.setTimeout(150_000);
  const model = await loadModel();
  const attr = (entity: string, name: string) => model.attributes.find((a) => a.name === name && a.entity_id === model.entities.find((e) => e.name === entity)!.id)!;
  const col = (table: string, name: string) => model.sourceColumns.find((c) => c.name === name && c.source_table_id === model.sourceTables.find((t) => t.name === table)!.id)!;
  await recordDragOver(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  await openRequirementsTab(page);
  const rowMiddle = async (cardName: string, rowId: string) => {
    const b = await box(row(page, cardName, rowId));
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  // an attribute row: “Link to first_name”, the row outlined, then the link with Undo
  const first = attr("Customer", "first_name");
  const before = (await linksOf("REQ-103")).length;
  await dragRequirement(page, "REQ-103", await rowMiddle("Customer", first.id), "Link to first_name", async () => {
    await expect(page.getByTestId("mark-drop-target")).toHaveAttribute("data-target", first.id);
  });
  await expectToast(page, "Linked REQ-103 to first_name.");
  await expect.poll(async () => (await linksOf("REQ-103")).some((k) => k.attribute_id === first.id)).toBe(true);
  await page.getByTestId("toast").getByTestId("toast-action").click();
  await expect.poll(async () => (await linksOf("REQ-103")).length).toBe(before);
  await page.waitForLoadState("networkidle");

  // already linked (email): the hint says so, nothing is written
  const email = attr("Customer", "email");
  await dragRequirement(page, "REQ-103", await rowMiddle("Customer", email.id), "Already linked to email");
  await expectToast(page, "REQ-103 is already linked to email.");
  expect((await linksOf("REQ-103")).length).toBe(before);

  // a column row, an entity card and a table card (on the header, not a row)
  const emailAddr = col("customers", "email_addr");
  await dragRequirement(page, "REQ-103", await rowMiddle("customers", emailAddr.id), "Link to email_addr");
  await expect.poll(async () => (await linksOf("REQ-103")).some((k) => k.source_column_id === emailAddr.id)).toBe(true);
  await dragRequirement(page, "REQ-103", await headPoint(page, "Sales Order"), "Link to Sales Order");
  await expect.poll(async () => (await linksOf("REQ-103")).some((k) => k.entity_id === model.entities.find((e) => e.name === "Sales Order")!.id)).toBe(true);
  await dragRequirement(page, "REQ-103", await headPoint(page, "order_header"), "Link to order_header");
  await expect.poll(async () => (await linksOf("REQ-103")).some((k) => k.source_table_id === model.sourceTables.find((t) => t.name === "order_header")!.id)).toBe(true);

  // a mapping line, lit while dragged over
  const mapping = model.mappings.find((m) => model.attributes.find((a) => a.id === m.attribute_id)?.name === "first_name")!;
  await dragRequirement(page, "REQ-103", await pointOnLine(mappingLine(page, mapping.id), 0.4), /^Link to .+ → Customer\.first_name$/, async () => {
    await expect(page.getByTestId("layer-drop-line")).toHaveCount(1);
  });
  await expect.poll(async () => (await linksOf("REQ-103")).some((k) => k.mapping_id === mapping.id)).toBe(true);

  // S4B2-15's guard: dragging over the pane, a card, a row and a line re-renders neither the canvas nor the miniature
  // (the target and the hint are value stores, read by the overlay's mark and the hint only)
  // the page settled first: the last link's fresh page commits too
  await expect.poll(async () => { const a = JSON.stringify(await commitCounters(page)); await page.waitForTimeout(1000); return JSON.stringify(await commitCounters(page)) === a; }, { timeout: 30_000 }).toBe(true);
  const sales = await headPoint(page, "Sales Order");
  const lastRow = await rowMiddle("Customer", attr("Customer", "last_name").id);
  const line = await pointOnLine(mappingLine(page, mapping.id), 0.4);
  const counted = await dragOverOnly(page, "REQ-102", [sales, lastRow, line], () => commitCounters(page));
  expect(counted.after, "canvas and miniature commits while dragging over targets").toEqual(counted.before);

  // empty canvas: “Place card”, the card there, selected; again: “Move card”
  const spot = await emptySpot(page);
  await dragRequirement(page, "REQ-101", spot, "Place card");
  await expectToast(page, "Placed REQ-101 on this canvas. Dashed lines show what it traces to.");
  await expect.poll(async () => !!(await reqCardData("REQ-101"))).toBe(true);
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-101");
  const placed = (await reqCardData("REQ-101"))!;
  await openRequirementsTab(page);
  // on the card itself, 40 px left and down: still a place, so the card moves there
  await dragRequirement(page, "REQ-101", { x: spot.x - 40, y: spot.y + 40 }, "Move card");
  await expect.poll(async () => { const c = (await reqCardData("REQ-101"))!; return [c.x < placed.x, c.y > placed.y]; }).toEqual([true, true]);

  // a collapsed frame's block: “Place card”; the card joins no frame
  await collapsedFrame(AROUND.sales, { name: "Sales area" });
  await openCanvas(page, canvasUrl(), VIEW);
  await openRequirementsTab(page);
  const blk = await box(blockEl(page, "Sales area"));
  await dragRequirement(page, "REQ-102", { x: blk.x + blk.width / 2, y: blk.y + blk.height / 2 }, "Place card");
  await expect.poll(async () => (await reqCardData("REQ-102"))?.frame_id).toBeNull();
  await expect(card(page, "Customer")).toBeVisible();
});
