import { addMappingInput, createMapping, setMappingStatus } from "../../src/domain/commands/mapping";
import { expect, test } from "./fixtures";
import { asPerson, importNow, loadModel, openWizard, reviewFile, reviewRow, sample, SEED_IDS } from "./helpers";

test("S7A-08: an approved mapping goes back to review with its reason, announced before the import; approving it again clears the reason", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  // P6, before anything is written: the callout and the row's impact
  await expect(page.getByTestId("callout-send-back")).toContainText("2 approved mappings go back to review after this import");
  await expect(page.getByTestId("callout-send-back")).toContainText("Customer.customer_number: business key column changed type, varchar(20) → varchar(25)");
  // a type conflict on a direct mapping: email_addr widens to varchar(255), Customer.email is string(120) (the seed
  // since step 6, answer 10)
  await expect(page.getByTestId("callout-send-back")).toContainText("Customer.email: type conflict, varchar(255) into string(120)");
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
  const attribute = (name: string) => m.attributes.find((a) => a.name === name)!.id;
  const email = m.mappings.find((x) => x.attribute_id === attribute("email") && x.status !== "draft")!;
  expect(email).toMatchObject({ status: "review", review_reason: "type conflict, varchar(255) into string(120)" });
  // a mapping already in review keeps its status and gets no reason (answer 6)
  const birth = m.mappings.find((x) => x.attribute_id === attribute("birth_date"))!;
  expect(birth).toMatchObject({ status: "review", review_reason: null });

  // approving it again (a reviewer, four-eyes off) clears the reason
  await asPerson(SEED_IDS.userPiotr, (ctx, access) => setMappingStatus(ctx, access, { mapping, contentAuthorId: SEED_IDS.userLukasz }, { mappingId: mapping.id, expectedVersion: mapping.version, status: "approved" }));
  expect((await loadModel()).mappings.find((x) => x.id === mapping.id)).toMatchObject({ status: "approved", review_reason: null });
});

/** Test data: a mapping from a column onto a Customer attribute by Anna; for `rule`, a second input and the rule. */
async function mappingOf(attribute: string, columns: string[], rule?: string) {
  const m = await loadModel();
  const attr = m.attributes.find((a) => a.name === attribute)!;
  const customers = m.sourceTables.find((t) => t.name === "customers")!;
  const col = (name: string) => m.sourceColumns.find((c) => c.source_table_id === customers.id && c.name === name)!;
  const { mappingId } = await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    createMapping(ctx, access, { attribute: attr, column: col(columns[0]!), mappings: m.mappings, mappingInputs: m.mappingInputs }, { attributeId: attr.id, sourceColumnId: col(columns[0]!).id }),
  );
  for (const name of columns.slice(1)) {
    const now = await loadModel();
    const mapping = now.mappings.find((x) => x.id === mappingId)!;
    await asPerson(SEED_IDS.userAnna, (ctx, access) =>
      addMappingInput(ctx, access, { mapping, inputs: now.mappingInputs.filter((i) => i.mapping_id === mappingId), column: col(name) }, { mappingId, expectedVersion: mapping.version, sourceColumnId: col(name).id, ruleExpression: rule }),
    );
  }
  return mappingId;
}

async function approve(mappingId: string) {
  const mapping = (await loadModel()).mappings.find((x) => x.id === mappingId)!;
  await asPerson(SEED_IDS.userPiotr, (ctx, access) => setMappingStatus(ctx, access, { mapping, contentAuthorId: SEED_IDS.userAnna }, { mappingId, expectedVersion: mapping.version, status: "approved" }));
}

test("S7A-08: a combined mapping goes back to review for its business key input and its renamed input (rule rewritten, AD-26); a draft keeps its status", async ({ page }) => {
  // combined: cust_no (business key, varchar(20) → varchar(25)) and dob (renamed to date_of_birth, named in the rule)
  const combined = await mappingOf("segment_code", ["cust_no", "dob"], "CONCAT(cust_no, dob)");
  await approve(combined);
  // a draft from email_addr (varchar(120) → varchar(255)) into first_name string(50): a type conflict, but a draft
  const draft = await mappingOf("first_name", ["email_addr"]);

  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  const callout = page.getByTestId("callout-send-back");
  await expect(callout).toContainText("3 approved mappings go back to review after this import");
  const line = callout.locator("li").filter({ hasText: "Customer.segment_code" });
  await expect(line).toContainText("business key column changed type, varchar(20) → varchar(25)");
  await expect(line).toContainText("its rule now reads CONCAT(cust_no, date_of_birth)");
  await expect(callout).not.toContainText("Customer.first_name");
  // item 25's impact texts: a combined mapping's rows, the draft's
  await expect(reviewRow(page, "cust_no").getByTestId("review-impact").filter({ hasText: "Customer.segment_code" })).toContainText(
    "Feeds Customer.segment_code (approved); goes back to review: business key column changed type",
  );
  await expect(reviewRow(page, "date_of_birth").getByTestId("review-impact").filter({ hasText: "Customer.segment_code" })).toContainText("its rule now reads CONCAT(cust_no, date_of_birth)");
  await expect(reviewRow(page, "email_addr").getByTestId("review-impact").filter({ hasText: "Customer.first_name" })).toContainText("Feeds Customer.first_name (draft); type conflict:");
  await importNow(page, /^Imported into CRM: /);

  const m = await loadModel();
  const after = m.mappings.find((x) => x.id === combined)!;
  expect(after).toMatchObject({ status: "review", approved_by: null, rule_expression: "CONCAT(cust_no, date_of_birth)" });
  expect(after.review_reason).toContain("business key column changed type, varchar(20) → varchar(25)");
  expect(after.review_reason).toContain("its rule now reads CONCAT(cust_no, date_of_birth)");
  expect(m.mappings.find((x) => x.id === draft)).toMatchObject({ status: "draft", review_reason: null });
});
