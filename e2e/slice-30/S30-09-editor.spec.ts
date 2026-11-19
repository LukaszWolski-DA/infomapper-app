// S30-09 and F16 (slice 30): the document editor shows the save pair once, in its own bar before its options panel's
// button; the top bar above it leaves the pair out.
import { expect, test } from "../slice-28/fixtures";
import { openDocument } from "../slice-28/helpers";
import { signInAs } from "../slice-01a/helpers";

test("S30-09 (editor): one save pair, in the editor's bar, before its options panel's button", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await expect(page.getByTestId("indicator-save")).toHaveCount(1);
  await expect(page.getByTestId("badge-server")).toHaveCount(1);
  await expect(page.getByTestId("bar-top").getByTestId("group-save")).toHaveCount(0);
  const pair = await page.getByTestId("group-save").boundingBox();
  const print = await page.getByTestId("button-print").boundingBox();
  expect(pair!.x).toBeGreaterThanOrEqual(print!.x + print!.width);
  await expect(page.getByTestId("badge-server")).toHaveText("Local", { useInnerText: true });
});
