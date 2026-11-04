import { duplicateNameWarning } from "../../src/domain/commands/entity";
import { expect, test } from "./fixtures";
import { card, cubeStore, hydrated, openCanvas, recordToasts, SEED_IDS, signInAs, STAR_VIEW, starUrl, toasts, workspaceHome } from "./helpers";

// S15-17 (X-6, Q4): the duplicate-name warning compares within one level; the status bar's "Mapped attributes on
// canvas" counts logical attributes only; the workspace home counts logical entities. (A Data Vault reading exists for
// source tables only, so a fact or a dimension has none: nothing to show.)

test("S15-17: names repeat across levels without a warning, not within one; the status bar and the workspace home count the logical level", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await hydrated(page);

  // Dim Customer renamed "Customer": the logical Customer is another level, no warning
  await card(page, "Dim Customer").getByTestId("card-name").click();
  const name = page.getByTestId("input-entity-name");
  await name.fill("Customer");
  await name.press("Enter");
  await expect.poll(async () => (await cubeStore().model.load(SEED_IDS.wsRetailDwh)).entities.filter((e) => e.name === "Customer").length).toBe(2);
  expect(await toasts(page)).not.toContain(duplicateNameWarning("Customer"));
  // renamed "Dim Product": a dimension of that name exists, the warning shows
  await name.fill("Dim Product");
  await name.press("Enter");
  await expect.poll(() => toasts(page)).toContain(duplicateNameWarning("Dim Product"));

  // the status bar: the six logical cards' attributes only
  const model = await cubeStore().model.load(SEED_IDS.wsRetailDwh);
  const logicalHere = ["Customer", "Customer Address", "Country", "Sales Order", "Order Line", "Product"].map((n) => model.entities.find((e) => e.name === n && e.model_level === "logical")!.id);
  const attributes = model.attributes.filter((a) => logicalHere.includes(a.entity_id)).length;
  const mapped = new Set(model.mappings.map((m) => m.attribute_id));
  const mappedHere = model.attributes.filter((a) => logicalHere.includes(a.entity_id) && mapped.has(a.id)).length;
  await expect(page.getByTestId("status-mapped")).toHaveText(`Mapped attributes on canvas ${mappedHere} of ${attributes}`);

  // the workspace home: logical entities
  await page.goto(workspaceHome());
  const logical = model.entities.filter((e) => e.model_level === "logical").length;
  await expect(page.getByTestId("stats-workspace")).toContainText(`${logical} entities`);
});
