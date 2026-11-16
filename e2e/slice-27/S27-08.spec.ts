// S27-08 (slice 27, PRD item 6, Q7 as Łukasz answered): the editor's side panels are resized by their handles: a drag
// and the arrow keys (16 px, with Shift 64 px) within their bounds, a double-click and Home back to the default; each
// handle a separator with its width as its value; the widths kept in a cookie the server reads, so a reload opens with
// them; no handles up to 1,100 px; "Fit width" follows the preview's new width.
// Slice 28 (item 1, Q2, Q-E): the bounds and defaults are the canvas's (200–520, 280–640; 264, 340, D-54, were 200–480,
// 280–560; 250, 330) and the cookie is in the canvas's format with the hidden flags (`l1.r1.520.280`, was `480.280`).

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, formUrl, openEditor, signInAs, storedDocument } from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;
const width = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => Math.round(el.getBoundingClientRect().width));
/** The zoom the shown pages are drawn at ("Fit width"). */
const zoom = (page: Page) => page.getByTestId("document-host").evaluate((el) => Number((el as HTMLElement).style.zoom));

async function drag(page: Page, handle: string, dx: number) {
  const box = (await page.getByTestId(handle).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx / 2, box.y + 200, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + 200, { steps: 4 });
  await page.mouse.up();
}

test("S27-08: the handles resize the panels within their bounds, by drag and keys, back to the default; kept after a reload", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const url = formUrl((await storedDocument(DOC))!.id);
  await openEditor(page, url);
  const left = page.getByTestId("handle-left"), right = page.getByTestId("handle-right");
  await expect(left).toHaveAttribute("role", "separator");
  await expect(left).toHaveAttribute("aria-label", "Width of the sections panel");
  await expect(right).toHaveAttribute("aria-label", "Width of the options panel");
  await expect(left).toHaveAttribute("title", "Drag to widen; double-click for the default width");
  await expect(left).toHaveAttribute("aria-valuenow", "264");
  await expect(left).toHaveAttribute("aria-valuemin", "200");
  await expect(left).toHaveAttribute("aria-valuemax", "520");
  await expect(right).toHaveAttribute("aria-valuemin", "280");
  await expect(right).toHaveAttribute("aria-valuemax", "640");
  expect(await width(page, "editor-left")).toBe(264);
  expect(await width(page, "editor-right")).toBe(340);
  const fit = await zoom(page);

  // a drag widens the sections panel; "Fit width" follows the narrower preview
  await drag(page, "handle-left", 100);
  expect(await width(page, "editor-left")).toBe(364);
  await expect(left).toHaveAttribute("aria-valuenow", "364");
  await expect.poll(() => zoom(page)).toBeLessThan(fit);
  // beyond its bound it stops there
  await drag(page, "handle-left", 400);
  expect(await width(page, "editor-left")).toBe(520);
  // the options panel grows to the left
  await drag(page, "handle-right", -60);
  expect(await width(page, "editor-right")).toBe(400);

  // the keys: 16 px, with Shift 64 px; Home back to the default
  await right.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await width(page, "editor-right")).toBe(416);
  await page.keyboard.press("Shift+ArrowRight");
  expect(await width(page, "editor-right")).toBe(352);
  await page.keyboard.press("Home");
  expect(await width(page, "editor-right")).toBe(340);
  await expect(right).toHaveAttribute("aria-valuenow", "340");
  await page.keyboard.press("Shift+ArrowRight");
  expect(await width(page, "editor-right")).toBe(280);

  // kept in this browser: a reload opens with them, from the first paint (the server reads the cookie)
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name.startsWith("im-doc-panels."))?.value).toBe("l1.r1.520.280");
  await page.reload();
  await expect(page.getByTestId("handle-left")).toHaveAttribute("aria-valuenow", "520");
  expect(await width(page, "editor-left")).toBe(520);
  expect(await width(page, "editor-right")).toBe(280);
  const html = await (await page.request.get(url)).text();
  expect(html).toContain("--dl:520px;--dr:280px");

  // a double-click gives the default back
  await page.getByTestId("handle-left").dblclick();
  expect(await width(page, "editor-left")).toBe(264);
  await expect(page.getByTestId("handle-left")).toHaveAttribute("aria-valuenow", "264");
});

test("S27-08: no handles up to 1,100 px, where the layout stacks", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.setViewportSize({ width: 1100, height: 800 });
  await openEditor(page, formUrl((await storedDocument(DOC))!.id));
  await expect(page.getByTestId("handle-left")).toBeHidden();
  await expect(page.getByTestId("handle-right")).toBeHidden();
  await page.setViewportSize({ width: 1101, height: 800 });
  await expect(page.getByTestId("handle-left")).toBeVisible();
});
