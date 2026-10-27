import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { expectToast, SEED_IDS, signInAs } from "./helpers";

test("S8-07: “New organization…”: the dialog's checks, the summary, Create; the new organization opens unlocked with its creator as owner", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.getByTestId("switcher-organization").click();
  await page.getByTestId("menu-item-new-organization").click();
  const dialog = page.getByTestId("dialog-new-organization");
  await expect(dialog.getByTestId("input-new-organization-workspaceName")).toHaveValue("First workspace");

  await dialog.getByTestId("button-new-organization-continue").click();
  await expect(dialog.getByTestId("message-field").first()).toHaveText("Enter the organization's name.");
  await dialog.getByTestId("input-new-organization-organizationName").fill("Second Org");
  await dialog.getByTestId("input-new-organization-password").fill("second-pass");
  await dialog.getByTestId("input-new-organization-passwordAgain").fill("second-pasS");
  await dialog.getByTestId("button-new-organization-continue").click();
  await expect(dialog.getByTestId("message-field")).toHaveText("The passwords differ.");

  await dialog.getByTestId("input-new-organization-passwordAgain").fill("second-pass");
  await dialog.getByTestId("button-new-organization-continue").click();
  await expect(dialog.getByTestId("text-create-summary")).toHaveText(
    "You are creating the organization Second Org with you as its owner, and the workspace First workspace with an empty first project and canvas, and the 19 built-in classifications. People sign in to Second Org with its link and this password.",
  );
  await dialog.getByTestId("button-create-back").click();
  await expect(dialog.getByTestId("input-new-organization-organizationName")).toHaveValue("Second Org");
  await dialog.getByTestId("button-new-organization-continue").click();
  await dialog.getByTestId("button-create").click();
  await expectToast(page, "Created Second Org with an empty first workspace.");
  await expect(page.getByTestId("switcher-organization")).toContainText("Second Org");
  await expect(page.getByTestId("page-workspace-home")).toContainText("First workspace");

  await page.getByTestId("switcher-organization").click();
  await expect(page.getByTestId("icon-locked")).toHaveCount(0);
  const db = await readDb(E2E_DB);
  const org = db.organization.find((o) => o.name === "Second Org")!;
  expect(db.organization_member).toContainEqual(expect.objectContaining({ organization_id: org.id, user_id: SEED_IDS.userLukasz, role: "owner" }));
});
