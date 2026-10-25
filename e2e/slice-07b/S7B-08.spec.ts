// S7B-08: Approve the mapping again and Leave it in review (P8, item 16): offered only when the mapping fits the
// source; with four-eyes on the importer is refused and someone else may approve; off, the importer approves.

import { FOUR_EYES_MESSAGE } from "../../src/domain/model/mapping-rules";
import { expect, test } from "./fixtures";
import { act, card, changeOf, crmChanges, expectToast, loadModel, openSystem, SEED_IDS, setFourEyes } from "./helpers";

const mappingOf = async (attribute: string) => {
  const m = await loadModel();
  const a = m.attributes.find((x) => x.name === attribute)!;
  return m.mappings.find((x) => x.attribute_id === a.id && x.status !== "draft")!;
};

test("S7B-08: approve again only when it fits; leave in review; four-eyes off lets the importer approve", async ({ page }) => {
  await crmChanges();
  await openSystem(page);
  // email_addr does not fit (varchar(255) into string(120)): no approve
  const email = card(page, "type_conflict", "dbo.customers.email_addr");
  await expect(email.getByTestId("change-action-approve")).toHaveCount(0);
  await act(page, "type_conflict", "dbo.customers.email_addr", "leave", "Left in review: dbo.customers.email_addr");
  expect((await mappingOf("email")).status).toBe("review");
  expect((await changeOf("type_conflict", "customers.email_addr")).resolution).toBe("Left in review");

  await act(page, "business_key_changed", "dbo.customers.cust_no", "approve", "Approved again: dbo.customers.cust_no");
  expect(await mappingOf("customer_number")).toMatchObject({ status: "approved", approved_by: SEED_IDS.userLukasz, review_reason: null });
});

test("S7B-08: with four-eyes on the importer may not approve again, a reviewer may", async ({ page, browser }) => {
  await setFourEyes(true);
  await crmChanges(SEED_IDS.userLukasz);
  await openSystem(page);
  await card(page, "business_key_changed", "dbo.customers.cust_no").getByTestId("change-action-approve").click();
  await expectToast(page, FOUR_EYES_MESSAGE);
  expect((await mappingOf("customer_number")).status).toBe("review");

  const other = await browser.newPage();
  await openSystem(other, "Piotr Wiśniewski");
  await act(other, "business_key_changed", "dbo.customers.cust_no", "approve", "Approved again: dbo.customers.cust_no");
  expect(await mappingOf("customer_number")).toMatchObject({ status: "approved", approved_by: SEED_IDS.userPiotr });
  await other.close();
});
