import { expect, test } from "./fixtures";
import { card, openCanvas, rowNamed, signInAs, canvasUrl, WHOLE_CO } from "./helpers";

// The demo: CR-23 marks Customer, email, segment_code and the mapping web_users.email → Customer.email; JIRA-481 marks
// customers and customers.email_addr (seed-working-layer.ts).
test("S3A-03: labeled attribute and column rows, entity and table headers and mapping lines show the tag mark with the label names as tooltip; below 40 % the row marks and line tags are not drawn", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const mark = (l: ReturnType<typeof card>) => l.getByTestId("mark-label");

  await expect(mark(rowNamed(page, "Customer", "email"))).toHaveAttribute("title", "Working labels: CR-23");
  await expect(mark(rowNamed(page, "Customer", "segment_code"))).toHaveAttribute("title", "Working labels: CR-23");
  await expect(mark(rowNamed(page, "customers", "email_addr"))).toHaveAttribute("title", "Working labels: JIRA-481");
  await expect(mark(card(page, "Customer").locator(".c-head"))).toHaveAttribute("title", "Working labels: CR-23");
  await expect(mark(card(page, "customers").locator(".c-head"))).toHaveAttribute("title", "Working labels: JIRA-481");
  // unlabeled rows and cards have none
  await expect(mark(rowNamed(page, "Customer", "customer_id"))).toHaveCount(0);
  await expect(mark(card(page, "order_line"))).toHaveCount(0);
  // the labeled mapping's line: the tag, and the names in the line's tooltip
  await expect(page.getByTestId("mark-label-line")).toHaveCount(1);
  const line = page.getByTestId("line-mapping").filter({ has: page.getByTestId("mark-label-line") });
  await expect(line.locator("title")).toHaveText("Labels: CR-23");
  // a mark is never drawn with opacity (AD-24)
  expect(await mark(rowNamed(page, "Customer", "email")).evaluate((e) => getComputedStyle(e).opacity)).toBe("1");

  // below 40 %: no rows, so no row marks, and no line tags; the headers keep theirs
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 0.3 });
  await expect(page.getByTestId("card-block").first()).toBeVisible();
  await expect(page.locator(".row[data-row] [data-testid=mark-label]")).toHaveCount(0);
  await expect(page.getByTestId("mark-label-line")).toHaveCount(0);
  await expect(mark(card(page, "Customer").locator(".c-head"))).toHaveCount(1);
  await expect(mark(card(page, "customers").locator(".c-head"))).toHaveCount(1);
});
