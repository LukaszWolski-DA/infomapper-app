// S18-08 (slice 18, PRD section 7, Q5): a calculated row has one element more than an ordinary row, its "=" mark, and a
// row counted through its calculation draws its square on the existing dot; nothing is added to other rows. The page-wide
// element guard on "Performance test" (no calculation there) is `e2e/slice-03b/S3B-15-elements.spec.ts` in the
// measurement build, and the idle and pan commit checks are S2C-12, S3A-14-idle and S3B-15-idle in the full run.

import { expect, test } from "./fixtures";
import { hydrated, openStar, rowNamed, signInAs } from "./helpers";

const elementsIn = (row: ReturnType<typeof rowNamed>) => row.evaluate((el) => el.querySelectorAll("*").length + 1);

test("S18-08: a calculated row has one element more (its mark), its square is a class on the dot, other rows are unchanged", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  // net_amount and quantity: the same badges (a measure's Σ is a class), the same type width; net_amount is calculated
  const net = rowNamed(page, "Fact Sales", "net_amount");
  const quantity = rowNamed(page, "Fact Sales", "quantity");
  await expect(net.getByTestId("mark-calc")).toHaveCount(1);
  await expect(quantity.getByTestId("mark-calc")).toHaveCount(0);
  const [withMark, without] = [await elementsIn(net), await elementsIn(quantity)];
  expect(withMark - without).toBe(1);
  await expect(net.getByTestId("dot-mapped")).toHaveClass(/\bcalc\b/);
});
