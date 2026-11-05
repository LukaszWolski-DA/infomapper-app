import { expect, test } from "./fixtures";
import { cubeMappingId, cubeMappingRow, hydrated, openCubeMapping, openStar, recordToasts, signInAs, toasts, undoButton } from "./helpers";
import { setFourEyes } from "../slice-04a/helpers";
import { SEED_IDS } from "../slice-01a/helpers";

// S15-21 (O9, AD-06): with four-eyes on, Anna, who made Dim Customer.city's Draft (the star's author), is told
// beforehand that someone else has to approve it, and her approval is refused; Piotr, a reviewer, sets the status and
// nothing else (the other fields are read-only, no add, no ×, no delete), and approves it; the approval records him;
// he undoes his own approval.

const FOUR_EYES = "Four-eyes is on: someone else has to approve your change.";

test("S15-21: four-eyes stops the last editor; a reviewer approves and edits nothing else; his undo", async ({ page }) => {
  await setFourEyes(true);
  await recordToasts(page);
  const city = cubeMappingId("cust.city");

  await signInAs(page, "Anna Nowak");
  await openStar(page);
  await hydrated(page);
  const panel = await openCubeMapping(page, city);
  await expect(panel.getByTestId("note-four-eyes")).toHaveText(FOUR_EYES);
  await panel.getByTestId("seg-cube-status").getByText("Approved", { exact: true }).click();
  await expect.poll(() => toasts(page)).toContain(FOUR_EYES);
  await expect.poll(async () => (await cubeMappingRow(city))?.status).toBe("draft");
  await expect(panel.getByTestId("seg-cube-status").getByRole("button", { pressed: true })).toHaveText("Draft");

  await signInAs(page, "Piotr Wiśniewski");
  await openStar(page);
  await hydrated(page);
  const reviewed = await openCubeMapping(page, city);
  await expect(reviewed.getByTestId("note-four-eyes")).toHaveCount(0);
  // a reviewer edits nothing but the status
  await expect(reviewed.getByTestId("select-add-cube-input")).toHaveCount(0);
  await expect(reviewed.getByTestId("select-cube-target")).toBeDisabled();
  await expect(reviewed.getByTestId("seg-cube-kind").getByRole("button").first()).toBeDisabled();
  await expect(reviewed.getByTestId("input-cube-note")).toHaveAttribute("readonly", "");
  await expect(reviewed.getByTestId("button-delete-cube-mapping")).toHaveCount(0);
  await expect(reviewed.getByTestId("seg-cube-status").getByRole("button").first()).toBeEnabled();

  await reviewed.getByTestId("seg-cube-status").getByText("Approved", { exact: true }).click();
  await expect.poll(async () => [(await cubeMappingRow(city))?.status, (await cubeMappingRow(city))?.approved_by]).toEqual(["approved", SEED_IDS.userPiotr]);
  await undoButton(page).click();
  await expect.poll(async () => [(await cubeMappingRow(city))?.status, (await cubeMappingRow(city))?.approved_by]).toEqual(["draft", null]);
});
