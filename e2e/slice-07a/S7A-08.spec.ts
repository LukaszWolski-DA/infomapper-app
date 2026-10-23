import { setMappingStatus } from "../../src/domain/commands/mapping";
import { expect, test } from "./fixtures";
import { asPerson, importNow, loadModel, openWizard, reviewFile, reviewRow, sample, SEED_IDS } from "./helpers";

test("S7A-08: an approved mapping goes back to review with its reason, announced before the import; approving it again clears the reason", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  // P6, before anything is written: the callout and the row's impact
  await expect(page.getByTestId("callout-send-back")).toContainText("1 approved mapping goes back to review after this import");
  await expect(page.getByTestId("callout-send-back")).toContainText("Customer.customer_number: business key column changed type, varchar(20) → varchar(25)");
  await expect(reviewRow(page, "cust_no").getByTestId("review-impact")).toContainText(
    "Feeds Customer.customer_number (approved); goes back to review: business key column changed type, varchar(20) → varchar(25)",
  );
  await expect(reviewRow(page, "cust_no")).toContainText("On Customer & orders");
  // a mapping in review keeps its status; a rename keeps the mapping; the requirement keys of the attribute
  await expect(reviewRow(page, "date_of_birth").getByTestId("review-impact")).toContainText("Feeds Customer.birth_date (in review); the mapping stays");
  await expect(reviewRow(page, "email_addr").getByTestId("review-requirement")).not.toHaveCount(0);
  await importNow(page, /^Imported into CRM: /);

  const m = await loadModel();
  const custNo = m.sourceColumns.find((c) => c.name === "cust_no" && m.sourceTables.find((t) => t.id === c.source_table_id)!.name === "customers")!;
  const mapping = m.mappings.find((x) => m.mappingInputs.some((i) => i.mapping_id === x.id && i.source_column_id === custNo.id))!;
  expect(mapping).toMatchObject({ status: "review", approved_by: null, approved_at: null, review_reason: "business key column changed type, varchar(20) → varchar(25)" });
  const birth = m.mappings.find((x) => x.status === "review" && x.rule_expression === null && x.id !== mapping.id && m.mappingInputs.some((i) => i.mapping_id === x.id))!;
  expect(birth.review_reason).toBeNull();

  // approving it again (a reviewer, four-eyes off) clears the reason
  await asPerson(SEED_IDS.userPiotr, (ctx, access) => setMappingStatus(ctx, access, { mapping, contentAuthorId: SEED_IDS.userLukasz }, { mappingId: mapping.id, expectedVersion: mapping.version, status: "approved" }));
  expect((await loadModel()).mappings.find((x) => x.id === mapping.id)).toMatchObject({ status: "approved", review_reason: null });
});
