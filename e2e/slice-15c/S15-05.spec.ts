import { expect, test } from "./fixtures";
import { card, cubeLine, cubeLines, cubeMappingId, openStar, rowNamed, signInAs } from "./helpers";

// S15-05 (IC-01), 15c's part: the Sales star's dimensional lines run from logical rows to dimensional rows, in the
// target's concept colour, dashed until Approved (Draft 6 4, In review 10 3 2 3), a dot at the start and a diamond at
// the target, ƒ on a transformation's first input; the Σ marks of 15b stay. "Rels" hides them, "Maps" keeps them.

test("S15-05: the star's 20 dimensional lines: rows to rows, the target's colour, dashes until Approved, diamonds, ƒ", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);

  await expect(cubeLines(page)).toHaveCount(20);
  await expect(page.getByTestId("layer-lines").getByTestId("end-diamond")).toHaveCount(22);
  await expect(cubeLines(page).getByTestId("node-f")).toHaveCount(7);

  // net_amount: three inputs from Order Line, In review, ƒ once
  const net = cubeLine(page, cubeMappingId("sales.net_amount"));
  await expect(net).toHaveClass(/\bcmap review\b/);
  await expect(net.locator("path.s")).toHaveCount(3);
  await expect(net.getByTestId("node-f")).toHaveCount(1);
  await expect(net.locator("path.s").first()).toHaveCSS("stroke-dasharray", "10px, 3px, 2px, 3px");
  // city: Draft; segment_code: Approved, solid
  const city = cubeLine(page, cubeMappingId("cust.city"));
  await expect(city).toHaveClass(/\bcmap draft\b/);
  await expect(city.locator("path.s")).toHaveCSS("stroke-dasharray", "6px, 4px");
  const segment = cubeLine(page, cubeMappingId("cust.segment_code"));
  await expect(segment).toHaveClass(/\bcmap approved\b/);
  await expect(segment.locator("path.s")).toHaveCSS("stroke-dasharray", "none");
  await expect(segment.getByTestId("node-f")).toHaveCount(0);

  // the target's concept colour: Dim Customer's card edge
  const cc = await card(page, "Dim Customer").locator(".card").evaluate((el) => getComputedStyle(el).getPropertyValue("--cc").trim());
  expect(await segment.evaluate((g) => (g as SVGGElement).style.getPropertyValue("--lc"))).toBe(cc);
  const stroke = await segment.locator("path.s").evaluate((p) => getComputedStyle(p).stroke);
  expect(stroke).not.toBe("none");

  // from Customer.segment_code's row to Dim Customer.segment_code's row: the path's ends at the rows' middles
  const [from, to] = await Promise.all([rowNamed(page, "Customer", "segment_code").boundingBox(), rowNamed(page, "Dim Customer", "segment_code").boundingBox()]);
  const ends = await segment.locator("path.s").evaluate((p) => {
    const path = p as SVGPathElement, m = path.getScreenCTM()!, len = path.getTotalLength();
    const at = (t: number) => {
      const q = path.getPointAtLength(len * t);
      return { x: q.x * m.a + m.e, y: q.y * m.d + m.f };
    };
    return [at(0), at(1)];
  });
  expect(Math.abs(ends[0]!.y - (from!.y + from!.height / 2))).toBeLessThan(2);
  expect(Math.abs(ends[1]!.y - (to!.y + to!.height / 2))).toBeLessThan(2);
  expect(Math.abs(ends[0]!.x - (from!.x + from!.width))).toBeLessThan(2);
  expect(Math.abs(ends[1]!.x - to!.x)).toBeLessThan(2);

  // 15b's Σ marks stay on the facts' rows
  await expect(rowNamed(page, "Fact Sales", "quantity")).toHaveClass(/\bmeas add\b/);

  // the layers (D-22): Relationships hides them, Mappings keeps them
  await page.getByTestId("switch-layer").locator('[data-layer="relationships"]').click();
  await expect(cubeLines(page)).toHaveCount(0);
  await page.getByTestId("switch-layer").locator('[data-layer="mappings"]').click();
  await expect(cubeLines(page)).toHaveCount(20);
});
