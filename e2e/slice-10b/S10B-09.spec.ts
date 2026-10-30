import { expect, test } from "./fixtures";
import { dragCardBy, FK_ORDER, openCanvas, setCard, setWidth, signInAs, sourceRelationshipId, sourceShape } from "./helpers";

// S10B-09: the line follows its cards (item 9): order_line moved by a drag, order_header made wider, order_header
// collapsed. Each time the ends are back on the cards' edges.

const VIEW = { x: -620, y: -300, zoom: 0.8 };

test("S10B-09: the line follows a card's move, a width change and a collapsed card", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, VIEW);
  const id = await sourceRelationshipId(FK_ORDER);
  const onEdges = async () => {
    await expect
      .poll(async () => {
        const g = await sourceShape(page, id, "order_line", "order_header");
        return Math.max(Math.abs(g.start.x - g.from.left), Math.abs(g.end.x - g.to.right), Math.abs(g.tip.x - g.end.x));
      })
      .toBeLessThan(2);
    return sourceShape(page, id, "order_line", "order_header");
  };

  const before = await onEdges();
  await dragCardBy(page, "order_line", 40, 60);
  const moved = await onEdges();
  expect(moved.start.y - before.start.y).toBeGreaterThan(30);

  await setWidth("order_header", 360);
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const wider = await onEdges();
  expect(wider.end.x - moved.end.x).toBeGreaterThan(50);

  await setCard("order_header", { collapsed: true });
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const collapsed = await onEdges();
  // side to side at header height: the end stays on the collapsed card
  expect(collapsed.end.y).toBeGreaterThan(collapsed.to.top);
  expect(collapsed.end.y).toBeLessThan(collapsed.to.bottom);
});
