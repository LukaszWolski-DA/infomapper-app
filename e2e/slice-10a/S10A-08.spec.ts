import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  card,
  closeToolbox,
  dragCardBy,
  expectSelected,
  openCanvas,
  relationshipLine,
  selfRelationship,
  setCard,
  signInAs,
  toolboxAt,
  pointOnLine,
  loadItems,
} from "./helpers";

// The loop (items 11 and 12, D-61): a relationship from an entity to itself drawn at its card's top right corner, from
// the right edge (from) to the top edge (to). Points are read on the screen: the path's own points through its screen
// matrix, against the card's box.

const AT_100 = { x: -260, y: 140, zoom: 1 };
const AT_30 = { x: 260, y: 160, zoom: 0.3 };

interface Shape {
  start: { x: number; y: number };
  end: { x: number; y: number };
  mid: { x: number; y: number };
  label: { x: number; y: number } | null;
  card: { left: number; right: number; top: number; bottom: number };
  zoom: number;
}

/** The loop's start, end and middle on the screen, its label's centre, and its card's box. */
const shape = (page: Page, relationshipId: string, cardName: string): Promise<Shape> =>
  page.evaluate(
    ([id, name]) => {
      const g = document.querySelector(`[data-testid="layer-lines"] [data-relationship="${id}"]`)!;
      const path = g.querySelector("path.s") as SVGPathElement;
      const m = path.getScreenCTM()!;
      const at = (l: number) => {
        const p = path.getPointAtLength(l);
        return { x: p.x * m.a + m.e, y: p.y * m.d + m.f };
      };
      const len = path.getTotalLength();
      const rect = g.querySelector(".rlab rect")?.getBoundingClientRect();
      const cardEl = [...document.querySelectorAll(".react-flow__node")].find((n) => n.querySelector('[data-testid="card-name"]')?.textContent === name)!.querySelector("[data-card]")!;
      const b = cardEl.getBoundingClientRect();
      return {
        start: at(0),
        end: at(len),
        mid: at(len / 2),
        label: rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null,
        card: { left: b.left, right: b.right, top: b.top, bottom: b.bottom },
        zoom: m.a,
      };
    },
    [relationshipId, cardName] as const,
  );

/** The loop leaves the card's right edge at the header's middle and comes back through its top edge near the corner. */
function expectLoopAt(s: Shape, nested = 0) {
  const tol = 1.5;
  expect(Math.abs(s.start.x - s.card.right)).toBeLessThan(tol);
  expect(Math.abs(s.start.y - (s.card.top + (27 + nested) * s.zoom))).toBeLessThan(tol);
  expect(Math.abs(s.end.y - s.card.top)).toBeLessThan(tol);
  expect(s.end.x).toBeLessThan(s.card.right);
  expect(s.end.x).toBeGreaterThan(s.card.right - 80 * s.zoom);
  // its middle, the outer point, lies outside the card, up and to the right of its corner
  expect(s.mid.x).toBeGreaterThan(s.card.right);
  expect(s.mid.y).toBeLessThan(s.card.top);
}

const notation = (page: Page, n: "ie" | "uml") => page.getByTestId("switch-notation").locator(`[data-notation="${n}"]`).click();

test("S10A-08: at 100 % and 30 % the loop leaves the right edge and returns through the top edge; both notations draw their end marks; the label sits at the outer point", async ({ page }) => {
  const rel = await selfRelationship("Customer", { label: "refers" });
  await signInAs(page, "Łukasz");
  for (const view of [AT_100, AT_30]) {
    await openCanvas(page, canvasUrl(), view);
    const line = relationshipLine(page, rel.id);
    await expect(line).toHaveCount(1);
    const s = await shape(page, rel.id, "Customer");
    expectLoopAt(s);
    expect(s.label).not.toBeNull();
    expect(Math.hypot(s.label!.x - s.mid.x, s.label!.y - s.mid.y)).toBeLessThan(1.5);
    // crow's foot: 0..1 at the from end (a bar and a circle), 0..n at the to end (a foot and a circle)
    await notation(page, "ie");
    await expect(line.getByTestId("ends-ie").locator("path.mk")).toHaveCount(1);
    await expect(line.getByTestId("ends-ie").locator("circle.mk")).toHaveCount(2);
    await notation(page, "uml");
    await expect(line.getByTestId("ends-uml").locator("text.mult")).toHaveText(["0..1", "0..*"]);
    await notation(page, "ie");
  }
});

