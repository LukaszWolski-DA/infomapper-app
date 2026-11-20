// S33-05 (criterion 5), its local part: "Invite person" replaced "Add person"; changing roles and removing people work
// as before (S8-09, S8-10 run them); the People tables have the prototype's columns, the buttons after the role (P-a);
// the role texts say "invite people" (P-d).
import { expect, test } from "./fixtures";
import { closeLinkDialog, inviteInBox, openPeople, personRow, SEED_IDS, signInAs } from "./helpers";

test("S33-05: Invite person instead of Add person; the columns and the buttons after the role; the role texts", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(page.getByTestId("box-add-person")).toHaveCount(0);
  await expect(page.getByTestId("box-invite-person")).toBeVisible();
  await inviteInBox(page, "columns@example.com");
  await closeLinkDialog(page);

  for (const table of ["table-people", "table-pending"]) {
    const widths = await page.getByTestId(table).locator("col").evaluateAll((cols) => cols.map((c) => getComputedStyle(c).width));
    expect(widths.slice(1)).toEqual(["140px", "236px"]);
  }
  // the buttons start their cell, right after the role
  const cell = personRow(page, "Anna Nowak").locator("td").nth(2);
  expect(await cell.evaluate((td) => getComputedStyle(td).textAlign)).toMatch(/^(left|start)$/);

  await expect(page.getByText("invite people, roles (not owners), settings")).toBeVisible();
  await page.getByTestId("indicator-user").click();
  await expect(page.getByTestId("menu-user-role")).toContainText("You can do everything here");
  await page.keyboard.press("Escape");
});
