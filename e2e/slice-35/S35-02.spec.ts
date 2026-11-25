// S35-02 (slice 35, criterion 2; B1.2 to B1.4, B2.1): Rename for Owners, Admins and Modelers, one dialog for the name
// and the note with creating's rules; a refused name keeps the dialog open; Cancel changes nothing. Delete only for
// Owners and Admins, after the question; the baseline leaves the list, the tab's number goes down and its name is free
// again. Reviewers, Readers and guests see neither button; in an archived workspace nobody does. Each write is a change
// event with who and when, and none is an undo step.
import { test, expect } from "./fixtures";
import {
  archive,
  baselineEvents,
  createInBox,
  deleteDialog,
  expectToast,
  minute,
  openBaselines,
  renameDialog,
  rowNamed,
  rows,
  signInAs,
  SEED_IDS,
  storedBaseline,
  storedBaselines,
  tabLabel,
} from "./helpers";

test.use({ seed: "full" });

test("S35-02: rename and delete, their rights and dialogs, the history, never an undo step", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await createInBox(page, "Stage 2 sign-off");
  await expectToast(page, "Created the baseline Stage 2 sign-off.");
  // not an undo step: the top bar's Undo has nothing to undo
  await expect(page.getByTestId("button-undo")).toBeDisabled();

  // a Modeler renames; sees no Delete
  await signInAs(page, "Anna Nowak");
  await openBaselines(page);
  const row = rowNamed(page, "Stage 2 sign-off");
  await expect(row.getByTestId("button-baseline-delete")).toHaveCount(0);
  await row.getByTestId("button-baseline-rename").click();
  const dialog = renameDialog(page);
  await expect(dialog.getByTestId("text-dialog-subtitle")).toHaveText("Retail Co – DWH · baseline");
  await expect(dialog.getByRole("heading", { name: "Rename “Stage 2 sign-off”" })).toBeVisible();
  const made = (await storedBaseline("Stage 2 sign-off"))!;
  await expect(dialog.getByTestId("text-rename-baseline")).toHaveText(
    `Only the name and the note change. What the baseline holds stays as it was taken on ${minute(made.created_at)}.`,
  );
  await expect(dialog.getByLabel("Name")).toHaveAttribute("maxlength", "120");
  await expect(dialog.getByLabel("Note (optional)")).toHaveAttribute("maxlength", "1000");
  // Cancel changes nothing
  await dialog.getByLabel("Name").fill("Something else");
  await dialog.getByTestId("button-cancel-rename-baseline").click();
  await expect(dialog).toHaveCount(0);
  expect((await storedBaseline("Stage 2 sign-off"))!.version).toBe(1);
  // a taken name in another letter case: refused, the dialog stays open
  await row.getByTestId("button-baseline-rename").click();
  await dialog.getByLabel("Name").fill("stage 1 SIGN-OFF");
  await dialog.getByTestId("button-save-rename-baseline").click();
  await expectToast(page, "A baseline named stage 1 SIGN-OFF already exists in this workspace.");
  await expect(dialog).toBeVisible();
  // an empty name: refused, open
  await dialog.getByLabel("Name").fill("  ");
  await dialog.getByTestId("button-save-rename-baseline").click();
  await expectToast(page, "Give the baseline a name.");
  await expect(dialog).toBeVisible();
  // the name and the note
  await dialog.getByLabel("Name").fill("Stage 2 agreed");
  await dialog.getByLabel("Note (optional)").fill("Signed by Retail Co.");
  await dialog.getByTestId("button-save-rename-baseline").click();
  await expectToast(page, "Renamed the baseline Stage 2 sign-off to Stage 2 agreed.");
  await expect(dialog).toHaveCount(0);
  await expect(rowNamed(page, "Stage 2 agreed").getByTestId("baseline-meta")).toContainText(" · Signed by Retail Co. · ");
  // the note only
  await rowNamed(page, "Stage 2 agreed").getByTestId("button-baseline-rename").click();
  await dialog.getByLabel("Note (optional)").fill("Signed on 24 November.");
  await dialog.getByTestId("button-save-rename-baseline").click();
  await expectToast(page, "Changed the note of the baseline Stage 2 agreed.");
  await expect(rowNamed(page, "Stage 2 agreed").getByTestId("baseline-meta")).toContainText(" · Signed on 24 November. · ");

  // a Reviewer and a Reader see neither button, Compare on every row
  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    await signInAs(page, name);
    await openBaselines(page);
    await expect(page.getByTestId("button-baseline-rename")).toHaveCount(0);
    await expect(page.getByTestId("button-baseline-delete")).toHaveCount(0);
    await expect(page.getByTestId("button-baseline-compare")).toHaveCount(2);
  }

  // the Owner deletes after the question; the name is free again
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await rowNamed(page, "Stage 2 agreed").getByTestId("button-baseline-delete").click();
  const del = deleteDialog(page);
  await expect(del.getByTestId("text-dialog-subtitle")).toHaveText("Retail Co – DWH · baseline");
  await expect(del.getByRole("heading", { name: "Delete the baseline “Stage 2 agreed”?" })).toBeVisible();
  await expect(del.getByTestId("text-delete-baseline")).toHaveText("It cannot be brought back here.");
  await expect(del.getByRole("button")).toHaveText(["✕", "Cancel", "Delete baseline"]);
  await del.getByTestId("button-cancel-delete-baseline").click();
  await expect(rows(page)).toHaveCount(2);
  await rowNamed(page, "Stage 2 agreed").getByTestId("button-baseline-delete").click();
  await del.getByTestId("button-confirm-delete-baseline").click();
  await expectToast(page, "Deleted the baseline Stage 2 agreed.");
  await expect(rows(page)).toHaveCount(1);
  await expect(tabLabel(page)).toHaveText("Baselines (1)");
  await createInBox(page, "stage 2 AGREED");
  await expectToast(page, "Created the baseline stage 2 AGREED.");
  await expect(page.getByTestId("button-undo")).toBeDisabled();

  // the history: who and when, every write
  const events = await baselineEvents();
  expect(events.map((e) => [e.operation, e.user_id])).toEqual([
    ["create", SEED_IDS.userLukasz],
    ["update", SEED_IDS.userAnna],
    ["update", SEED_IDS.userAnna],
    ["delete", SEED_IDS.userLukasz],
    ["create", SEED_IDS.userLukasz],
  ]);
  for (const e of events) {
    expect(e.occurred_at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(e.after_image ?? e.before_image).not.toHaveProperty("snapshot");
  }
  expect((await storedBaselines()).filter((b) => b.deleted_at !== null).map((b) => b.name)).toEqual(["Stage 2 agreed"]);

  // archived: no Rename, no Delete, Compare stays
  await archive();
  await openBaselines(page);
  await expect(page.getByTestId("button-baseline-rename")).toHaveCount(0);
  await expect(page.getByTestId("button-baseline-delete")).toHaveCount(0);
  await expect(page.getByTestId("button-baseline-compare")).toHaveCount(2);
});