test("S10A-08: the miniature draws no line for a self-relationship", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  const mini = page.getByTestId("panel-overview").locator("line.mr");
  const before = await mini.count();
  expect(before).toBeGreaterThan(0);
  const rel = await selfRelationship("Customer");
  await openCanvas(page, canvasUrl(), AT_100);
  await expect(relationshipLine(page, rel.id)).toHaveCount(1);
  await expect(mini).toHaveCount(before);
});

test("S10A-08: a click on the loop selects it and a click inside it does not; hovered it thickens; its menu offers swap and delete", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  const line = relationshipLine(page, rel.id);
  const s = await shape(page, rel.id, "Customer");

  // inside the loop, between its stroke and the card's corner: nothing is selected
  await page.mouse.click(s.card.right + 8, s.card.top - 8);
  await page.waitForTimeout(300);
  await expectSelected(page, "none");

  // hovered: the stroke thickens by CSS, as on other relationship lines
  const width = () => line.locator("path.s").evaluate((p) => getComputedStyle(p).strokeWidth);
  const plain = await width();
  const on = await pointOnLine(line, 0.5);
  await page.mouse.move(on.x, on.y);
  await expect.poll(width).not.toBe(plain);
  await page.mouse.click(on.x, on.y);
  await expectSelected(page, "relationship");
  await expect(page.getByTestId("panel-relationship").locator("h2")).toHaveText("Customer and Customer");

  const items = await toolboxAt(page, on);
  expect(items).toEqual(expect.arrayContaining(["Swap direction", "Delete relationship"]));
  await closeToolbox(page);
});

test("S10A-08: a second self-relationship nests outside the first", async ({ page }) => {
  const first = await selfRelationship("Customer", { label: "refers" });
  const second = await selfRelationship("Customer", { label: "replaces" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  await expect(relationshipLine(page, second.id)).toHaveCount(1);
  const a = await shape(page, first.id, "Customer"), b = await shape(page, second.id, "Customer");
  expectLoopAt(a);
  expectLoopAt(b, 16);
  expect(b.end.x).toBeLessThan(a.end.x - 15);
  const corner = (p: { x: number; y: number }) => Math.hypot(p.x - a.card.right, p.y - a.card.top);
  expect(corner(b.mid)).toBeGreaterThan(corner(a.mid) + 20);
  // the labels do not overlap
  expect(a.label!.y - b.label!.y).toBeGreaterThan(18);
});

test("S10A-08: the loop follows a card move, a width change and a collapsed card", async ({ page }) => {
  const rel = await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), AT_100);
  const before = await shape(page, rel.id, "Customer");
  const customer = (await loadItems()).find((i) => i.entity_id === rel.from_entity_id)!;
  const stored = async () => (await loadItems()).find((i) => i.id === customer.id)!;

  await dragCardBy(page, "Customer", 48, 40);
  await expect.poll(async () => (await stored()).x).toBe(customer.x + 48);
  await expect.poll(async () => (await shape(page, rel.id, "Customer")).card.left).toBeGreaterThan(before.card.left + 40);
  expectLoopAt(await shape(page, rel.id, "Customer"));

  await card(page, "Customer").getByTestId("handle-card-width").dblclick(); // fit width to names
  await expect.poll(async () => (await stored()).width).not.toBe(customer.width);
  const wide = await shape(page, rel.id, "Customer");
  expectLoopAt(wide);

  await setCard("Customer", { collapsed: true });
  await openCanvas(page, canvasUrl(), AT_100);
  await expect(card(page, "Customer").locator(".row[data-row]")).toHaveCount(0);
  const collapsed = await shape(page, rel.id, "Customer");
  expectLoopAt(collapsed);
  expect(collapsed.start.y).toBeLessThan(collapsed.card.bottom);
});
