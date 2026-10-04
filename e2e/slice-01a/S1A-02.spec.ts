import { addMappingInput } from "../../src/domain/commands/mapping";
import { uuidv7 } from "../../src/domain/ids";
import { expect, test } from "./fixtures";
import { expectLineEndsOnRows, loadModel, mappingLine, RETAIL, SEED_IDS, signInAs, store } from "./helpers";

/** Test data: Customer.customer_id also reads customers.cust_no, with a rule: a combined mapping (D-49). */
async function makeCombinedMapping() {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const attr = model.attributes.find((a) => a.entity_id === customer.id && a.name === "customer_id")!;
  const mapping = model.mappings.find((m) => m.attribute_id === attr.id)!;
  const column = model.sourceColumns.find((c) => c.name === "cust_no" && model.sourceTables.find((t) => t.id === c.source_table_id)?.name === "customers")!;
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, SEED_IDS.userLukasz) };
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const state = { mapping, inputs: model.mappingInputs.filter((i) => i.mapping_id === mapping.id), column };
  const result = addMappingInput(ctx, access, state, {
    mappingId: mapping.id,
    expectedVersion: mapping.version,
    sourceColumnId: column.id,
    ruleExpression: "COALESCE(cust_id, cust_no)",
  });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return mapping.id;
}

test("S1A-02: every mapping line starts at its column's row and ends at its attribute's row, on the facing sides, at 25%, 100% and 300%; a combined mapping shows its ƒ node", async ({ page }) => {
  const combinedId = await makeCombinedMapping();
  await signInAs(page, "Łukasz");
  for (const zoom of [0.25, 1, 3]) {
    await expectLineEndsOnRows(page, zoom);
    await expect(mappingLine(page, combinedId).getByTestId("node-f")).toHaveCount(1);
  }
});
