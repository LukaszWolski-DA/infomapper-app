// Slice 33's helpers: the link pages, the e2e data file's invitations, and a change of the file (an invitation expired,
// a workspace archived). The box and the link dialog are slice 8's helpers (`inviteInBox`, `closeLinkDialog`,
// `joinByLink`), which the earlier specs use since "Invite person" replaced "Add person".
import { expect, type Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";

export {
  acceptAs,
  addPerson,
  changeRoleAs,
  closeLinkDialog,
  expectToast,
  inviteAs,
  inviteInBox,
  joinByLink,
  openPeople,
  personRow,
  SEED_IDS,
  signInAs,
  signOutViaMenu,
} from "../slice-08/helpers";

export const DWH = "Retail Co – DWH";
export const GONE = "This invitation link has expired, was already used or was revoked. Nothing was changed.";
export const GONE_ASK = "Ask the person who invited you for a new link.";

/** A pending invitation's row on the People tab, by its e-mail. */
export const pendingRow = (page: Page, email: string) => page.getByTestId("row-pending").filter({ hasText: email });

/** The e2e data file's invitations. */
export const storedInvitations = async () => (await readDb(E2E_DB)).invitation;

/** The e2e data file as it stands. */
export const stored = () => readDb(E2E_DB);

/** Test data: a change of the e2e data file. */
export async function changeDb(change: (db: Awaited<ReturnType<typeof readDb>>) => void) {
  const db = await readDb(E2E_DB);
  change(db);
  await writeDb(E2E_DB, db);
}

/** The link's page shows the one refused message (P-l): the title "Invitation", no form, no button. */
export async function expectGone(page: Page, link: string) {
  await page.goto(link);
  await expect(page.getByTestId("title-link")).toHaveText("Invitation");
  await expect(page.getByTestId("text-link-gone")).toContainText(GONE);
  await expect(page.getByTestId("text-link-gone")).toContainText(GONE_ASK);
  await expect(page.getByTestId("form-join")).toHaveCount(0);
  await expect(page.getByTestId("panel-link").getByRole("button")).toHaveCount(0);
}

/** A link with one character of its token changed. */
export const altered = (link: string) => link.slice(0, -1) + (link.endsWith("A") ? "B" : "A");
