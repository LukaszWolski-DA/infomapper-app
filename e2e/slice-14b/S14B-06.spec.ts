import { addPerson, signInWithPassword, signOutViaMenu } from "../slice-08/helpers";
import { expect, test } from "./fixtures";
import { archive, canvasStored, canvasUrl, expectToast, hydrated, notSaved, openCanvas, renamingTab, SEED_IDS, signInAs, startRename } from "./helpers";

// S14B-06 (item 4): a rename refused because the workspace was archived meanwhile keeps the typed name read-only and
// selectable ("Not saved. You can still copy it."); a locked organization's refusal keeps it editable with "Not saved".

const COPY = "Not saved. You can still copy it.";

test("S14B-06: archived meanwhile: the typed name stays read-only and selectable, Not saved, nothing written", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
  const field = await startRename(page, "Customer & orders");
  await archive();
  await field.fill("Archived name");
  await field.press("Enter");
  await expectToast(page, /archived/i);
  await expect(notSaved(renamingTab(page))).toHaveText(COPY);
  await expect(field).toHaveValue("Archived name");
  await expect(field).toHaveJSProperty("readOnly", true);
  await field.selectText();
  expect(await field.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))).toBe("Archived name");
  expect((await canvasStored(co)).name).toBe("Customer & orders");
});

test("S14B-06: a locked organization: the typed name stays editable, Not saved", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  // Anna also works in Retail Co; signing in there with its password leaves InfoMate locked in her session (S13-10)
  await addPerson(SEED_IDS.userMarek, SEED_IDS.wsSales, { name: "Anna", email: "anna.nowak@infomate.pl", role: "modeler" });
  await signInAs(page, "Anna Nowak");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
  const field = await startRename(page, "Customer & orders");
  const other = await page.context().newPage();
  await other.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await signOutViaMenu(other);
  await signInWithPassword(other, "anna.nowak@infomate.pl", "Retail Co");
  await other.close();

  await field.fill("Locked name");
  await field.press("Enter");
  await expectToast(page, "Unlock InfoMate first: open it and enter its password.");
  await expect(notSaved(renamingTab(page))).toHaveText("Not saved");
  await expect(field).toHaveValue("Locked name");
  await expect(field).toHaveJSProperty("readOnly", false);
  expect((await canvasStored(co)).name).toBe("Customer & orders");
});
