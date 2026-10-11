import { expect, test } from "./fixtures";
import { card, expectToast, labelNamed, labelsField, loadLinks, loadModel, openCanvas, rawDb, signInAs, canvasUrl, WHOLE_CO } from "./helpers";

test("S3A-04: the label panel lists what CR-23 marks by kind as links; renaming works and refuses another label's name; “Delete label” takes it off every item, the model untouched, and Undo in the toast restores it with its links", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const cr23 = (await labelNamed("CR-23"))!;
  const linksBefore = (await loadLinks()).filter((k) => k.label_id === cr23.id).map((k) => k.id).sort();
  expect(linksBefore).toHaveLength(4);
  const modelBefore = await loadModel();

  // open it from its chip on Customer
  await card(page, "Customer").getByTestId("card-name").click();
  await labelsField(page).getByTestId("button-label-open").filter({ hasText: "CR-23" }).click();
  const panel = page.getByTestId("panel-label");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("text-label-marks")).toHaveText("Marks 1 entity, 2 attributes, 1 mapping. Labels belong to your working context, not to the model.");
  const items = (kind: string) => panel.getByTestId(`section-label-${kind}`).getByTestId("item-label-marks");
  await expect(items("entity")).toHaveCount(1);
  expect((await items("attribute").allInnerTexts()).map((t) => t.split("\n")[0])).toEqual(["email", "segment_code"]);
  await expect(items("mapping")).toHaveCount(1);
  await expect(panel.getByTestId("section-label-source_table")).toHaveCount(0);
  // a link opens the item
  await items("attribute").filter({ hasText: "segment_code" }).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();

  // rename: another label's name (in any case) is refused and the field shows the stored name again; a new one works
  await labelsField(page).getByTestId("button-label-open").click();
  const name = page.getByTestId("input-label-name");
  await name.fill("jira-481");
  await name.press("Enter");
  await expectToast(page, "Another label is already called “JIRA-481”.");
  await expect(name).toHaveValue("CR-23");
  await name.fill("CR-24");
  await name.press("Enter");
  await expect.poll(async () => (await labelNamed("CR-24"))?.id).toBe(cr23.id);

  // delete: off every item, the model untouched; Undo in the toast restores label and links
  await page.getByTestId("button-label-delete").click();
  await expectToast(page, "Deleted the label CR-24.");
  await expect.poll(async () => (await labelNamed("CR-24")) ?? null).toBeNull();
  expect((await loadLinks()).filter((k) => k.label_id === cr23.id)).toHaveLength(0);
  const db = await rawDb();
  expect(db.label_link.filter((k) => linksBefore.includes(k.id)).every((k) => k.deleted_at !== null)).toBe(true);
  const modelAfter = await loadModel();
  expect(modelAfter).toEqual(modelBefore);
  await page.getByTestId("toast-action").click();
  await expect.poll(async () => (await labelNamed("CR-24"))?.id).toBe(cr23.id);
  expect((await loadLinks()).filter((k) => k.label_id === cr23.id).map((k) => k.id).sort()).toEqual(linksBefore);
});
