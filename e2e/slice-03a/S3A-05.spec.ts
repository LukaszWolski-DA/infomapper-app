import { removeLabel as removeLabelFromItem } from "../../src/domain/commands/label";
import { updateNote } from "../../src/domain/commands/note";
import { expect, test } from "./fixtures";
import { asLukasz, CO, DEMO_NOTES, labelNamed, loadLinks, loadNotes, RETAIL, SEED_IDS, signInAs, store } from "./helpers";
import type { Page } from "./fixtures";

const HOME = `/w/${RETAIL}/p/${SEED_IDS.projOrderManagement}`;
const labelRows = (page: Page) => page.getByTestId("item-project-label");
const order = (page: Page) => labelRows(page).evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.label}${(e as HTMLElement).dataset.pinned ? "*" : ""}`));

test("S3A-05: the project home lists its canvases' labels; a pinned one comes first, stays after a reload and when no canvas uses it; unpinning works; open notes are counted and listed, a click opens the note's canvas with it selected", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(HOME);

  // labels: by items (CR-23 marks 4, JIRA-481 marks 2)
  await expect.poll(() => order(page)).toEqual(["CR-23", "JIRA-481"]);
  await expect(labelRows(page).filter({ hasText: "JIRA-481" })).toContainText("2 items");
  // pinning JIRA-481 puts it first, also after a reload; unpinning puts it back
  await labelRows(page).filter({ hasText: "JIRA-481" }).getByTestId("button-label-pin").click();
  await expect.poll(() => order(page)).toEqual(["JIRA-481*", "CR-23"]);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(["JIRA-481*", "CR-23"]);
  await labelRows(page).filter({ hasText: "JIRA-481" }).getByTestId("button-label-pin").click();
  await expect.poll(() => order(page)).toEqual(["CR-23", "JIRA-481"]);
  // pinned again, then taken off both its items: it stays listed, marking nothing
  await labelRows(page).filter({ hasText: "JIRA-481" }).getByTestId("button-label-pin").click();
  await expect.poll(() => order(page)).toEqual(["JIRA-481*", "CR-23"]);
  const jira = (await labelNamed("JIRA-481"))!;
  for (const link of (await loadLinks()).filter((k) => k.label_id === jira.id)) {
    await asLukasz((ctx, access) => removeLabelFromItem(ctx, access, { link }, { labelLinkId: link.id, expectedVersion: link.version }));
  }
  await page.reload();
  await expect.poll(() => order(page)).toEqual(["JIRA-481*", "CR-23"]);
  await expect(labelRows(page).filter({ hasText: "JIRA-481" })).toContainText("0 items");

  // open notes: the number and the list (first line, the canvas's name, what it is on)
  await expect(page.getByTestId("stat-open-notes")).toHaveText("2 open notes");
  const notes = page.getByTestId("item-project-note");
  await expect(notes).toHaveCount(2);
  await expect(notes.filter({ hasText: DEMO_NOTES.free })).toContainText("Customer & orders");
  await expect(notes.filter({ hasText: DEMO_NOTES.pinned })).toContainText("Customer & orders, on order_line");
  // a click opens that canvas with the note selected
  await notes.filter({ hasText: DEMO_NOTES.pinned }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${CO}$`));
  await expect(page.getByTestId("panel-note")).toBeVisible();
  await expect(page.getByTestId("input-note-panel-text")).toHaveValue(new RegExp(`^${DEMO_NOTES.pinned.replace(/[?.]/g, "\$&")}`));

  // without open notes
  const state = async () => ({
    canvas: await store().canvases.get(RETAIL, CO),
    items: await store().canvasItems.listOfCanvas(RETAIL, CO),
    frames: await store().frames.listOfCanvas(RETAIL, CO),
    notes: await loadNotes(),
  });
  for (const n of (await loadNotes()).filter((x) => x.status === "open")) {
    const s = await state();
    await asLukasz((ctx, access) => updateNote(ctx, access, s, { noteId: n.id, expectedVersion: n.version, status: "resolved" }));
  }
  await page.goto(HOME);
  await expect(page.getByTestId("stat-open-notes")).toHaveText("0 open notes");
  await expect(page.getByTestId("text-no-open-notes")).toHaveText("No open notes on this project’s canvases.");
});
