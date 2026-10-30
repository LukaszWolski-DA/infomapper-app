import { expect, test } from "./fixtures";
import { FK_ORDER, openCanvas, removeCard, signInAs, sourceLine, sourceLines, sourceRelationshipId, sourceShape } from "./helpers";

// S10B-01: a line between two tables (items 1, 2; D-62). On "Customer & orders" the seeded key from order_line (right)
// to order_header (left) is a grey line, 1.2 px, from order_line's left edge to order_header's right edge, with its
// arrow at order_header; no cardinality marks in either notation and no label. Without one of the cards, no line.

test("S10B-01: a grey line between order_line and order_header, the arrow at order_header", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  const id = await sourceRelationshipId(FK_ORDER);
  const line = sourceLine(page, id);
  await expect(line).toHaveCount(1);
  await expect(sourceLines(page)).toHaveCount(1);

  // the look: --im-ink-3, 1.2 px, not dashed; the arrow filled in the same colour
  const look = await line.evaluate((g) => {
    const s = getComputedStyle(g.querySelector("path.s")!), a = getComputedStyle(g.querySelector("path.ar")!);
    const probe = document.createElement("div");
    probe.style.color = "var(--im-ink-3)";
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return { stroke: s.stroke, width: s.strokeWidth, dash: s.strokeDasharray, fill: a.fill, rgb };
  });
  expect(look.stroke).toBe(look.rgb);
  expect(look.fill).toBe(look.rgb);
  expect(look.width).toBe("1.2px");
  expect(look.dash).toBe("none");

  // the ends: from order_line's left edge to order_header's right edge; the arrow's tip there, pointing into the card
  const g = await sourceShape(page, id, "order_line", "order_header");
  expect(Math.abs(g.start.x - g.from.left)).toBeLessThan(2);
  expect(Math.abs(g.end.x - g.to.right)).toBeLessThan(2);
  expect(Math.abs(g.tip.x - g.end.x)).toBeLessThan(1);
  expect(Math.abs(g.tip.y - g.end.y)).toBeLessThan(1);
  expect(g.base.x).toBeGreaterThan(g.tip.x);

  // three elements inside its group (hit, path, arrow), no cardinality marks and no label, in crow's foot and in UML
  for (const notation of ["ie", "uml"] as const) {
    const button = page.getByTestId("switch-notation").locator(`[data-notation="${notation}"]`);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(await line.evaluate((el) => el.querySelectorAll("*").length)).toBe(3);
    await expect(line.locator(".mk, .mult, .rlab, text")).toHaveCount(0);
  }

  // without order_header's card there is no line
  await removeCard("order_header");
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(sourceLines(page)).toHaveCount(0);
});
