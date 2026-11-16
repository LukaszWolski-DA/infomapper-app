// S28-01 (slice 28, item 1, Q2, Q-A): each toggle hides and shows its panel; a hidden panel is 0 wide, inert and without
// its handle; `aria-pressed` follows; the layout is kept after a reload, from the first paint (the server reads the
// cookie, in the canvas's format); a cookie from slice 27 (widths only) still opens with its widths, both panels shown;
// the editor's cookie is its own (the canvas's panels are not touched).

import { expect, test } from "./fixtures";
import { expectPanel, formUrl, openDocument, openEditor, optionsToggle, panelsCookie, sectionsToggle, signInAs, storedDocument, widthOf, DEMO_DOCUMENT_NAMES } from "./helpers";

test("S28-01: the toggles hide and show the panels; kept after a reload from the first paint", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = await openDocument(page);
  await expect(sectionsToggle(page)).toHaveAttribute("title", "Show or hide the sections panel");
  await expect(sectionsToggle(page)).toHaveAccessibleName("Show or hide the sections panel");
  await expect(optionsToggle(page)).toHaveAccessibleName("Show or hide the options panel");
  // the left toggle before "← Documentation", the right one at the bar's end
  const order = await page.getByTestId("editor-top").evaluate((bar) => [...bar.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")));
  expect(order.indexOf("button-toggle-sections")).toBeLessThan(order.indexOf("link-documentation"));
  expect(order.at(-1)).toBe("button-toggle-options");
  await expectPanel(page, "left", true, 264);
  await expectPanel(page, "right", true, 340);

  await sectionsToggle(page).click();
  await expectPanel(page, "left", false);
  await expectPanel(page, "right", true, 340);
  await optionsToggle(page).click();
  await expectPanel(page, "right", false);
  expect(await panelsCookie(page)).toBe("l0.r0.264.340");

  // the server draws it hidden from the first paint
  const html = await (await page.request.get(formUrl(doc.id))).text();
  expect(html).toMatch(/class="de-body [^"]*\bnol nor\b/);
  await page.reload();
  await expectPanel(page, "left", false);
  await expectPanel(page, "right", false);

  // shown again, at the widths they had
  await sectionsToggle(page).click();
  await optionsToggle(page).click();
  await expectPanel(page, "left", true, 264);
  await expectPanel(page, "right", true, 340);
  expect(await panelsCookie(page)).toBe("l1.r1.264.340");
  // the canvas's own cookie is not written by the editor (Q-A)
  expect((await page.context().cookies()).some((c) => c.name.startsWith("im-panels."))).toBe(false);
});

test("S28-01: a cookie from slice 27 (its two widths) opens with its widths, both panels shown", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.s2t))!;
  // the cookie's name carries the person's id: read it from the page's own write first
  await openEditor(page, formUrl(doc.id));
  await sectionsToggle(page).click();
  const name = (await page.context().cookies()).find((c) => c.name.startsWith("im-doc-panels."))!.name;
  // the same cookie (path "/") with slice 27's value
  await page.context().addCookies([{ name, value: "300.400", url: `${new URL(page.url()).origin}/` }]);
  await page.reload();
  await expectPanel(page, "left", true, 300);
  await expectPanel(page, "right", true, 400);
  await expect(page.getByTestId("handle-left")).toHaveAttribute("aria-valuenow", "300");
  expect(await widthOf(page, "editor-right")).toBe(400);
});
