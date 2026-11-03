import { expect, test, type Page } from "./fixtures";
import {
  archive,
  box,
  canvasUrl,
  card,
  changeFrameAsAnna,
  dragBetween,
  expectToast,
  frameEl,
  FRAMED,
  frameRow,
  groupsOf,
  hydrated,
  loadItems,
  loadModel,
  makeFrame,
  openCanvas,
  RETAIL,
  recordToasts,
  signInAs,
  STALE,
  toasts,
  toggleCardAsAnna,
  zoomOf,
} from "./helpers";

// S14A-02 (item 3, F16): the canvas's other writes keep their behaviour. A card's move and a frame's resize, refused as
// stale (Anna changed the row meanwhile) or after the archive, show the domain's toast once, put the card or frame back
// where it is stored, write nothing and add no undo step (the row's change events are Anna's only). A regression check:
// it passes before the slice too.

const CUSTOMER_VIEW = { x: 10, y: 60, zoom: 0.45 };

const customerRow = async () => {
  const entity = (await loadModel()).entities.find((e) => e.name === "Customer")!;
  return (await loadItems(RETAIL)).find((i) => i.entity_id === entity.id)!;
};

/** Drags Customer's card down by its header, 120 canvas units. */
async function dragCustomer(page: Page) {
  const head = await box(card(page, "Customer").locator(".c-head .c-l2"));
  const zoom = await zoomOf(page);
  const at = { x: head.x + head.width / 3, y: head.y + head.height / 2 };
  await dragBetween(page, at, { x: at.x, y: at.y + 120 * zoom });
}

/** Customer's card on the screen, at the stored place of its row (within 2 px). */
async function expectCardAtStored(page: Page) {
  const row = await customerRow();
  const zoom = await zoomOf(page);
  const pane = await box(page.locator(".react-flow__pane"));
  await expect
    .poll(async () => {
      const b = await box(card(page, "Customer"));
      const t = await page.locator(".react-flow__viewport").evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform));
      return Math.abs(Math.round((b.y - pane.y - t.f) / zoom) - row.y);
    })
    .toBeLessThanOrEqual(2);
}

for (const why of ["stale", "archived"] as const) {
  test(`S14A-02: a card's move refused (${why}): one toast, the card where it is stored, nothing written, no undo step`, async ({ page }) => {
    const before = await customerRow();
    await recordToasts(page);
    await signInAs(page, "Łukasz");
    await openCanvas(page, canvasUrl(), CUSTOMER_VIEW);
    await hydrated(page);
    if (why === "stale") await toggleCardAsAnna("Customer");
    else await archive();
    const annas = (await groupsOf(before.id)).length;

    await dragCustomer(page);
    await expectToast(page, why === "stale" ? STALE : /archived/i);
    await page.waitForTimeout(500);
    const seen = await toasts(page);
    expect(seen.filter((t) => (why === "stale" ? t === STALE : /archived/i.test(t)))).toHaveLength(1);
    const after = await customerRow();
    expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
    expect(await groupsOf(before.id)).toHaveLength(annas);
    await expectCardAtStored(page);
  });

  test(`S14A-02: a frame's resize refused (${why}): one toast, the frame at its stored size, nothing written`, async ({ page }) => {
    const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" });
    await recordToasts(page);
    await signInAs(page, "Łukasz");
    await openCanvas(page, canvasUrl(), FRAMED);
    await hydrated(page);
    if (why === "stale") await changeFrameAsAnna(area, { name: "Zone" });
    else await archive();
    const stored = await frameRow(area);
    const annas = (await groupsOf(area)).length;

    const frame = frameEl(page, "Area");
    const zoom = await zoomOf(page);
    const h = await box(frame.getByTestId("frame-resize"));
    const at = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    await dragBetween(page, at, { x: at.x + 96 * zoom, y: at.y });
    await expectToast(page, why === "stale" ? STALE : /archived/i);
    await page.waitForTimeout(500);
    const seen = await toasts(page);
    expect(seen.filter((t) => (why === "stale" ? t === STALE : /archived/i.test(t)))).toHaveLength(1);
    expect((await frameRow(area)).width).toBe(stored.width);
    expect(await groupsOf(area)).toHaveLength(annas);
    const shown = page.getByTestId("frame").filter({ has: page.getByTestId("frame-name").getByText(stored.name, { exact: true }) });
    await expect.poll(async () => Math.round((await box(shown)).width / zoom)).toBe(stored.width);
  });
}
