import { expect, test } from "./fixtures";
import { backButton, box, canvasUrl, deleteButton, expectAt, expectToast, loadItems, newSession, OM, OM_HOME, OWN, recordToasts, RETAIL, SHARED, signInAs, toasts, WS_HOME } from "./helpers";

// S12A-12 (items 16, 17; a regression test of D-38's redirect, F1): a second person has the project's home and its own
// canvas open; after the delete, a write on that canvas is refused as not found and its fresh page (slice 13, F3), like
// a reload of the home, shows the workspace home with "That project no longer exists.", and so does Back to a page of the deleted project in the first
// person's tab. A shared canvas opened under the deleted project's address does the same.
// The delete's own redirect replaces the deleted home's history entry (step 4: Next.js replaces the entry when the
// action's page redirects), so Back from the workspace home goes to the page before it: here the project's canvas.

const GONE = "That project no longer exists.";

test("S12A-12: pages of a deleted project: someone else's write refused, reloads, Back and a shared canvas's old address lead to the workspace home with the toast", async ({ page, browser }) => {
  const anna = await newSession(browser, "Anna Nowak");
  const home = anna.page;
  const canvas = await anna.context.newPage();
  // two tabs of one window: each records its toasts, so a tab in the background is read as well
  await recordToasts(home);
  await recordToasts(canvas);
  await home.goto(OM_HOME);
  await canvas.goto(canvasUrl(OWN, OM));
  await expect(canvas.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const card = (await loadItems(RETAIL, OWN)).find((i) => i.entity_id)!;

  await signInAs(page, "Łukasz");
  await page.goto(canvasUrl(OWN, OM));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  // to the home by its tab, in the same document, as a person goes (a typed address would make Back a restore of a
  // whole earlier document from the browser's back-forward cache, which no page code sees; step 4's report)
  await page.getByTestId("tab-home").click();
  await expectAt(page, OM_HOME);
  await deleteButton(page).click();
  await deleteButton(page).click();
  await expectToast(page, "Deleted the project Order management and 1 canvas that only it used. The model is untouched.");
  await expectAt(page, WS_HOME);

  // Anna's open canvas: moving a card is refused (the card is gone with its canvas), nothing written
  const head = await box(canvas.locator(`[data-card="${card.id}"] .c-head .c-l2`));
  await canvas.mouse.move(head.x + head.width / 3, head.y + head.height / 2);
  await canvas.mouse.down();
  for (let i = 1; i <= 6; i++) await canvas.mouse.move(head.x + head.width / 3 + i * 10, head.y + head.height / 2);
  await canvas.mouse.up();
  // the refusal brings the fresh page (slice 13, F3): the canvas tab leads to the workspace home with the toast at once
  await expectAt(canvas, WS_HOME);
  await expect.poll(() => toasts(canvas)).toContain(GONE);
  expect((await loadItems(RETAIL, OWN)).length).toBe(0);

  // a reload of Anna's project home
  await home.bringToFront();
  await home.reload();
  await expectAt(home, WS_HOME);
  await expect.poll(() => toasts(home)).toContain(GONE);
  // Back in Łukasz's tab: the deleted project's canvas, which leads to the workspace home with the toast
  await page.bringToFront();
  await backButton(page).click();
  await expectAt(page, WS_HOME);
  await expectToast(page, GONE);
  // the shared canvas under the deleted project's address
  await home.bringToFront();
  await home.goto(canvasUrl(SHARED, OM));
  await expectAt(home, WS_HOME);
  await expect.poll(() => toasts(home)).toContain(GONE);
  await anna.context.close();
});
