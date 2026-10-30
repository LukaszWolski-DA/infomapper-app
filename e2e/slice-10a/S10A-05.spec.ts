import type { Browser } from "@playwright/test";
import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, ids, lineMenu, loadModel, mappingLine, openCanvas, pointOnLine, recordToasts, signInAs, STALE, toasts } from "./helpers";

// A real conflict stays refused (item 4, P5): another session changed the mapping, so the write from the line's menu
// is refused once, and the saves of that mapping waiting behind it are not sent. S0-08 and S9-03 run unchanged.

/** A session of Łukasz with birth_date's mapping selected on the canvas (its panel open). */
async function sessionOn(browser: Browser, mappingId: string) {
  const page = await (await browser.newContext()).newPage();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const at = await pointOnLine(mappingLine(page, mappingId));
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  return page;
}

async function birthDate() {
  const { attribute } = await ids();
  return (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
}

test("S10A-05: a status from the line's menu after another session's change is refused once; the note waiting behind it is not sent", async ({ browser }) => {
  const mapping = await birthDate();
  const first = await sessionOn(browser, mapping.id);
  const second = await sessionOn(browser, mapping.id);

  const note = (p: typeof first) => p.getByTestId("panel-mapping").locator("#f-note");
  await note(first).fill("From the first session");
  await note(first).press("Tab");
  await expect.poll(async () => (await birthDate()).note_text).toBe("From the first session");

  // the second session still shows the old version: the status is refused, its note save behind it is cut
  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(second, mappingLine(second, mapping.id), next);
  await note(second).fill("From the second session");
  await note(second).press("Tab");
  await expectToast(second, STALE);

  await second.waitForTimeout(1500); // room for a cut save that was sent after all
  expect(await birthDate()).toMatchObject({ note_text: "From the first session", status: mapping.status, version: mapping.version + 1 });
  expect(await toasts(second)).toEqual([STALE]);
});

test("S10A-05: a delete from the line's menu cut by a refusal before it shows no Undo toast, and deletes nothing", async ({ browser }) => {
  const mapping = await birthDate();
  const first = await sessionOn(browser, mapping.id);
  const second = await sessionOn(browser, mapping.id);

  await first.getByTestId("panel-mapping").locator("#f-note").fill("From the first session");
  await first.getByTestId("panel-mapping").locator("#f-note").press("Tab");
  await expect.poll(async () => (await birthDate()).version).toBe(mapping.version + 1);

  const line = mappingLine(second, mapping.id);
  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(second, line, next); // refused: stale
  await lineMenu(second, line, "Delete mapping"); // waits behind it, then cut
  await expectToast(second, STALE);

  await second.waitForTimeout(1500);
  expect((await loadModel()).mappings.some((m) => m.id === mapping.id)).toBe(true);
  expect(await toasts(second)).toEqual([STALE]); // no “Mapping deleted” with Undo
});

test("S10A-05: a save waiting behind a delete of the same row is not sent and shows no toast of its own (not found cuts, F5)", async ({ page }) => {
  const mapping = await birthDate();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const line = mappingLine(page, mapping.id);
  const at = await pointOnLine(line);
  await page.mouse.click(at.x, at.y);
  const note = page.getByTestId("panel-mapping").locator("#f-note");
  // a status first, so the delete and the note behind it both wait in the chain
  const next = mapping.status === "review" ? "Approved" : "In review";
  await lineMenu(page, line, next);
  await lineMenu(page, line, "Delete mapping");
  await note.fill("Too late");
  await note.press("Tab");

  await expect.poll(async () => (await loadModel()).mappings.some((m) => m.id === mapping.id)).toBe(false);
  await page.waitForTimeout(1500);
  const seen = await toasts(page);
  expect(seen).toContain("Mapping deleted");
  expect(seen.filter((t) => t !== "Mapping deleted")).toEqual([]); // no “This mapping does not exist.”
});
