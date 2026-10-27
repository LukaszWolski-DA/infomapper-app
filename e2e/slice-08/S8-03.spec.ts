import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";

test("S8-03: an e-mail address with an account is refused on the start page with its hint; nothing is written", async ({ page }) => {
  await page.goto("/sign-in");
  const before = await readDb(E2E_DB);
  const values = { organizationName: "Second", name: "Ł", email: "Lukasz@InfoMate.pl", password: "correct horse", passwordAgain: "correct horse" };
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`input-create-${key}`).fill(value);
  await page.getByTestId("button-create-continue").click();
  await expect(page.getByTestId("panel-create-organization").getByTestId("message-field")).toHaveText(
    "This e-mail address already has an account. Sign in and create the organization from the organization menu.",
  );
  await expect(page.getByTestId("text-create-summary")).toHaveCount(0);
  const after = await readDb(E2E_DB);
  expect(after.organization).toHaveLength(before.organization.length);
  expect(after.change_event).toHaveLength(before.change_event.length);
});
