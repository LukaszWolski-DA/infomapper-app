import { updateRequirement } from "../../src/domain/commands/requirement";
import { expect, test, type Page } from "./fixtures";
import { asPerson, expectToast, loadRequirements, openCanvas, openRequirement, requirementByKey, RETAIL, SEED_IDS, setFourEyes, signInAs, store } from "./helpers";

const agree = (page: Page) => page.getByTestId("seg-req-status").getByRole("button", { name: "Agreed", exact: true }).click();
const status = (page: Page) => page.getByTestId("seg-req-status").locator("[aria-pressed=true]");

test("S4A-12: four-eyes on: Anna edits REQ-103's description and cannot set it to Agreed (hint, refusal, status unchanged); Piotr sets it to Agreed, in the change log with him as user; with four-eyes off Anna can", async ({ page }) => {
  await setFourEyes(true);
  const before = await requirementByKey("REQ-103");
  await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    updateRequirement(ctx, access, { requirements: [before] }, { requirementId: before.id, expectedVersion: before.version, field: "description", value: "<p>No two active customers share an e-mail address, in any case.</p>" }),
  );

  await signInAs(page, "Anna Nowak");
  await openCanvas(page);
  await openRequirement(page, "REQ-103");
  await expect(page.getByTestId("note-req-four-eyes")).toHaveText("You changed REQ-103 last, so someone else has to agree it.");
  await agree(page);
  await expectToast(page, "You changed REQ-103 last, so someone else has to agree it.");
  await expect(status(page)).toHaveText("Draft");
  expect((await requirementByKey("REQ-103")).status).toBe("draft");

  await signInAs(page, "Piotr Wiśniewski");
  await openCanvas(page);
  await openRequirement(page, "REQ-103");
  await expect(page.getByTestId("note-req-four-eyes")).toHaveCount(0);
  await agree(page);
  await expect.poll(async () => (await requirementByKey("REQ-103")).status).toBe("agreed");
  const events = (await store().changeEvents.listForRequirement(RETAIL, before.id)).filter((e) => e.after_image?.status === "agreed");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ user_id: SEED_IDS.userPiotr, operation: "update" });
  expect(events[0]!.before_image?.status).toBe("draft");

  // four-eyes off: Anna agrees REQ-104, which she wrote
  await setFourEyes(false);
  await signInAs(page, "Anna Nowak");
  await openCanvas(page);
  await openRequirement(page, "REQ-104");
  await expect(page.getByTestId("note-req-four-eyes")).toHaveCount(0);
  await agree(page);
  await expect.poll(async () => (await requirementByKey("REQ-104")).status).toBe("agreed");
  expect((await loadRequirements()).length).toBe(5);
});
