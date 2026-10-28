import { createNote } from "../../src/domain/commands/note";
import { readDb } from "../../src/data/local/file";
import { createLocalDataStore } from "../../src/data/local/store";
import { E2E_DB } from "../config";
import { newSession } from "../slice-00/helpers";
import { asUser } from "../slice-01b/helpers";
import { canvasUrl } from "../slice-01a/helpers";
import { expect, test } from "./fixtures";
import { changeRoleAs, expectToast, openPeople, personRow, SEED_IDS, signInAs } from "./helpers";

const DWH = "Retail Co – DWH";

test("S8-10: removing: the confirmation with the last-workspace sentence, Cancel, Remove; a 404 for them, InfoMate no longer lists them, their note keeps their name", async ({ page, browser }) => {
  // Piotr writes a note through the server's path (with its change events) and keeps a session open
  const store = createLocalDataStore(E2E_DB);
  const ws = SEED_IDS.wsRetailDwh;
  const co = SEED_IDS.canvasCustomerOrders;
  const notes = { canvas: await store.canvases.get(ws, co), items: await store.canvasItems.listOfCanvas(ws, co), frames: await store.frames.listOfCanvas(ws, co), notes: (await readDb(E2E_DB)).note };
  const { note } = await asUser(SEED_IDS.userPiotr, (ctx, access) => createNote(ctx, access, notes, { canvasId: co, text: "Piotr asks about the load window", x: 40, y: 40 }));
  const piotr = await newSession(browser, "Piotr Wiśniewski");

  await signInAs(page, "Łukasz");
  await openPeople(page, ws);
  await personRow(page, "Piotr Wiśniewski").getByTestId("button-remove-person").click();
  const dialog = page.getByTestId("dialog-remove-person");
  await expect(dialog.getByTestId("text-remove-confirmation").locator("p")).toHaveText([
    `Piotr Wiśniewski loses access to ${DWH}.`,
    "They are in no other workspace of InfoMate, so they leave InfoMate too.",
  ]);
  await dialog.getByTestId("button-cancel-remove-person").click();
  await expect(dialog).toHaveCount(0);
  await expect(personRow(page, "Piotr Wiśniewski")).toBeVisible();
  expect((await readDb(E2E_DB)).workspace_member.some((m) => m.user_id === SEED_IDS.userPiotr)).toBe(true);

  await personRow(page, "Piotr Wiśniewski").getByTestId("button-remove-person").click();
  await dialog.getByTestId("button-confirm-remove-person").click();
  await expectToast(page, "Piotr Wiśniewski no longer has access.");
  await expect(personRow(page, "Piotr Wiśniewski")).toHaveCount(0);
  const db = await readDb(E2E_DB);
  expect(db.organization_member.some((m) => m.user_id === SEED_IDS.userPiotr)).toBe(false);

  // for him: the workspace is a 404, and InfoMate no longer lists his e-mail
  expect((await piotr.page.goto(`/w/${ws}`))?.status()).toBe(404);
  await piotr.context.close();
  // his note keeps his name
  await page.goto(`${canvasUrl()}?note=${note.id}`);
  await expect(page.getByTestId("panel-note")).toContainText("by Piotr Wiśniewski.");

  // a removed person can be added again
  await openPeople(page, ws);
  const box = page.getByTestId("box-add-person");
  await box.getByTestId("input-add-person-name").fill("Piotr");
  await box.getByTestId("input-add-person-email").fill("piotr.w@infomate.pl");
  await box.getByTestId("button-add-person-continue").click();
  await box.getByTestId("button-add-person").click();
  await expect(personRow(page, "Piotr Wiśniewski")).toBeVisible();
});

test("S8-10: without the last-workspace sentence when they keep another workspace; the organization's owner keeps one (F9)", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  // Anna keeps Bank X
  await personRow(page, "Anna Nowak").getByTestId("button-remove-person").click();
  await expect(page.getByTestId("text-remove-confirmation").locator("p")).toHaveText([`Anna Nowak loses access to ${DWH}.`]);
  await page.getByTestId("button-confirm-remove-person").click();
  await expectToast(page, "Anna Nowak no longer has access.");
  expect((await readDb(E2E_DB)).organization_member.some((m) => m.user_id === SEED_IDS.userAnna)).toBe(true);

  // Marek owns Retail Co and Sales analytics is his only workspace there: Łukasz, made its owner, cannot remove him
  await changeRoleAs(SEED_IDS.userMarek, SEED_IDS.wsSales, SEED_IDS.userLukasz, "owner");
  await openPeople(page, SEED_IDS.wsSales);
  await personRow(page, "Marek Lis").getByTestId("button-remove-person").click();
  await expectToast(page, "Marek Lis owns Retail Co, so they keep at least one workspace there.");
  await expect(page.getByTestId("dialog-remove-person")).toHaveCount(0);
});
